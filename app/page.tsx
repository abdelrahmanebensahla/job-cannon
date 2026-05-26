import Link from 'next/link';

import { MatchClient } from '@/components/MatchClient';
import { Card, CardContent } from '@/components/ui/card';

const STEPS: { num: string; title: string; body: string }[] = [
  {
    num: '1',
    title: 'Drop your resume',
    body: 'PDF only. We extract a structured profile in seconds using Claude.',
  },
  {
    num: '2',
    title: 'We rank ~5K startup jobs',
    body: 'Keyword pre-filter on your top skills, then Claude scores the best 20 with a reason for each.',
  },
  {
    num: '3',
    title: 'See your matches now, free',
    body: 'No login. Upgrade to get the top 10 in your inbox every weekday at 8am ET.',
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-10 sm:px-6 sm:py-16">
      <header className="mb-10 sm:mb-14">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Startup jobs, AI-matched to your resume,{' '}
          <span className="text-foreground/70">delivered daily.</span>
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
          Drop your resume. Get 20 startup matches now, for free. Subscribe to get the top 10 in
          your inbox every weekday morning.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Powered by Claude · Greenhouse + Lever + RemoteOK · No accounts required for the free preview.
        </p>
      </header>

      <section aria-label="Match flow" className="flex-1">
        <MatchClient />
      </section>

      <section
        id="how-it-works"
        aria-label="How it works"
        className="mt-16 scroll-mt-24 border-t pt-10 sm:mt-20 sm:pt-14"
      >
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Two Claude calls, no databases of your data, no email gating to see results.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {STEPS.map(s => (
            <Card key={s.num}>
              <CardContent className="space-y-2 p-5">
                <div className="text-xs font-medium tracking-wide text-muted-foreground">
                  STEP {s.num}
                </div>
                <h3 className="text-base font-semibold tracking-tight">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Want a deeper dive into the keyword-pre-filter-vs-vector-embeddings design choice?{' '}
          <a
            href="https://github.com/abdelrahmanebensahla/job-cannon#how-the-matching-works"
            className="underline underline-offset-2 hover:text-foreground"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read the README
          </a>
          .
        </p>
      </section>

      <section
        aria-label="Pricing teaser"
        className="mt-12 rounded-lg border bg-muted/30 p-6 sm:mt-16"
      >
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Tomorrow morning, get them in your inbox.
        </h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          The free preview is great for a snapshot. The paid plan ($9/mo or $80/yr, 7-day free
          trial) delivers a fresh top-10 every weekday at 8am ET, with full reasoning for each
          match.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <Link
            href="/pricing"
            className="font-medium text-foreground underline underline-offset-2"
          >
            See pricing →
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link
            href="/sign-up"
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Start free trial
          </Link>
        </div>
      </section>

      <footer className="mt-16 text-xs text-muted-foreground">
        Built with Next.js, Tailwind, shadcn/ui, and the Anthropic SDK.
      </footer>
    </main>
  );
}
