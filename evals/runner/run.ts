import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { z } from 'zod';

import { getClient, MODEL } from '@/lib/ai/client';
import { ProfileSchema, type Job, type Profile } from '@/lib/types';

import { DIGEST_POOL, DIGEST_TOP_N } from './config';
import { digestCandidates, evaluateProfile, type RunRecord } from './evaluate';
import { BudgetExceededError, instrument, type Budget } from './instrument';
import { loadSnapshot, readLock } from './snapshot';

/**
 * Eval runner. Calls the real pipeline (preFilter + rankJobs) over a set of
 * frozen profiles against the locked corpus, and writes one JSONL record per
 * profile per repeat. Scoring lives in Python; this only produces evidence.
 *
 *   npm run eval:run -- --profiles <file.jsonl> --budget-usd 2.50
 *   npm run eval:run -- --profiles <file.jsonl> --dry-run     # no API calls
 */

const ProfileLineSchema = z.object({ profile_id: z.string().min(1), profile: ProfileSchema });

const USAGE = `usage: npm run eval:run -- --profiles <file.jsonl> (--budget-usd <n> | --dry-run)
  --out <file.jsonl>     default evals/runs/<run_id>.jsonl
  --repeats <k>          rank every profile k times (default 1)
  --concurrency <n>      parallel rankings (default 3)
  --limit <n>            only the first n profiles
  --dry-run              build candidate pools only, spend nothing`;

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

function positiveInt(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) fail(`--${name} must be a positive integer`);
  return n;
}

function readProfiles(file: string): { profile_id: string; profile: Profile }[] {
  const lines = readFileSync(file, 'utf8').split('\n').filter(l => l.trim().length > 0);
  const out = lines.map((line, i) => {
    const parsed = ProfileLineSchema.safeParse(JSON.parse(line));
    if (!parsed.success) fail(`${file}:${i + 1} is not a valid profile line\n${z.prettifyError(parsed.error)}`);
    return parsed.data;
  });
  const ids = new Set(out.map(p => p.profile_id));
  if (ids.size !== out.length) fail(`${file} has duplicate profile_id values`);
  return out;
}

function gitText(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

async function pool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  let stopped = false;
  async function next(): Promise<void> {
    while (!stopped) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        await worker(items[i]);
      } catch (e) {
        stopped = true;
        throw e;
      }
    }
  }
  // allSettled, not all: when one worker stops the run, the others finish the
  // request they already paid for and write its record before we report.
  const settled = await Promise.allSettled(
    Array.from({ length: Math.min(limit, items.length) }, () => next()),
  );
  const rejected = settled.find((s): s is PromiseRejectedResult => s.status === 'rejected');
  if (rejected) throw rejected.reason;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      profiles: { type: 'string' },
      out: { type: 'string' },
      'budget-usd': { type: 'string' },
      repeats: { type: 'string' },
      concurrency: { type: 'string' },
      limit: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  });

  if (!values.profiles) fail(USAGE);
  const dryRun = values['dry-run'];
  const budgetUsd = values['budget-usd'] === undefined ? NaN : Number(values['budget-usd']);
  // No default on purpose: a paid run has to state what it may spend.
  if (!dryRun && !(budgetUsd > 0)) fail(`--budget-usd is required for a paid run\n\n${USAGE}`);

  const repeats = positiveInt(values.repeats, 1, 'repeats');
  const concurrency = positiveInt(values.concurrency, 3, 'concurrency');

  let profiles = readProfiles(values.profiles);
  if (values.limit !== undefined) profiles = profiles.slice(0, positiveInt(values.limit, 1, 'limit'));

  const lock = readLock();
  const jobs: Job[] = loadSnapshot(lock);

  const commit = gitText(['rev-parse', 'HEAD']);
  const dirty = gitText(['status', '--porcelain', '--untracked-files=no']).length > 0;
  const startedAt = new Date();
  const runId = `${startedAt.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z-${commit.slice(0, 7)}`;
  const outPath = values.out ?? path.join('evals', 'runs', `${runId}.jsonl`);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, '', 'utf8');

  const budget: Budget = { limitUsd: dryRun ? 0 : budgetUsd, spentUsd: 0, reservedUsd: 0 };
  const meta = {
    schema_version: 1,
    run_id: runId,
    started_at: startedAt.toISOString(),
    finished_at: null as string | null,
    commit,
    dirty,
    model: MODEL,
    corpus: lock,
    config: { pool: DIGEST_POOL, top_n: DIGEST_TOP_N, repeats, concurrency },
    profiles_file: values.profiles,
    profiles: profiles.length,
    dry_run: dryRun,
    budget_usd: dryRun ? 0 : budgetUsd,
    spent_usd: 0,
    records: 0,
    ranking_failures: 0,
    aborted_by_budget: false,
  };
  const metaPath = outPath.replace(/\.jsonl$/, '') + '.meta.json';
  const writeMeta = () => writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');

  console.log(
    `run ${runId}: ${profiles.length} profiles x ${repeats} repeat(s), corpus ${lock.commit.slice(0, 7)} (${jobs.length} jobs), ` +
      (dryRun ? 'dry run' : `model ${MODEL}, cap $${budgetUsd.toFixed(2)}`),
  );
  if (dirty) console.warn('warning: working tree has uncommitted changes; this run is not tied to a clean commit');

  if (dryRun) {
    for (const p of profiles) {
      const candidates = digestCandidates(jobs, p.profile);
      appendFileSync(
        outPath,
        JSON.stringify({ schema_version: 1, run_id: runId, profile_id: p.profile_id, pool_size: candidates.length, candidate_ids: candidates.map(j => j.id) }) + '\n',
      );
      meta.records++;
    }
  } else {
    instrument(getClient(), budget);
    const work = Array.from({ length: repeats }, (_, repeat) => profiles.map(p => ({ ...p, repeat }))).flat();
    try {
      await pool(work, concurrency, async item => {
        const record: RunRecord = await evaluateProfile({
          runId,
          repeat: item.repeat,
          profileId: item.profile_id,
          profile: item.profile,
          jobs,
        });
        appendFileSync(outPath, JSON.stringify(record) + '\n');
        meta.records++;
        if (record.error) meta.ranking_failures++;
        console.log(
          `  ${item.profile_id} r${item.repeat}: ${record.error ?? `top ${record.top_ids.length}`}` +
            `${record.retried ? ' (retried)' : ''} $${record.cost_usd.toFixed(4)} ${record.latency_ms}ms  [total $${budget.spentUsd.toFixed(4)}]`,
        );
      });
    } catch (e) {
      if (!(e instanceof BudgetExceededError)) throw e;
      meta.aborted_by_budget = true;
      console.error(`\nSTOPPED: ${e.message}`);
    }
  }

  meta.spent_usd = Number(budget.spentUsd.toFixed(6));
  meta.finished_at = new Date().toISOString();
  writeMeta();

  console.log(`\nwrote ${meta.records} records to ${outPath}`);
  console.log(`spent $${budget.spentUsd.toFixed(4)}${dryRun ? '' : ` of $${budgetUsd.toFixed(2)}`}, ranking failures: ${meta.ranking_failures}`);
  if (meta.aborted_by_budget) process.exit(3);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
