import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';

import { extractProfile } from '@/lib/ai/extract';
import { ensureUser } from '@/lib/auth/ensure-user';
import { db } from '@/db';
import { resumes } from '@/db/schema';
import type { Profile } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_PDF_BYTES = 10 * 1024 * 1024;

type ResumeResponse =
  | { ok: true; resumeId: string; profile: Profile }
  | { ok: false; error: string };

function fail(error: string, status = 400): NextResponse<ResumeResponse> {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request): Promise<NextResponse<ResumeResponse>> {
  const { userId } = await auth();
  if (!userId) return fail('unauthorized', 401);

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

  // Make sure the user row exists in our DB before inserting into resumes
  // (FK reference). The Clerk webhook normally handles this, but cover the
  // race where someone hits /onboarding before the webhook lands.
  try {
    await ensureUser(userId);
  } catch (e) {
    console.error('ensureUser failed:', e);
    if (e instanceof Error && e.message === 'email_conflict') {
      return fail('email_conflict', 409);
    }
    return fail('user_not_provisioned', 500);
  }

  let profile: Profile;
  try {
    profile = await extractProfile(base64Pdf);
  } catch (e) {
    console.error('extract failed:', e);
    return fail('extraction_failed', 502);
  }

  // Deactivate prior active resumes, then insert the new one as active.
  // Both happen in a single round trip per statement; Neon HTTP doesn't
  // support multi-statement transactions, so we accept the brief window
  // where two rows are active. The /onboarding flow is single-user and
  // resumes are referenced via isActive=true filters everywhere.
  //
  // Superseding also clears `fileData`: we keep a stored PDF only for the
  // resume currently driving digests and review, never a history of every
  // document a user has uploaded. The privacy policy states this, so it has
  // to actually happen here. Extraction above already succeeded, so the old
  // PDF is genuinely no longer needed.
  try {
    await db
      .update(resumes)
      .set({ isActive: false, fileData: null })
      .where(and(eq(resumes.userId, userId), eq(resumes.isActive, true)));

    const [inserted] = await db
      .insert(resumes)
      .values({
        userId,
        filename: file.name || 'resume.pdf',
        profile,
        // Keep the raw PDF (base64) so resume review can read the full
        // document. Extraction above is unchanged.
        fileData: base64Pdf,
        isActive: true,
      })
      .returning({ id: resumes.id });

    if (!inserted) return fail('resume_insert_failed', 500);

    return NextResponse.json({ ok: true, resumeId: inserted.id, profile });
  } catch (e) {
    console.error('resume persist failed:', e);
    return fail('resume_persist_failed', 500);
  }
}
