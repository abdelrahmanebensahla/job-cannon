import type { Job } from '../types';
import { stripHtml } from './html';

type RemoteOkLegal = { legal: string };

type RemoteOkJob = {
  id: string | number;
  slug?: string;
  company?: string;
  position?: string;
  description?: string;
  location?: string;
  url?: string;
  apply_url?: string;
  date?: string;
  epoch?: number;
  tags?: string[];
};

type RemoteOkResponse = (RemoteOkLegal | RemoteOkJob)[];

function isJob(item: RemoteOkLegal | RemoteOkJob): item is RemoteOkJob {
  return !('legal' in item) && 'id' in item && item.id !== undefined;
}

export async function scrape(): Promise<Job[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch('https://remoteok.com/api', {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        // RemoteOK 403s without a UA.
        'user-agent': 'Mozilla/5.0 (compatible; JobCannon/0.1; +https://github.com/)',
      },
    });
    if (!res.ok) {
      console.warn(`[remoteok] HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as RemoteOkResponse;
    if (!Array.isArray(data)) return [];

    const out: Job[] = [];
    for (const item of data) {
      if (!isJob(item)) continue;
      if (!item.company || !item.position) continue;

      const id = String(item.id);
      const loc = item.location?.trim() || null;
      const isoDate = item.date
        ? new Date(item.date).toISOString()
        : item.epoch
          ? new Date(item.epoch * 1000).toISOString()
          : new Date().toISOString();

      out.push({
        id: `remoteok:${id}`,
        source: 'remoteok',
        company: item.company,
        title: item.position,
        location: loc,
        remote: true,
        description: stripHtml(item.description ?? ''),
        url: item.url || (item.slug ? `https://remoteok.com/remote-jobs/${item.slug}` : `https://remoteok.com/remote-jobs/${id}`),
        posted_at: isoDate,
      });
    }
    console.log(`[remoteok] ${out.length} jobs`);
    return out;
  } catch (e) {
    console.warn('[remoteok] failed:', e instanceof Error ? e.message : e);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
