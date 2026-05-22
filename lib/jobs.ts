import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { Job, Profile } from './types';
import { JobSchema } from './types';

let JOBS: Job[] | null = null;

export async function loadJobs(): Promise<Job[]> {
  if (JOBS) return JOBS;
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
  JOBS = out;
  return out;
}

export function preFilter(jobs: Job[], profile: Profile): Job[] {
  const topSkills = [...profile.skills]
    .sort((a, b) => b.years - a.years)
    .slice(0, 5)
    .map(s => s.name.toLowerCase());

  let matched: Job[] = [];
  if (topSkills.length > 0) {
    matched = jobs.filter(job => {
      const hay = `${job.title} ${job.description}`.toLowerCase();
      return topSkills.some(skill => skill.length > 0 && hay.includes(skill));
    });
  }

  // Fallback: too few matches → return 50 most recent overall.
  if (matched.length < 10) {
    matched = [...jobs];
  }

  return matched
    .sort((a, b) => b.posted_at.localeCompare(a.posted_at))
    .slice(0, 50);
}
