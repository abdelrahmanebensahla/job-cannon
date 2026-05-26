import type { Profile } from '@/lib/types';

export type ResumeApiResponse =
  | { ok: true; resumeId: string; profile: Profile }
  | { ok: false; error: string };

export const RESUME_ERROR_COPY: Record<string, string> = {
  unauthorized: 'Your session expired. Sign in again.',
  missing_resume_field: 'No resume file received. Try again.',
  empty_resume: 'That file looked empty. Try a different PDF.',
  resume_too_large: 'PDF is over 10 MB. Trim it down and retry.',
  unsupported_media_type: 'Only PDF files are supported.',
  not_a_pdf: "That doesn't look like a real PDF.",
  invalid_form_data: 'Could not read the upload. Try again.',
  extraction_failed: "Claude couldn't read enough structure from that resume. Try a cleaner PDF.",
  user_not_provisioned:
    'Your account is still being set up. Refresh and try again in a few seconds.',
  email_conflict:
    'An older account is already using this email. Please contact support to reconcile.',
  resume_insert_failed: "Couldn't save your resume. Please retry.",
  resume_persist_failed: 'A database error stopped your resume from saving. Please retry.',
};
