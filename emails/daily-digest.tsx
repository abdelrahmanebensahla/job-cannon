import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

import type { MatchedJob } from '@/lib/types';

type Props = {
  firstName: string;
  dateLabel: string; // e.g. "May 24, 2026"
  jobs: MatchedJob[]; // 10 of them (we render top-3 detailed then 7 compact)
  dashboardUrl: string;
  billingUrl: string;
};

const COLORS = {
  bg: '#FFFFFF',
  fg: '#0A0A0A',
  muted: '#737373',
  border: '#E5E5E5',
} as const;

// Email-safe font stacks. Newsreader → Georgia; Geist → -apple-system.
const DISPLAY_FONT =
  '"Newsreader", Georgia, "Times New Roman", serif';
const BODY_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif';

const styles = {
  body: {
    backgroundColor: COLORS.bg,
    color: COLORS.fg,
    fontFamily: BODY_FONT,
    margin: 0,
    padding: 0,
    WebkitFontSmoothing: 'antialiased' as const,
  },
  container: {
    width: '100%',
    maxWidth: '560px',
    margin: '0 auto',
    padding: '32px 24px 48px',
  },
  greeting: {
    fontFamily: DISPLAY_FONT,
    fontSize: '32px',
    lineHeight: '1.1',
    letterSpacing: '-0.02em',
    margin: '0',
    color: COLORS.fg,
  },
  metaLine: {
    fontSize: '13px',
    color: COLORS.muted,
    margin: '8px 0 0',
  },
  eyebrow: {
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: COLORS.muted,
    margin: '40px 0 16px',
  },
  divider: {
    border: 'none',
    borderTop: `1px solid ${COLORS.border}`,
    margin: '32px 0',
  },
  jobBlock: {
    padding: '24px 0',
    borderTop: `1px solid ${COLORS.border}`,
  },
  jobBlockFirst: {
    padding: '0 0 24px',
  },
  company: {
    fontFamily: DISPLAY_FONT,
    fontSize: '20px',
    lineHeight: '1.2',
    letterSpacing: '-0.01em',
    margin: '0',
    color: COLORS.fg,
  },
  jobMeta: {
    fontSize: '13px',
    color: COLORS.muted,
    margin: '4px 0 0',
  },
  jobTitle: {
    fontSize: '15px',
    color: COLORS.fg,
    margin: '6px 0 0',
  },
  reasoning: {
    fontSize: '14px',
    lineHeight: '1.55',
    color: COLORS.fg,
    margin: '12px 0 0',
    whiteSpace: 'pre-line' as const,
  },
  score: {
    fontFamily: DISPLAY_FONT,
    fontSize: '32px',
    lineHeight: '1',
    letterSpacing: '-0.02em',
    color: COLORS.fg,
    fontVariantNumeric: 'tabular-nums' as const,
    textAlign: 'right' as const,
  },
  scoreLabel: {
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: COLORS.muted,
    margin: '4px 0 0',
    textAlign: 'right' as const,
  },
  applyLink: {
    fontSize: '13px',
    fontWeight: 500,
    color: COLORS.fg,
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
    margin: '12px 0 0',
    display: 'inline-block',
  },
  compactRow: {
    padding: '14px 0',
    borderTop: `1px solid ${COLORS.border}`,
  },
  compactTitle: {
    fontSize: '14px',
    color: COLORS.fg,
    margin: '0',
  },
  compactMeta: {
    fontSize: '12px',
    color: COLORS.muted,
    margin: '2px 0 0',
  },
  compactScore: {
    fontSize: '14px',
    fontWeight: 600,
    color: COLORS.fg,
    fontVariantNumeric: 'tabular-nums' as const,
  },
  cta: {
    display: 'inline-block',
    backgroundColor: COLORS.fg,
    color: COLORS.bg,
    padding: '12px 20px',
    fontSize: '13px',
    fontWeight: 500,
    textDecoration: 'none',
    margin: '32px 0 0',
  },
  footer: {
    margin: '48px 0 0',
    paddingTop: '24px',
    borderTop: `1px solid ${COLORS.border}`,
    fontSize: '12px',
    color: COLORS.muted,
    lineHeight: '1.6',
    textAlign: 'center' as const,
  },
  footerLink: {
    color: COLORS.muted,
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  },
};

function DetailedJob({ job, first }: { job: MatchedJob; first: boolean }) {
  return (
    <Section style={first ? styles.jobBlockFirst : styles.jobBlock}>
      <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
        <tr>
          <td style={{ verticalAlign: 'top' }}>
            <Heading as="h3" style={styles.company}>
              {job.company}
            </Heading>
            <Text style={styles.jobMeta}>
              {job.location ?? '—'}
              {job.remote ? ' · Remote' : ''}
            </Text>
            <Text style={styles.jobTitle}>{job.title}</Text>
          </td>
          <td style={{ verticalAlign: 'top', width: '72px' }}>
            <div style={styles.score}>{Math.round(job.match_score)}</div>
            <div style={styles.scoreLabel}>match</div>
          </td>
        </tr>
      </table>
      <Text style={styles.reasoning}>{job.reasoning}</Text>
      <Link href={job.url} style={styles.applyLink}>
        Apply ↗
      </Link>
    </Section>
  );
}

function CompactJob({ job }: { job: MatchedJob }) {
  return (
    <Section style={styles.compactRow}>
      <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
        <tr>
          <td>
            <Text style={styles.compactTitle}>
              <Link href={job.url} style={{ color: COLORS.fg, textDecoration: 'none' }}>
                <strong>{job.company}</strong> · {job.title}
              </Link>
            </Text>
            <Text style={styles.compactMeta}>
              {job.location ?? '—'}
              {job.remote ? ' · Remote' : ''}
            </Text>
          </td>
          <td style={{ width: '40px', textAlign: 'right', verticalAlign: 'middle' }}>
            <span style={styles.compactScore}>{Math.round(job.match_score)}</span>
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

  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light only" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading as="h1" style={styles.greeting}>
            Good morning, {firstName}.
          </Heading>
          <Text style={styles.metaLine}>
            {dateLabel} · {jobs.length} startup matches.
          </Text>

          <Text style={styles.eyebrow}>Your top 3</Text>
          {top.map((job, i) => (
            <DetailedJob key={job.id} job={job} first={i === 0} />
          ))}

          {rest.length > 0 && (
            <>
              <Text style={styles.eyebrow}>Also worth a look</Text>
              {rest.map(job => (
                <CompactJob key={job.id} job={job} />
              ))}
            </>
          )}

          <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
            <tr>
              <td style={{ textAlign: 'center' }}>
                <Link href={dashboardUrl} style={styles.cta}>
                  View all on the dashboard →
                </Link>
              </td>
            </tr>
          </table>

          <Text style={styles.footer}>
            You&apos;re receiving this because you have an active Job Cannon subscription.
            <br />
            <Link href={billingUrl} style={styles.footerLink}>
              Manage subscription or unsubscribe
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
