import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { Job, Profile } from './types';
import { JobSchema } from './types';

let JOBS: Job[] | null = null;
let JOBS_PROMISE: Promise<Job[]> | null = null;

const CANDIDATE_LIMIT = 50;
const MIN_SKILL_MATCHES = 10;

async function readJobs(): Promise<Job[]> {
  const file = path.join(process.cwd(), 'data', 'jobs.json');
  const raw = await readFile(file, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('data/jobs.json is not an array');
  }
  const out: Job[] = [];
  for (const item of parsed) {
    const r = JobSchema.safeParse(item);
    if (r.success) out.push(r.data);
  }
  return out;
}

export async function loadJobs(): Promise<Job[]> {
  if (JOBS) return JOBS;
  // Share one read across concurrent callers. Without this, several requests
  // arriving on a cold lambda each parse the same ~25 MB file — the cache is
  // only populated after the await, so they all miss.
  JOBS_PROMISE ??= readJobs().then(
    jobs => {
      JOBS = jobs;
      JOBS_PROMISE = null;
      return jobs;
    },
    err => {
      JOBS_PROMISE = null;
      throw err;
    },
  );
  return JOBS_PROMISE;
}

export type JobsMeta = {
  count: number;
  companies: number;
  sources: string[];
  generatedAt: string;
};

let META: JobsMeta | null = null;

/**
 * Corpus stats from the sidecar `data/jobs-meta.json` written by the scrape.
 *
 * Exists so a page that only wants to print "ranked from N roles" doesn't read
 * and parse the whole ~44 MB corpus to call `.length` on it. Returns null when
 * the sidecar is missing (a checkout that hasn't scraped yet) — callers must
 * treat the stat line as optional, never as a hard dependency.
 */
export async function loadJobsMeta(): Promise<JobsMeta | null> {
  if (META) return META;
  try {
    const file = path.join(process.cwd(), 'data', 'jobs-meta.json');
    const parsed = JSON.parse(await readFile(file, 'utf8')) as JobsMeta;
    if (typeof parsed?.count !== 'number') return null;
    META = parsed;
    return META;
  } catch {
    return null;
  }
}

/**
 * Compares real instants. The sources disagree on ISO format — Greenhouse and
 * Ashby emit UTC offsets (`...-04:00`), Lever and RemoteOK emit `Z` — so a
 * lexical compare interleaves them incorrectly. Mirrors `byPostedAtDesc` in
 * scripts/scrape.ts.
 */
function byPostedAtDesc(a: Job, b: Job): number {
  return (Date.parse(b.posted_at) || 0) - (Date.parse(a.posted_at) || 0);
}

/**
 * Narrow the corpus to the jobs worth paying Claude to rank.
 *
 * Keyword match on the candidate's top-5 skills, most recent first. If that
 * turns up too few, the shortfall is topped up with the most recent remaining
 * jobs — the matches are kept, not discarded, which is what the old
 * "fall back to the 50 newest overall" branch used to do.
 *
 * `excludeIds` drops jobs the user has already been sent, so a daily digest
 * doesn't re-serve yesterday's list against a corpus that turns over slowly.
 */
export function preFilter(
  jobs: Job[],
  profile: Profile,
  excludeIds?: ReadonlySet<string>,
): Job[] {
  const pool =
    excludeIds && excludeIds.size > 0 ? jobs.filter(j => !excludeIds.has(j.id)) : jobs;

  const topSkills = [...profile.skills]
    .sort((a, b) => b.years - a.years)
    .slice(0, 5)
    .map(s => s.name.toLowerCase())
    .filter(s => s.length > 0);

  const matched: Job[] = [];
  const rest: Job[] = [];
  for (const job of pool) {
    const hay = `${job.title} ${job.description}`.toLowerCase();
    if (topSkills.some(skill => hay.includes(skill))) matched.push(job);
    else rest.push(job);
  }

  matched.sort(byPostedAtDesc);
  if (matched.length >= CANDIDATE_LIMIT) return matched.slice(0, CANDIDATE_LIMIT);

  // Thin skill match — keep every hit, then pad with the freshest of the rest
  // so Claude always sees a full slate to rank.
  if (matched.length < MIN_SKILL_MATCHES || matched.length < CANDIDATE_LIMIT) {
    rest.sort(byPostedAtDesc);
    return [...matched, ...rest].slice(0, CANDIDATE_LIMIT);
  }

  return matched.slice(0, CANDIDATE_LIMIT);
}
