import type { Job } from '../types';
import { stripHtml } from './html';
import { GREENHOUSE_COMPANIES } from './greenhouse-companies';

type GreenhouseLocation = { name?: string } | null;

type GreenhouseJob = {
  id: number;
  title: string;
  absolute_url: string;
  location: GreenhouseLocation;
  updated_at: string;
  content: string;
};

type GreenhouseResponse = {
  jobs: GreenhouseJob[];
};

const REMOTE_RE = /\bremote\b|\banywhere\b|\bworldwide\b|\bvirtual\b/i;

async function fetchBoard(slug: string, name: string, signal: AbortSignal): Promise<Job[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
  const res = await fetch(url, { signal, headers: { accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = (await res.json()) as GreenhouseResponse;
  if (!data || !Array.isArray(data.jobs)) return [];
  return data.jobs.map(j => {
    const loc = j.location?.name?.trim() || null;
    return {
      id: `greenhouse:${j.id}`,
      source: 'greenhouse' as const,
      company: name,
      title: j.title,
      location: loc,
      remote: loc ? REMOTE_RE.test(loc) : false,
      description: stripHtml(j.content),
      url: j.absolute_url,
      posted_at: j.updated_at,
    };
  });
}

export async function scrape(): Promise<Job[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const settled = await Promise.allSettled(
      GREENHOUSE_COMPANIES.map(c => fetchBoard(c.slug, c.name, controller.signal)),
    );
    const out: Job[] = [];
    let okCount = 0;
    for (let i = 0; i < settled.length; i++) {
      const s = settled[i];
      const c = GREENHOUSE_COMPANIES[i];
      if (s.status === 'fulfilled') {
        okCount++;
        out.push(...s.value);
      } else {
        console.warn(`[greenhouse] ${c.slug} failed:`, s.reason instanceof Error ? s.reason.message : s.reason);
      }
    }
    console.log(`[greenhouse] ${okCount}/${GREENHOUSE_COMPANIES.length} boards ok, ${out.length} jobs`);
    return out;
  } finally {
    clearTimeout(timeout);
  }
}
