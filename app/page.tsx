import Link from 'next/link';
import { auth, currentUser } from '@clerk/nextjs/server';

import { MatchClient } from '@/components/MatchClient';
import { getSubscriptionView, isActiveView } from '@/lib/subscription';

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

export default async function Home() {
  const { userId } = await auth();
  const [user, view] = await Promise.all([
    userId ? currentUser() : Promise.resolve(null),
    getSubscriptionView(),
  ]);

  const userEmail =
    user?.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    null;

  const signedIn = Boolean(userId);
  const subscribed = signedIn && isActiveView(view);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 sm:px-6">
      {signedIn && !subscribed && userEmail && (
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

        {subscribed ? (
          <Link
            href="/dashboard"
            className="mt-8 inline-flex h-11 items-center border border-foreground bg-foreground px-5 text-[0.875rem] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            Go to dashboard →
          </Link>
        ) : (
          <p className="mt-4 text-[0.8125rem] text-muted-foreground">
            Powered by Claude · Greenhouse + Lever + RemoteOK · No account needed for the free preview.
          </p>
        )}
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

      <section
        aria-label={subscribed ? 'Subscription status' : 'Pricing teaser'}
        className="mt-24 border-t border-border pt-12 sm:mt-32"
      >
        {subscribed ? (
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl tracking-tight">You&apos;re subscribed.</h2>
              <p className="mt-2 max-w-prose text-[0.9375rem] text-muted-foreground">
                Manage your plan, payment method, and invoices from the billing page.
              </p>
            </div>
            <Link
              href="/dashboard/billing"
              className="inline-flex h-10 items-center border border-border bg-background px-4 text-[0.8125rem] font-medium text-foreground transition-colors hover:bg-foreground/[0.04]"
            >
              Manage billing →
            </Link>
          </div>
        ) : (
          <>
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
          </>
        )}
      </section>

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
    </main>
  );
}
