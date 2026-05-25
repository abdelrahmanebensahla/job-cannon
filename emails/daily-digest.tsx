import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from '@react-email/components';

import type { MatchedJob } from '@/lib/types';

type Props = {
  firstName: string;
  dateLabel: string; // e.g. "May 24, 2026"
  jobs: MatchedJob[]; // 10 of them (we render top-3 fat then 7 compact)
  dashboardUrl: string;
  billingUrl: string;
};

function scoreHex(score: number): string {
  if (score >= 75) return '#10b981'; // emerald
  if (score >= 50) return '#f59e0b'; // amber
  return '#f43f5e'; // rose
}

function FatJobCard({ job }: { job: MatchedJob }) {
  return (
    <Section className="mb-4 rounded-lg border border-zinc-200 p-4">
      <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
        <tr>
          <td>
            <Text className="m-0 text-base font-semibold text-zinc-900">{job.title}</Text>
            <Text className="m-0 text-sm text-zinc-600">
              {job.company}
              {job.location ? ` · ${job.location}` : ''}
              {job.remote ? ' · Remote' : ''}
            </Text>
          </td>
          <td align="right" valign="top">
            <span
              style={{
                display: 'inline-block',
                minWidth: 36,
                padding: '2px 8px',
                borderRadius: 999,
                background: scoreHex(job.match_score),
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                lineHeight: '18px',
                textAlign: 'center',
              }}
            >
              {Math.round(job.match_score)}
            </span>
          </td>
        </tr>
      </table>

      <Text className="mt-3 mb-3 text-sm text-zinc-700">{job.reasoning}</Text>

      <Link
        href={job.url}
        className="text-sm font-medium text-zinc-900 underline underline-offset-2"
      >
        View job →
      </Link>
    </Section>
  );
}

function CompactJobRow({ job }: { job: MatchedJob }) {
  return (
    <Section className="border-b border-zinc-100 py-3">
      <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
        <tr>
          <td>
            <Text className="m-0 text-sm font-medium text-zinc-900">
              <Link href={job.url} className="text-zinc-900 underline underline-offset-2">
                {job.title}
              </Link>
            </Text>
            <Text className="m-0 text-xs text-zinc-600">
              {job.company}
              {job.location ? ` · ${job.location}` : ''}
            </Text>
          </td>
          <td align="right" valign="middle" width="48">
            <span
              style={{
                color: scoreHex(job.match_score),
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {Math.round(job.match_score)}
            </span>
          </td>
        </tr>
      </table>
    </Section>
  );
}

export default function DailyDigestEmail({
  firstName,
  dateLabel,
  jobs,
  dashboardUrl,
  billingUrl,
}: Props) {
  const top = jobs.slice(0, 3);
  const rest = jobs.slice(3, 10);
  const preview = `Top match: ${jobs[0]?.title ?? 'no jobs today'} at ${jobs[0]?.company ?? ''}`;

  // <Tailwind> wraps the entire <Html> so it can find the <head> element to
  // inject style tags for non-inlineable utilities. Hover utilities are
  // intentionally absent — most email clients (Outlook, much of webmail)
  // strip them anyway, so static styling is more reliable.
  return (
    <Tailwind>
      <Html>
        <Head />
        <Preview>{preview}</Preview>
        <Body className="bg-zinc-50 font-sans">
          <Container className="mx-auto my-8 max-w-xl rounded-lg bg-white p-6">
            <Heading as="h1" className="m-0 text-xl font-semibold text-zinc-900">
              Good morning, {firstName}
            </Heading>
            <Text className="mt-1 text-sm text-zinc-600">
              {dateLabel} · {jobs.length} startup jobs matched to your resume.
            </Text>

            <Hr className="my-5 border-zinc-200" />

            <Heading
              as="h2"
              className="mt-0 mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500"
            >
              Your top 3
            </Heading>
            {top.map(job => (
              <FatJobCard key={job.id} job={job} />
            ))}

            {rest.length > 0 && (
              <>
                <Heading
                  as="h2"
                  className="mt-6 mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500"
                >
                  Also worth a look
                </Heading>
                <Section>
                  {rest.map(job => (
                    <CompactJobRow key={job.id} job={job} />
                  ))}
                </Section>
              </>
            )}

            <Section className="mt-6 text-center">
              <Button
                href={dashboardUrl}
                className="rounded-md bg-zinc-900 px-5 py-3 text-sm font-medium text-white"
              >
                View all on the dashboard
              </Button>
            </Section>

            <Hr className="mt-8 mb-4 border-zinc-200" />
            <Text className="text-center text-xs text-zinc-500">
              You&apos;re receiving this because you have an active Job Cannon subscription.
              <br />
              <Link
                href={billingUrl}
                className="text-zinc-500 underline underline-offset-2"
              >
                Manage subscription or unsubscribe
              </Link>
            </Text>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}
