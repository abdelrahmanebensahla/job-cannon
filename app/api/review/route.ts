import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { reviewResume } from '@/lib/ai/review';
import { ensureUser } from '@/lib/auth/ensure-user';
import { db } from '@/db';
import { hasActiveSubscription, resumeReviews } from '@/db/schema';
import { getCurrentSubscription } from '@/lib/stripe/subscription';
import type { ResumeReview } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_PDF_BYTES = 10 * 1024 * 1024;

type ReviewResponse =
  | { ok: true; review: ResumeReview; filename: string }
  | { ok: false; error: string };

function fail(error: string, status = 400): NextResponse<ReviewResponse> {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request): Promise<NextResponse<ReviewResponse>> {
  const { userId } = await auth();
  if (!userId) return fail('unauthorized', 401);

  // Paid feature — gate the API directly too (the dashboard layout already
  // gates the page, but the route can be called on its own).
  const sub = await getCurrentSubscription(userId);
  if (!hasActiveSubscription(sub)) return fail('not_subscribed', 403);

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

  // FK safety: make sure the local users row exists before inserting.
  try {
    await ensureUser(userId);
  } catch (e) {
    console.error('ensureUser failed:', e);
    if (e instanceof Error && e.message === 'email_conflict') {
      return fail('email_conflict', 409);
    }
    return fail('user_not_provisioned', 500);
  }

  let review: ResumeReview;
  try {
    review = await reviewResume(base64Pdf);
  } catch (e) {
    console.error('review failed:', e);
    return fail('review_failed', 502);
  }

  const filename = file.name || 'resume.pdf';

  // Persist the latest review. If the write fails we still return the result
  // (the user paid for the call) — it just won't be there on the next visit.
  try {
    await db.insert(resumeReviews).values({ userId, filename, review });
  } catch (e) {
    console.error('review persist failed:', e);
  }

  return NextResponse.json({ ok: true, review, filename });
}
