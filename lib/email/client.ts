import { Resend } from 'resend';

let client: Resend | null = null;

export function getResend(): Resend {
  if (!client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY is not set');
    client = new Resend(key);
  }
  return client;
}

/**
 * Sender identity. Override via DIGEST_FROM_EMAIL once a custom domain is
 * verified in Resend. Falls back to Resend's free `onboarding@resend.dev`
 * sender, which works out of the box but can only deliver to the Resend
 * account owner's email address (good enough for dev/test).
 */
export function getFromAddress(): string {
  return process.env.DIGEST_FROM_EMAIL ?? 'Job Cannon <onboarding@resend.dev>';
}
