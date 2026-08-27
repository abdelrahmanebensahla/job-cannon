import { NextResponse } from 'next/server';

import { extractProfile } from '@/lib/ai/extract';
import { rankJobs } from '@/lib/ai/rank';
import { loadJobs, preFilter } from '@/lib/jobs';
import { consumeMatchQuota } from '@/lib/rate-limit';
import type { MatchedJob, Profile } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_PDF_BYTES = 10 * 1024 * 1024;

type MatchResponse =
  | { ok: true; profile: Profile; results: MatchedJob[] }
  | { ok: false; error: string };

function fail(error: string, status = 400): NextResponse<MatchResponse> {
  return NextResponse.json({ ok: false, error }, { status });
}

// A rejected caller should be told when to come back, not just refused.
function rateLimited(error: string): NextResponse<MatchResponse> {
  const res: NextResponse<MatchResponse> = NextResponse.json(
    { ok: false, error },
    { status: 429 },
  );
  res.headers.set('retry-after', String(secondsUntilNextEtMidnight()));
  return res;
}

function secondsUntilNextEtMidnight(now: Date = new Date()): number {
  // Windows roll at ET midnight; 24h is the safe upper bound and the exact
  // figure only matters as a hint, so approximate rather than pull in a tz lib.
  const etNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const secondsIntoDay = etNow.getHours() * 3600 + etNow.getMinutes() * 60 + etNow.getSeconds();
  return Math.max(60, 86_400 - secondsIntoDay);
}

export async function POST(request: Request): Promise<NextResponse<MatchResponse>> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail('invalid_form_data');
  }

  const file = form.get('resume');
  if (!(file instanceof File)) return fail('missing_resume_field');
  if (file.size === 0) return fail('empty_resume');
  if (file.size > MAX_PDF_BYTES) return fail('resume_too_large');
  if (file.type && file.type !== 'application/pdf') return fail('unsupported_media_type');

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!bytes.subarray(0, 4).equals(Buffer.from('%PDF', 'ascii'))) {
    return fail('not_a_pdf');
  }
  const base64Pdf = bytes.toString('base64');

  // Spend guard. Deliberately after validation (a malformed upload costs us
  // nothing, so it shouldn't cost the visitor a preview) and before the first
  // Claude call (which is the only expensive thing here). This is the one
  // place the otherwise DB-free preview path touches Postgres.
  const quota = await consumeMatchQuota(request.headers);
  if (!quota.allowed) {
    return rateLimited(quota.reason === 'global' ? 'daily_capacity_reached' : 'rate_limited');
  }

  let profile: Profile;
  try {
    profile = await extractProfile(base64Pdf);
  } catch (e) {
    console.error('extract failed:', e);
    return fail('extraction_failed', 502);
  }

  const allJobs = await loadJobs();
  const candidates = preFilter(allJobs, profile);

  let results: MatchedJob[];
  try {
    results = await rankJobs(profile, candidates);
  } catch (e) {
    console.error('rank failed:', e);
    return fail('ranking_failed', 502);
  }

  return NextResponse.json({ ok: true, profile, results });
}
