import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';

import { Card, CardContent } from '@/components/ui/card';
import { JobCard } from '@/components/JobCard';
import { NextDigestCountdown } from '@/components/NextDigestCountdown';
import { db } from '@/db';
import { dailyDigests } from '@/db/schema';
import { formatLongDate, todayInET } from '@/lib/date';
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

  return (
    <div className="space-y-6">
      {welcome && (
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <CardContent className="p-4 text-sm">
            🎉 You&apos;re in. Your trial is active — your first digest lands tomorrow at 8am ET.
          </CardContent>
        </Card>
      )}

      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {formatLongDate(today)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Today&apos;s top matches.</p>
      </header>

      {digest ? (
        <section>
          <p className="mb-3 text-xs text-muted-foreground">
            {digest.jobs.length} matches{digest.sentAt ? ' · emailed' : ' · email pending'}
          </p>
          <ul className="space-y-3">
            {(digest.jobs as MatchedJob[]).map(j => (
              <li key={j.id}>
                <JobCard job={j} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <Card>
          <CardContent className="space-y-3 p-6">
            <h2 className="text-lg font-semibold tracking-tight">No digest yet</h2>
            <p className="text-sm text-muted-foreground">
              The daily cron runs at 8am ET, Monday through Friday. Next run in{' '}
              <span className="font-medium text-foreground">
                <NextDigestCountdown />
              </span>
              . While you wait, you can browse a free instant preview on the{' '}
              <a href="/" className="underline underline-offset-2 hover:text-foreground">
                landing page
              </a>
              .
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
