import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { and, eq, gt, gte, inArray, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { dailyDigests, resumes, subscriptions, users } from '@/db/schema';
import { rankJobs } from '@/lib/ai/rank';
import { loadJobs, preFilter } from '@/lib/jobs';
import { daysAgoInET, todayInET } from '@/lib/date';
import { sendDigestEmail } from '@/lib/email/send-digest';
import { pruneExpiredRateLimits } from '@/lib/rate-limit';
import { pruneExpiredDigests } from '@/lib/retention';
import type { MatchedJob, Profile } from '@/lib/types';

export const runtime = 'nodejs';
// Vercel Pro: 300s. On Hobby this is capped at 60s — if you're on Hobby
// either upgrade or drop the ranking pool further / batch users across
// multiple cron invocations (out of scope for v1).
export const maxDuration = 300;

const RANK_CANDIDATE_POOL = 30; // smaller than MVP's 50 — per-user cost matters
const CONCURRENCY = 5;

/**
 * How far back to look when excluding jobs a subscriber has already been sent.
 * Without this the digest re-serves yesterday's list: the corpus turns over
 * slowly, the profile doesn't change, and preFilter is deterministic.
 */
const DEDUPE_WINDOW_DAYS = 14;

type Eligible = { userId: string; email: string; profile: Profile };

type UserStatus = 'sent' | 'resent' | 'skipped' | 'inserted_no_email' | 'error';

// Deliberately carries no email address: this payload is returned to whoever
// holds CRON_SECRET and echoed into Vercel's logs. userId identifies the row
// without putting the whole subscriber list into log retention.
type CronUserResult = {
  userId: string;
  status: UserStatus;
  error?: string;
};

type CronResponse =
  | {
      ok: true;
      processed: number;
      sent: number;
      resent: number;
      errors: number;
      skipped: number;
      pruned: number;
      digestDate: string;
      details: CronUserResult[];
    }
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
    // Mirror hasActiveSubscription (db/schema.ts): trialing/active qualify, and
    // a canceled sub whose paid period hasn't elapsed still qualifies — they
    // paid through currentPeriodEnd, so they keep getting digests until then.
    .where(
      or(
        inArray(subscriptions.status, ['trialing', 'active']),
        and(eq(subscriptions.status, 'canceled'), gt(subscriptions.currentPeriodEnd, new Date())),
      ),
    );

  // A user with multiple active subs (rare but possible) shows up multiple
  // times. Collapse to one row per userId.
  const seen = new Map<string, Eligible>();
  for (const r of rows) {
    if (!seen.has(r.userId)) seen.set(r.userId, r as Eligible);
  }
  return [...seen.values()];
}

/**
 * Job ids this user has been sent recently. Unnested in Postgres rather than
 * pulled over the wire — the ids are a few KB, the digests holding them are
 * megabytes of JSONB.
 */
async function recentlySentJobIds(userId: string): Promise<Set<string>> {
  const cutoff = daysAgoInET(DEDUPE_WINDOW_DAYS);
  const rows = await db
    .select({ id: sql<string>`jsonb_array_elements(${dailyDigests.jobs})->>'id'` })
    .from(dailyDigests)
    .where(and(eq(dailyDigests.userId, userId), gte(dailyDigests.digestDate, cutoff)));
  return new Set(rows.map(r => r.id).filter(Boolean));
}

async function markSent(id: string): Promise<void> {
  await db.update(dailyDigests).set({ sentAt: new Date() }).where(eq(dailyDigests.id, id));
}

async function processUser(
  user: Eligible,
  allJobs: Awaited<ReturnType<typeof loadJobs>>,
  digestDate: string,
): Promise<{ status: UserStatus; error?: string }> {
  // 1. Idempotency — but only a digest that actually *reached* the subscriber
  //    counts as done. A row with sentAt = null means the ranking survived and
  //    the email didn't, so re-attempt the send from the stored jobs (no
  //    re-rank; we already paid for it). Previously the mere existence of the
  //    row made every later run skip the user, and they lost that day for good.
  const [existing] = await db
    .select({ id: dailyDigests.id, sentAt: dailyDigests.sentAt, jobs: dailyDigests.jobs })
    .from(dailyDigests)
    .where(and(eq(dailyDigests.userId, user.userId), eq(dailyDigests.digestDate, digestDate)))
    .limit(1);

  if (existing?.sentAt) return { status: 'skipped' };

  if (existing) {
    try {
      await sendDigestEmail({ to: user.email, digestDate, jobs: existing.jobs as MatchedJob[] });
      await markSent(existing.id);
      return { status: 'resent' };
    } catch (e) {
      return { status: 'inserted_no_email', error: e instanceof Error ? e.message : 'unknown' };
    }
  }

  // 2. Pre-filter + rank, excluding what they've already seen this fortnight.
  let exclude: Set<string>;
  try {
    exclude = await recentlySentJobIds(user.userId);
  } catch (e) {
    // Dedupe is a quality feature, not a correctness one — a lookup failure
    // should degrade to a possibly-repetitive digest, not to no digest at all.
    console.warn(`[cron] dedupe lookup failed for user ${user.userId}:`, e);
    exclude = new Set();
  }

  const candidates = preFilter(allJobs, user.profile, exclude).slice(0, RANK_CANDIDATE_POOL);

  let ranked: MatchedJob[];
  try {
    ranked = await rankJobs(user.profile, candidates);
  } catch (e) {
    return { status: 'error', error: `rank_failed:${e instanceof Error ? e.message : 'unknown'}` };
  }
  const top10 = ranked.slice(0, 10);

  // 3. Persist before sending, so a failed email leaves recoverable work
  //    rather than discarding a ranking we already paid Claude for.
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
    await markSent(insertedId);
    return { status: 'sent' };
  } catch (e) {
    console.error(`Email send failed for user ${user.userId}:`, e);
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

/**
 * Retention sweep. Enforces the 30-day promise in the privacy policy and
 * clears spent rate-limit counters. Never allowed to fail the run — it comes
 * after every send, so a prune error can't cost anyone their digest.
 */
async function prune(): Promise<number> {
  try {
    const pruned = await pruneExpiredDigests();
    await pruneExpiredRateLimits();
    return pruned;
  } catch (e) {
    console.error('[cron] prune failed:', e);
    return 0;
  }
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
      resent: 0,
      errors: 0,
      skipped: 0,
      pruned: await prune(),
      digestDate,
      details: [],
    });
  }

  const allJobs = await loadJobs();

  const rawResults = await runWithConcurrency(subscribers, CONCURRENCY, async user => {
    try {
      const r = await processUser(user, allJobs, digestDate);
      return { userId: user.userId, ...r };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      console.error(`processUser threw for user ${user.userId}:`, e);
      return { userId: user.userId, status: 'error' as const, error: msg };
    }
  });

  const details: CronUserResult[] = rawResults.map(r => ({
    userId: r.userId,
    status: r.status,
    error: r.error,
  }));

  const sent = details.filter(r => r.status === 'sent').length;
  const resent = details.filter(r => r.status === 'resent').length;
  const skipped = details.filter(r => r.status === 'skipped').length;
  const errors = details.filter(r => r.status === 'error' || r.status === 'inserted_no_email').length;

  const pruned = await prune();

  const ms = Date.now() - startedAt;
  console.log(
    `[cron] processed=${subscribers.length} sent=${sent} resent=${resent} skipped=${skipped} errors=${errors} pruned=${pruned} in ${ms}ms`,
  );

  return NextResponse.json({
    ok: true,
    processed: subscribers.length,
    sent,
    resent,
    errors,
    skipped,
    pruned,
    digestDate,
    details,
  });
}

/**
 * Constant-time bearer check. The plain `===` it replaces was never a
 * realistic timing attack over HTTPS, but `timingSafeEqual` costs nothing and
 * removes the question. Lengths are compared first — it throws on a mismatch.
 */
function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = request.headers.get('authorization');
  if (!header) return false;

  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${expected}`);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
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
