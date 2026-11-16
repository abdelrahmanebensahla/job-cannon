import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { JobSchema, type Job } from '@/lib/types';

/**
 * The frozen corpus an eval runs against.
 *
 * data/jobs.json is rewritten every night and drops postings after 14 days,
 * so a result is only reproducible if it names the exact corpus it used. The
 * lock pins that corpus by the commit that holds it plus a sha256 of the
 * file. Nothing is copied into the repo: the 54 MB file is read back out of
 * git history and verified against the hash.
 */

export const LOCK_PATH = path.join('evals', 'golden', 'corpus.lock.json');
const CACHE_DIR = path.join('evals', '.cache');
const MAX_BUFFER = 256 * 1024 * 1024;

export const CorpusLockSchema = z.object({
  commit: z.string().regex(/^[0-9a-f]{40}$/),
  path: z.string(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  count: z.number().int().positive(),
  /** Git tag on `commit`, so the object stays reachable. */
  tag: z.string(),
});

export type CorpusLock = z.infer<typeof CorpusLockSchema>;

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

function git(args: string[]): Buffer {
  return execFileSync('git', args, { maxBuffer: MAX_BUFFER, stdio: ['ignore', 'pipe', 'pipe'] });
}

function hasObject(spec: string): boolean {
  try {
    git(['cat-file', '-e', spec]);
    return true;
  } catch {
    return false;
  }
}

/** Reads `file` as of `commit`, fetching that one commit if the clone is shallow. */
export function readFromGit(commit: string, file: string): Buffer {
  const spec = `${commit}:${file}`;
  if (!hasObject(spec)) {
    git(['fetch', '--depth=1', 'origin', commit]);
  }
  return git(['show', spec]);
}

export function parseJobs(raw: Buffer): Job[] {
  const parsed: unknown = JSON.parse(raw.toString('utf8'));
  if (!Array.isArray(parsed)) throw new Error('corpus is not a JSON array');
  // Same tolerance as readJobs() in lib/jobs.ts: skip rows that fail the
  // schema. Array order is preserved, which preFilter's stable sort relies on.
  const jobs: Job[] = [];
  for (const item of parsed) {
    const r = JobSchema.safeParse(item);
    if (r.success) jobs.push(r.data);
  }
  return jobs;
}

export function readLock(): CorpusLock {
  return CorpusLockSchema.parse(JSON.parse(readFileSync(LOCK_PATH, 'utf8')));
}

/** Loads the locked corpus and refuses to continue if it does not match. */
export function loadSnapshot(lock: CorpusLock = readLock()): Job[] {
  const cached = path.join(CACHE_DIR, `jobs-${lock.sha256.slice(0, 16)}.json`);

  let raw: Buffer;
  if (existsSync(cached)) {
    raw = readFileSync(cached);
  } else {
    raw = readFromGit(lock.commit, lock.path);
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(cached, raw);
  }

  const actual = sha256(raw);
  if (actual !== lock.sha256) {
    throw new Error(
      `corpus hash mismatch: lock says ${lock.sha256}, ${lock.commit.slice(0, 7)}:${lock.path} is ${actual}`,
    );
  }

  const jobs = parseJobs(raw);
  if (jobs.length !== lock.count) {
    throw new Error(`corpus count mismatch: lock says ${lock.count}, parsed ${jobs.length}`);
  }
  return jobs;
}

/** Builds a lock for the corpus as it exists at `commit`. */
export function createLock(commit: string, tag: string, file = 'data/jobs.json'): CorpusLock {
  const full = git(['rev-parse', `${commit}^{commit}`]).toString('utf8').trim();
  const raw = readFromGit(full, file);
  return { commit: full, path: file, sha256: sha256(raw), count: parseJobs(raw).length, tag };
}
