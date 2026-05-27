import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';

import { JobCard } from '@/components/JobCard';
import { NextDigestCountdown } from '@/components/NextDigestCountdown';
import { SubscriptionBadge } from '@/components/SubscriptionBadge';
import { db } from '@/db';
import { dailyDigests } from '@/db/schema';
import { formatLongDate, todayInET } from '@/lib/date';
import { loadJobs } from '@/lib/jobs';
import type { MatchedJob } from '@/lib/types';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ welcome?: string }>;

export default async function DashboardTodayPage(props: { searchParams: SearchParams }) {
  // Layout already enforced auth + resume + active sub.
  const { userId } = await auth();
  const today = todayInET();

  const rows = await db
    .select({ jobs: dailyDigests.jobs, sentAt: dailyDigests.sentAt })
    .from(dailyDigests)
    .where(and(eq(dailyDigests.userId, userId!), eq(dailyDigests.digestDate, today)))
    .limit(1);

  const digest = rows[0];
  const { welcome } = await props.searchParams;

  // Total scrape pool size is shown in the stats strip — read it lazily so
  // a missing jobs.json never blocks the page.
  let totalJobs = 0;
  if (digest) {
    try {
      const all = await loadJobs();
      totalJobs = all.length;
    } catch {
      totalJobs = 0;
    }
  }

  return (
    <div className="space-y-12">
      {welcome && (
        <div className="border border-border px-5 py-4 text-[0.9375rem]">
          You&apos;re in. Your trial is active — your first digest lands tomorrow at 8am ET.
        </div>
      )}

      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-4xl tracking-tight leading-tight">
          {digest ? (
            <>Today&apos;s matches</>
          ) : (
            <>Dashboard</>
          )}
          <span className="ml-3 text-muted-foreground text-[1.5rem] font-normal">
            {formatLongDate(today)}
          </span>
        </h1>
        <SubscriptionBadge />
      </header>

      {digest ? (
        <section className="space-y-8">
          <p className="text-[0.8125rem] text-muted-foreground">
            {digest.jobs.length} jobs
            {totalJobs > 0 ? ` · ranked from ${totalJobs.toLocaleString()} startup roles` : ''}
            {digest.sentAt ? ' · emailed' : ' · email pending'}
          </p>

          <div className="divide-y divide-border border-y border-border">
            {(digest.jobs as MatchedJob[]).map(j => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        </section>
      ) : (
        <section className="py-20 text-center">
          <p className="font-display text-[3rem] leading-[1.05] tracking-tight">
            Next digest in <NextDigestCountdown />
          </p>
          <p className="mt-4 text-[0.9375rem] text-muted-foreground">
            We&apos;ll send 10 startup matches at 8am ET on the next weekday.
          </p>
          <Link
            href="/dashboard/resume"
            className="mt-8 inline-flex text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
          >
            Need to update your resume? →
          </Link>
        </section>
      )}
    </div>
  );
}
