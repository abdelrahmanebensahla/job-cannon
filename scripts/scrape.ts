import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

import type { Job } from '../lib/types';
import { JobSchema } from '../lib/types';
import { scrape as scrapeGreenhouse } from '../lib/scrapers/greenhouse';
import { scrape as scrapeLever } from '../lib/scrapers/lever';
import { scrape as scrapeRemoteOk } from '../lib/scrapers/remoteok';

const JOBS_PATH = path.join(process.cwd(), 'data', 'jobs.json');
const MAX_AGE_DAYS = 14;

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

async function main() {
  const startedAt = new Date();
  const nowIso = startedAt.toISOString();
  const nowMs = startedAt.getTime();

  console.log(`Scrape started at ${nowIso}`);
  const existing = await loadExisting();
  console.log(`Loaded ${existing.size} existing jobs`);

  const [ghRes, lvRes, roRes] = await Promise.allSettled([
    scrapeGreenhouse(),
    scrapeLever(),
    scrapeRemoteOk(),
  ]);

  const fresh: Job[] = [];
  for (const r of [ghRes, lvRes, roRes]) {
    if (r.status === 'fulfilled') fresh.push(...r.value);
    else console.warn('Source failed:', r.reason instanceof Error ? r.reason.message : r.reason);
  }
  console.log(`Total fresh jobs scraped: ${fresh.length}`);

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

  // Sort: source, then posted_at desc, for diff stability.
  kept.sort((a, b) => {
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return b.posted_at.localeCompare(a.posted_at);
  });

  await writeFile(JOBS_PATH, JSON.stringify(kept, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${kept.length} jobs to ${JOBS_PATH}`);
}

main().catch(err => {
  console.error('Scrape failed:', err);
  process.exit(1);
});
