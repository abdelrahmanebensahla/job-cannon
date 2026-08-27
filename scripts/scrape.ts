import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

import type { Job, JobSource } from '../lib/types';
import { JobSchema } from '../lib/types';
import { scrape as scrapeGreenhouse } from '../lib/scrapers/greenhouse';
import { scrape as scrapeLever } from '../lib/scrapers/lever';
import { scrape as scrapeRemoteOk } from '../lib/scrapers/remoteok';
import { scrape as scrapeAshby } from '../lib/scrapers/ashby';

const JOBS_PATH = path.join(process.cwd(), 'data', 'jobs.json');
// Tiny sidecar so pages that only need the corpus SIZE (the dashboard stats
// line) don't read and parse the ~44 MB corpus just to call `.length`.
const JOBS_META_PATH = path.join(process.cwd(), 'data', 'jobs-meta.json');
const MAX_AGE_DAYS = 14;

/**
 * Health floor. Board slugs rot constantly — companies migrate ATS and their
 * old board just starts 404ing. Every scraper swallows per-board failures by
 * design (one dead slug shouldn't kill the run), which previously meant
 * coverage could decay to nothing while the nightly job stayed green.
 *
 * These are the counts observed on 2026-08-27, floored with room to move.
 * If a run comes in under one of them, the job fails loudly instead of
 * silently committing a thinner jobs.json. Raise them as coverage grows.
 */
const MIN_JOBS_PER_SOURCE: Record<JobSource, number> = {
  greenhouse: 3000,
  ashby: 1500,
  lever: 100,
  remoteok: 50,
};

/** A run that loses this fraction of the previous corpus is treated as broken. */
const MAX_SHRINK_RATIO = 0.5;

/**
 * Upper bound on the committed corpus. `data/jobs.json` is read into memory
 * whole on every cold start and bundled into each function that touches it,
 * so unbounded growth is a real cost, not a tidiness concern. At ~4 KB per
 * job this is roughly 80 MB — well inside Vercel's 250 MB function limit,
 * but far enough above today's ~10.6K that it only trips on real runaway.
 * If this fires, decide deliberately: trim boards, or move jobs to Postgres.
 */
const MAX_TOTAL_JOBS = 20_000;

type StoredJob = Job & { _last_seen: string };

async function loadExisting(): Promise<Map<string, StoredJob>> {
  const map = new Map<string, StoredJob>();
  if (!existsSync(JOBS_PATH)) return map;
  try {
    const raw = await readFile(JOBS_PATH, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return map;
    for (const item of parsed) {
      const result = JobSchema.safeParse(item);
      if (!result.success) continue;
      const stored = item as StoredJob;
      map.set(stored.id, {
        ...result.data,
        _last_seen: stored._last_seen ?? result.data.posted_at,
      });
    }
  } catch (e) {
    console.warn('Failed to load existing jobs.json, starting fresh:', e instanceof Error ? e.message : e);
  }
  return map;
}

function isFresh(lastSeenIso: string, now: number): boolean {
  const ts = Date.parse(lastSeenIso);
  if (Number.isNaN(ts)) return true;
  return now - ts < MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Compares real instants, not strings. The sources disagree on ISO format —
 * Greenhouse and Ashby emit UTC offsets, Lever and RemoteOK emit `Z` — so a
 * lexical sort silently interleaves them wrong. Same rule as `preFilter` in
 * lib/jobs.ts; both must stay on parsed time.
 */
function byPostedAtDesc(a: Job, b: Job): number {
  return (Date.parse(b.posted_at) || 0) - (Date.parse(a.posted_at) || 0);
}

function assertHealthy(fresh: Job[], previousCount: number): void {
  const bySource = new Map<string, number>();
  for (const j of fresh) bySource.set(j.source, (bySource.get(j.source) ?? 0) + 1);

  const failures: string[] = [];
  for (const [source, floor] of Object.entries(MIN_JOBS_PER_SOURCE)) {
    const got = bySource.get(source) ?? 0;
    const mark = got < floor ? 'FAIL' : 'ok';
    console.log(`[health] ${source.padEnd(11)} ${String(got).padStart(5)} / min ${floor}  ${mark}`);
    if (got < floor) {
      failures.push(`${source}: ${got} jobs, expected at least ${floor}`);
    }
  }

  if (previousCount > 0 && fresh.length < previousCount * MAX_SHRINK_RATIO) {
    failures.push(
      `total scrape collapsed: ${fresh.length} jobs vs ${previousCount} previously stored`,
    );
  }

  if (failures.length > 0) {
    console.error('\nScrape health check failed:');
    for (const f of failures) console.error(`  - ${f}`);
    console.error(
      '\nA board slug has probably gone dead. Check the [greenhouse]/[ashby]/[lever] warnings\n' +
        'above, find the current slug, and update the list in lib/scrapers/*-companies.ts.\n' +
        'jobs.json was NOT written.',
    );
    process.exit(1);
  }
}

async function main() {
  const startedAt = new Date();
  const nowIso = startedAt.toISOString();
  const nowMs = startedAt.getTime();

  console.log(`Scrape started at ${nowIso}`);
  const existing = await loadExisting();
  console.log(`Loaded ${existing.size} existing jobs`);

  const [ghRes, lvRes, roRes, abRes] = await Promise.allSettled([
    scrapeGreenhouse(),
    scrapeLever(),
    scrapeRemoteOk(),
    scrapeAshby(),
  ]);

  const fresh: Job[] = [];
  for (const r of [ghRes, lvRes, roRes, abRes]) {
    if (r.status === 'fulfilled') fresh.push(...r.value);
    else console.warn('Source failed:', r.reason instanceof Error ? r.reason.message : r.reason);
  }
  console.log(`Total fresh jobs scraped: ${fresh.length}`);

  // Bail before touching jobs.json if coverage has collapsed.
  assertHealthy(fresh, existing.size);

  // Upsert.
  for (const j of fresh) {
    existing.set(j.id, { ...j, _last_seen: nowIso });
  }

  // Drop stale: jobs not seen in the last 14 days.
  const kept: StoredJob[] = [];
  let dropped = 0;
  for (const j of existing.values()) {
    if (isFresh(j._last_seen, nowMs)) kept.push(j);
    else dropped++;
  }
  console.log(`Kept ${kept.length} jobs; dropped ${dropped} stale.`);

  if (kept.length > MAX_TOTAL_JOBS) {
    console.error(
      `\nCorpus ceiling exceeded: ${kept.length} jobs > ${MAX_TOTAL_JOBS}.`,
    );
    console.error(
      'data/jobs.json is loaded into memory whole on every cold start. Trim the\n' +
        'board lists or move the corpus to Postgres before letting it grow further.\n' +
        'jobs.json was NOT written.',
    );
    process.exit(1);
  }

  // Sort: source, then posted_at desc, for diff stability.
  kept.sort((a, b) => {
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return byPostedAtDesc(a, b);
  });

  await writeFile(JOBS_PATH, JSON.stringify(kept, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${kept.length} jobs to ${JOBS_PATH}`);

  const sources = [...new Set(kept.map(j => j.source))].sort();
  const companies = new Set(kept.map(j => j.company)).size;
  await writeFile(
    JOBS_META_PATH,
    JSON.stringify({ count: kept.length, companies, sources, generatedAt: nowIso }, null, 2) + '\n',
    'utf8',
  );
  console.log(`Wrote meta (${kept.length} jobs, ${companies} companies) to ${JOBS_META_PATH}`);
}

main().catch(err => {
  console.error('Scrape failed:', err);
  process.exit(1);
});
