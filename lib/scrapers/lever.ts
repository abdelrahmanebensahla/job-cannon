import type { Job } from '../types';
import { stripHtml } from './html';
import { LEVER_COMPANIES } from './lever-companies';

type LeverPosting = {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  createdAt: number;
  workplaceType?: 'remote' | 'on-site' | 'hybrid' | 'unspecified';
  categories?: {
    location?: string;
    allLocations?: string[];
    commitment?: string;
    team?: string;
    department?: string;
  };
  description?: string;
  descriptionPlain?: string;
  additional?: string;
  additionalPlain?: string;
  lists?: { text: string; content: string }[];
};

const REMOTE_RE = /\bremote\b|\banywhere\b|\bworldwide\b|\bvirtual\b/i;

function buildDescription(p: LeverPosting): string {
  const parts: string[] = [];
  if (p.descriptionPlain) parts.push(p.descriptionPlain);
  else if (p.description) parts.push(stripHtml(p.description));
  if (p.lists?.length) {
    for (const l of p.lists) {
      parts.push(l.text);
      parts.push(stripHtml(l.content));
    }
  }
  if (p.additionalPlain) parts.push(p.additionalPlain);
  else if (p.additional) parts.push(stripHtml(p.additional));
  const joined = parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  return joined.length > 4000 ? joined.slice(0, 4000) : joined;
}

async function fetchBoard(slug: string, name: string, signal: AbortSignal): Promise<Job[]> {
  const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
  const res = await fetch(url, { signal, headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as LeverPosting[];
  if (!Array.isArray(data)) return [];
  return data.map(p => {
    const loc = p.categories?.location?.trim() || null;
    const remote =
      p.workplaceType === 'remote' ||
      (loc ? REMOTE_RE.test(loc) : false) ||
      (p.categories?.allLocations?.some(l => REMOTE_RE.test(l)) ?? false);
    return {
      id: `lever:${p.id}`,
      source: 'lever' as const,
      company: name,
      title: p.text,
      location: loc,
      remote,
      description: buildDescription(p),
      url: p.hostedUrl,
      posted_at: new Date(p.createdAt).toISOString(),
    };
  });
}

export async function scrape(): Promise<Job[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const settled = await Promise.allSettled(
      LEVER_COMPANIES.map(c => fetchBoard(c.slug, c.name, controller.signal)),
    );
    const out: Job[] = [];
    let okCount = 0;
    for (let i = 0; i < settled.length; i++) {
      const s = settled[i];
      const c = LEVER_COMPANIES[i];
      if (s.status === 'fulfilled') {
        okCount++;
        out.push(...s.value);
      } else {
        console.warn(`[lever] ${c.slug} failed:`, s.reason instanceof Error ? s.reason.message : s.reason);
      }
    }
    console.log(`[lever] ${okCount}/${LEVER_COMPANIES.length} boards ok, ${out.length} jobs`);
    return out;
  } finally {
    clearTimeout(timeout);
  }
}
