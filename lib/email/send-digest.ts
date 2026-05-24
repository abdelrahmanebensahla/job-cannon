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
  return getResend().emails.send({
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
}
