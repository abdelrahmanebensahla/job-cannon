import DailyDigestEmail from '@/emails/daily-digest';
import { appUrl } from '@/lib/app-url';
import { firstNameFromEmail } from './greeting';
import { getFromAddress, getResend } from './client';
import { formatLongDate } from '@/lib/date';
import type { MatchedJob } from '@/lib/types';

type SendDigestArgs = {
  to: string;
  digestDate: string; // YYYY-MM-DD
  jobs: MatchedJob[];
};

export async function sendDigestEmail({ to, digestDate, jobs }: SendDigestArgs) {
  const firstName = firstNameFromEmail(to);
  const dateLabel = formatLongDate(digestDate);
  const subject = `Your ${jobs.length} startup jobs — ${dateLabel}`;
  // Resend v6 returns { data, error } — it does NOT throw on API errors.
  // Promote `error` to a thrown exception so callers' try/catch works.
  const { data, error } = await getResend().emails.send({
    from: getFromAddress(),
    to: [to],
    subject,
    react: DailyDigestEmail({
      firstName,
      dateLabel,
      jobs,
      dashboardUrl: appUrl('/dashboard'),
      billingUrl: appUrl('/dashboard/billing'),
    }),
  });
  if (error) {
    const detail = typeof error === 'object' && error !== null
      ? JSON.stringify(error)
      : String(error);
    throw new Error(`resend_send_failed: ${detail}`);
  }
  return data;
}
