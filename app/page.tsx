import Link from 'next/link';
import { auth, currentUser } from '@clerk/nextjs/server';
import { and, desc, eq } from 'drizzle-orm';

import { MatchClient } from '@/components/MatchClient';
import { ProfileSummary } from '@/components/ProfileSummary';
import { ReplaceResumeClient } from '@/components/ReplaceResumeClient';
import { SubscriptionStatusBlock } from '@/components/SubscriptionStatusBlock';
import { db } from '@/db';
import { hasActiveSubscription, resumes } from '@/db/schema';
import { formatLongDate } from '@/lib/date';
import { getCurrentSubscription } from '@/lib/stripe/subscription';
import { toView } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

type Step = { num: string; title: string; body: string };

const STEPS: Step[] = [
  {
    num: '01',
    title: 'Drop your resume',
    body:
      'PDF only. We extract a structured profile in seconds via Claude — skills, target roles, seniority, locations.',
  },
  {
    num: '02',
    title: 'We rank ~5K startup roles',
    body:
      'Keyword pre-filter on your top skills, then Claude scores the best 20 with a one-paragraph reason for each.',
  },
  {
    num: '03',
    title: 'See your matches free',
    body:
      'No login. Subscribe to get the top 10 in your inbox every weekday at 8am ET, plus 30 days of history.',
  },
];

function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-border py-10 text-[0.8125rem] text-muted-foreground">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>Job Cannon · jobcannon.app</span>
        <div className="flex gap-5">
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default async function Home() {
  const { userId } = await auth();
  const sub = userId ? await getCurrentSubscription(userId) : null;
  // Entitlement uses the same date-aware truth as the dashboard gate, so a
  // subscription that's canceled-but-still-within-period counts as active.
  const entitled = hasActiveSubscription(sub);

  // Subscriber home: the active resume drives the daily digest, so the landing
  // page becomes a status + resume manager rather than the marketing pitch —
  // no "How it works", no pricing.
  if (entitled) {
    const view = toView(sub);
    const [active] = await db
      .select({
        filename: resumes.filename,
        profile: resumes.profile,
        createdAt: resumes.createdAt,
      })
      .from(resumes)
      .where(and(eq(resumes.userId, userId!), eq(resumes.isActive, true)))
      .orderBy(desc(resumes.createdAt))
      .limit(1);

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 sm:px-6">
        <header className="pt-16 sm:pt-24">
          <h1 className="font-display text-[2.5rem] leading-[1.05] tracking-tight sm:text-[3rem]">
            Welcome back.
          </h1>
          <div className="mt-4">
            <SubscriptionStatusBlock view={view} />
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center border border-foreground bg-foreground px-5 text-[0.875rem] font-medium text-background transition-colors hover:bg-foreground/90"
            >
              Go to dashboard →
            </Link>
            <Link
              href="/dashboard/billing"
              className="text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
            >
              Manage billing
            </Link>
          </div>
        </header>

        <section aria-label="Your resume" className="mt-16 border-t border-border pt-10 sm:mt-20">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl tracking-tight">Your resume</h2>
            {active && (
              <span className="text-[0.8125rem] text-muted-foreground">
                {active.filename} · uploaded {formatLongDate(active.createdAt)}
              </span>
            )}
          </div>

          {active ? (
            <>
              <div className="mt-8">
                <ProfileSummary profile={active.profile} />
              </div>
              <div className="mt-10 border-t border-border pt-8">
                <h3 className="font-display text-xl tracking-tight">Upload a new resume</h3>
                <p className="mt-2 max-w-prose text-[0.9375rem] text-muted-foreground">
                  We&apos;ll re-extract your profile. Tomorrow&apos;s 8am digest uses the latest version.
                </p>
                <div className="mt-5">
                  <ReplaceResumeClient />
                </div>
              </div>
            </>
          ) : (
            <div className="mt-6">
              <p className="max-w-prose text-[0.9375rem] text-muted-foreground">
                No resume on file yet. Upload one and we&apos;ll start matching you tomorrow morning.
              </p>
              <div className="mt-5">
                <ReplaceResumeClient />
              </div>
            </div>
          )}
        </section>

        <SiteFooter />
      </main>
    );
  }

  // Signed-out + free (non-entitled) visitors: the marketing pitch.
  const user = userId ? await currentUser() : null;
  const userEmail =
    user?.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    null;
  const signedIn = Boolean(userId);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 sm:px-6">
      {signedIn && userEmail && (
        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-4 text-[0.8125rem] text-muted-foreground">
          <span>
            Signed in as <span className="text-foreground">{userEmail}</span>
          </span>
          <Link href="/dashboard" className="text-foreground underline underline-offset-2">
            Dashboard →
          </Link>
        </div>
      )}

      <header className="pt-16 sm:pt-24">
        <h1 className="font-display text-[3rem] leading-[1.05] tracking-tight sm:text-[3.5rem]">
          Startup jobs, AI-matched to your resume,{' '}
          <span className="text-muted-foreground">delivered daily.</span>
        </h1>
        <p className="mt-6 max-w-xl text-[1.0625rem] leading-relaxed text-muted-foreground">
          Drop your resume. Get 20 startup matches now, for free. Subscribe to receive the top 10
          in your inbox every weekday morning.
        </p>
        <p className="mt-4 text-[0.8125rem] text-muted-foreground">
          Powered by Claude · Greenhouse + Lever + RemoteOK · No account needed for the free preview.
        </p>
      </header>

      <section aria-label="Match flow" className="mt-12 sm:mt-16">
        <MatchClient />
      </section>

      <section
        id="how-it-works"
        aria-label="How it works"
        className="mt-28 scroll-mt-24 border-t border-border pt-16 sm:mt-32"
      >
        <h2 className="font-display text-3xl tracking-tight sm:text-4xl">How it works</h2>
        <p className="mt-3 max-w-prose text-[0.9375rem] text-muted-foreground">
          Two Claude calls, no databases of your data, no email gating to see results.
        </p>
        <ol className="mt-12 divide-y divide-border border-y border-border">
          {STEPS.map(s => (
            <li key={s.num} className="grid gap-6 py-8 sm:grid-cols-[4rem_1fr_auto]">
              <span className="font-display text-2xl tracking-tight text-muted-foreground tabular-nums">
                {s.num}
              </span>
              <div>
                <h3 className="font-display text-xl tracking-tight">{s.title}</h3>
                <p className="mt-2 max-w-prose text-[0.9375rem] leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-[0.8125rem] text-muted-foreground">
          Curious about the design choice (keyword pre-filter vs vector embeddings)?{' '}
          <a
            href="https://github.com/abdelrahmanebensahla/job-cannon#how-it-works"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-2"
          >
            Read the README ↗
          </a>
        </p>
      </section>

      <section aria-label="Pricing teaser" className="mt-24 border-t border-border pt-12 sm:mt-32">
        <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
          Tomorrow morning, get them in your inbox.
        </h2>
        <p className="mt-3 max-w-prose text-[0.9375rem] text-muted-foreground">
          $8/month or $60/year. 7-day free trial. Cancel any time in the Stripe portal — your
          card isn&apos;t charged until the trial ends.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-5">
          <Link
            href="/pricing"
            className="inline-flex h-10 items-center border border-foreground bg-foreground px-5 text-[0.8125rem] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            See pricing
          </Link>
          <Link
            href="/sign-up"
            className="text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
          >
            Start free trial →
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
