import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { dailyDigests, resumes, subscriptions, users } from '@/db/schema';
import { rankJobs } from '@/lib/ai/rank';
import { loadJobs, preFilter } from '@/lib/jobs';
import { todayInET } from '@/lib/date';
import { sendDigestEmail } from '@/lib/email/send-digest';
import type { MatchedJob, Profile } from '@/lib/types';

export const runtime = 'nodejs';
// Vercel Pro: 300s. On Hobby this is capped at 60s — if you're on Hobby
// either upgrade or drop the ranking pool further / batch users across
// multiple cron invocations (out of scope for v1).
export const maxDuration = 300;

const RANK_CANDIDATE_POOL = 30; // smaller than MVP's 50 — per-user cost matters
const CONCURRENCY = 5;

type Eligible = { userId: string; email: string; profile: Profile };

type CronResponse =
  | { ok: true; processed: number; sent: number; errors: number; skipped: number; digestDate: string }
  | { ok: false; error: string };

function fail(error: string, status = 400): NextResponse<CronResponse> {
  return NextResponse.json({ ok: false, error }, { status });
}

async function eligibleSubscribers(): Promise<Eligible[]> {
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      profile: resumes.profile,
    })
    .from(users)
    .innerJoin(subscriptions, eq(subscriptions.userId, users.id))
    .innerJoin(resumes, and(eq(resumes.userId, users.id), eq(resumes.isActive, true)))
    .where(inArray(subscriptions.status, ['trialing', 'active']));

  // A user with multiple active subs (rare but possible) shows up multiple
  // times. Collapse to one row per userId.
  const seen = new Map<string, Eligible>();
  for (const r of rows) {
    if (!seen.has(r.userId)) seen.set(r.userId, r as Eligible);
  }
  return [...seen.values()];
}

async function processUser(
  user: Eligible,
  allJobs: Awaited<ReturnType<typeof loadJobs>>,
  digestDate: string,
): Promise<{ status: 'skipped' | 'sent' | 'inserted_no_email' | 'error'; error?: string }> {
  // 1. Idempotency.
  const existing = await db
    .select({ id: dailyDigests.id })
    .from(dailyDigests)
    .where(and(eq(dailyDigests.userId, user.userId), eq(dailyDigests.digestDate, digestDate)))
    .limit(1);
  if (existing[0]) return { status: 'skipped' };

  // 2. Pre-filter + rank.
  const candidates = preFilter(allJobs, user.profile).slice(0, RANK_CANDIDATE_POOL);

  let ranked: MatchedJob[];
  try {
    ranked = await rankJobs(user.profile, candidates);
  } catch (e) {
    return { status: 'error', error: `rank_failed:${e instanceof Error ? e.message : 'unknown'}` };
  }
  const top10 = ranked.slice(0, 10);

  // 3. Persist the digest row before attempting to email. Persist-then-send
  // makes idempotency simple: a retry after a send failure won't re-rank,
  // it'll just re-attempt the email (still TODO; for now, sentAt stays null
  // and the user just sees an unsent digest in the dashboard).
  let insertedId: string;
  try {
    const [inserted] = await db
      .insert(dailyDigests)
      .values({ userId: user.userId, digestDate, jobs: top10 })
      .onConflictDoNothing({ target: [dailyDigests.userId, dailyDigests.digestDate] })
      .returning({ id: dailyDigests.id });
    if (!inserted) return { status: 'skipped' }; // someone else won the race
    insertedId = inserted.id;
  } catch (e) {
    return { status: 'error', error: `insert_failed:${e instanceof Error ? e.message : 'unknown'}` };
  }

  // 4. Send email + mark sentAt.
  try {
    await sendDigestEmail({ to: user.email, digestDate, jobs: top10 });
    await db
      .update(dailyDigests)
      .set({ sentAt: new Date() })
      .where(eq(dailyDigests.id, insertedId));
    return { status: 'sent' };
  } catch (e) {
    console.error(`Email send failed for ${user.email}:`, e);
    return { status: 'inserted_no_email', error: e instanceof Error ? e.message : 'unknown' };
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function next(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
  return results;
}

async function run(): Promise<NextResponse<CronResponse>> {
  const digestDate = todayInET();
  const startedAt = Date.now();

  const subscribers = await eligibleSubscribers();
  console.log(`[cron] ${subscribers.length} eligible subscribers for ${digestDate}`);

  if (subscribers.length === 0) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      sent: 0,
      errors: 0,
      skipped: 0,
      digestDate,
    });
  }

  const allJobs = await loadJobs();

  const results = await runWithConcurrency(subscribers, CONCURRENCY, user =>
    processUser(user, allJobs, digestDate).catch(e => ({
      status: 'error' as const,
      error: e instanceof Error ? e.message : 'unknown',
    })),
  );

  const sent = results.filter(r => r.status === 'sent').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const errors = results.filter(r => r.status === 'error' || r.status === 'inserted_no_email').length;
  const ms = Date.now() - startedAt;
  console.log(`[cron] processed=${subscribers.length} sent=${sent} skipped=${skipped} errors=${errors} in ${ms}ms`);

  return NextResponse.json({
    ok: true,
    processed: subscribers.length,
    sent,
    errors,
    skipped,
    digestDate,
  });
}

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = request.headers.get('authorization');
  return header === `Bearer ${expected}`;
}

export async function GET(request: Request): Promise<NextResponse<CronResponse>> {
  if (!authorized(request)) return fail('unauthorized', 401);
  return run();
}

// Vercel Cron sends GET by default but accept POST too for manual triggers.
export async function POST(request: Request): Promise<NextResponse<CronResponse>> {
  if (!authorized(request)) return fail('unauthorized', 401);
  return run();
}
