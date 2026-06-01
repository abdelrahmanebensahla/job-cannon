import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { and, desc, eq } from 'drizzle-orm';

import { reviewResume } from '@/lib/ai/review';
import { db } from '@/db';
import { hasActiveSubscription, resumeReviews, resumes } from '@/db/schema';
import { getCurrentSubscription } from '@/lib/stripe/subscription';
import type { ResumeReview } from '@/lib/types';

export const runtime = 'nodejs';
// One Claude call over the (small) stored profile — fast. Headroom over the
// occasional retry; clamped to the plan max on Vercel.
export const maxDuration = 120;

type ReviewResponse =
  | { ok: true; review: ResumeReview; filename: string }
  | { ok: false; error: string };

function fail(error: string, status = 400): NextResponse<ReviewResponse> {
  return NextResponse.json({ ok: false, error }, { status });
}

// Reviews the user's *active* resume profile — no upload. We never stored the
// PDF, so this works from the structured profile we extracted at upload time.
export async function POST(): Promise<NextResponse<ReviewResponse>> {
  const { userId } = await auth();
  if (!userId) return fail('unauthorized', 401);

  // Paid feature — gate the API directly too (the dashboard layout gates the
  // page, but the route can be called on its own).
  const sub = await getCurrentSubscription(userId);
  if (!hasActiveSubscription(sub)) return fail('not_subscribed', 403);

  const [active] = await db
    .select({ filename: resumes.filename, profile: resumes.profile })
    .from(resumes)
    .where(and(eq(resumes.userId, userId), eq(resumes.isActive, true)))
    .orderBy(desc(resumes.createdAt))
    .limit(1);
  if (!active) return fail('no_active_resume', 400);

  let review: ResumeReview;
  try {
    review = await reviewResume(active.profile);
  } catch (e) {
    console.error('review failed:', e);
    return fail('review_failed', 502);
  }

  // Persist the latest review. If the write fails we still return the result
  // (the user paid for the call) — it just won't be there on the next visit.
  try {
    await db.insert(resumeReviews).values({ userId, filename: active.filename, review });
  } catch (e) {
    console.error('review persist failed:', e);
  }

  return NextResponse.json({ ok: true, review, filename: active.filename });
}
