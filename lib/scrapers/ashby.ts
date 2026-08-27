import type { Job } from '../types';
import { stripHtml } from './html';
import { ASHBY_COMPANIES } from './ashby-companies';

/**
 * Ashby's public job-board API. Added 2026-08-27 because it's where the
 * startup end of the market actually lives now — OpenAI, Supabase, Linear,
 * Ramp, Notion, Cursor, ElevenLabs and Harvey had all migrated off the
 * Greenhouse/Lever slugs this repo was still asking for.
 *
 * Two things it does better than the other two sources:
 *   - `descriptionPlain` is already plain text, so no HTML stripping.
 *   - `publishedAt` is a real publication date. Greenhouse only exposes
 *     `updated_at`, which makes an edited old posting look brand new.
 */

type AshbyPosting = {
  id: string;
  title: string;
  location?: string | null;
  secondaryLocations?: { location?: string }[];
  isRemote?: boolean;
  isListed?: boolean;
  workplaceType?: string;
  publishedAt?: string;
  jobUrl?: string;
  applyUrl?: string;
  descriptionPlain?: string;
  descriptionHtml?: string;
};

type AshbyResponse = { jobs?: AshbyPosting[] };

const REMOTE_RE = /\bremote\b|\banywhere\b|\bworldwide\b|\bvirtual\b/i;
const MAX_DESCRIPTION = 4000;

function description(p: AshbyPosting): string {
  if (p.descriptionPlain) {
    const s = p.descriptionPlain.replace(/\n{3,}/g, '\n\n').trim();
    return s.length > MAX_DESCRIPTION ? s.slice(0, MAX_DESCRIPTION) : s;
  }
  return stripHtml(p.descriptionHtml ?? '', MAX_DESCRIPTION);
}

function isRemote(p: AshbyPosting): boolean {
  if (p.isRemote === true) return true;
  if (p.workplaceType && REMOTE_RE.test(p.workplaceType)) return true;
  if (p.location && REMOTE_RE.test(p.location)) return true;
  return (p.secondaryLocations ?? []).some(l => l.location && REMOTE_RE.test(l.location));
}

async function fetchBoard(slug: string, name: string, signal: AbortSignal): Promise<Job[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
  const res = await fetch(url, { signal, headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as AshbyResponse;
  if (!Array.isArray(data.jobs)) return [];

  const out: Job[] = [];
  for (const p of data.jobs) {
    // Ashby returns unlisted postings too; those aren't publicly applicable.
    if (p.isListed === false) continue;
    if (!p.id || !p.title) continue;
    const loc = p.location?.trim() || null;
    out.push({
      id: `ashby:${slug}:${p.id}`,
      source: 'ashby',
      company: name,
      title: p.title,
      location: loc,
      remote: isRemote(p),
      description: description(p),
      url: p.jobUrl || p.applyUrl || `https://jobs.ashbyhq.com/${slug}/${p.id}`,
      posted_at: p.publishedAt ?? new Date().toISOString(),
    });
  }
  return out;
}

export async function scrape(): Promise<Job[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const settled = await Promise.allSettled(
      ASHBY_COMPANIES.map(c => fetchBoard(c.slug, c.name, controller.signal)),
    );
    const out: Job[] = [];
    let okCount = 0;
    for (let i = 0; i < settled.length; i++) {
      const s = settled[i];
      const c = ASHBY_COMPANIES[i];
      if (s.status === 'fulfilled') {
        okCount++;
        out.push(...s.value);
      } else {
        console.warn(
          `[ashby] ${c.slug} failed:`,
          s.reason instanceof Error ? s.reason.message : s.reason,
        );
      }
    }
    console.log(`[ashby] ${okCount}/${ASHBY_COMPANIES.length} boards ok, ${out.length} jobs`);
    return out;
  } finally {
    clearTimeout(timeout);
  }
}
