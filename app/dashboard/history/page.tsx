import { auth } from '@clerk/nextjs/server';
import { and, desc, eq, gte } from 'drizzle-orm';

import { JobCard } from '@/components/JobCard';
import { db } from '@/db';
import { dailyDigests } from '@/db/schema';
import { DIGEST_RETENTION_DAYS, daysAgoInET, formatShortDate } from '@/lib/date';
import type { MatchedJob } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DashboardHistoryPage() {
  const { userId } = await auth();
  // Same ET day boundary the retention prune uses, so the window the user is
  // shown and the window we actually keep can never disagree by a day.
  const cutoff = daysAgoInET(DIGEST_RETENTION_DAYS);

  const rows = await db
    .select({
      id: dailyDigests.id,
      digestDate: dailyDigests.digestDate,
      jobs: dailyDigests.jobs,
    })
    .from(dailyDigests)
    .where(and(eq(dailyDigests.userId, userId!), gte(dailyDigests.digestDate, cutoff)))
    .orderBy(desc(dailyDigests.digestDate));

  return (
    <div className="space-y-12">
      <header>
        <h1 className="font-display text-4xl tracking-tight">History</h1>
        <p className="mt-2 text-[0.9375rem] text-muted-foreground">
          Past {DIGEST_RETENTION_DAYS} days. Each digest expands to the full 10 matches.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="border-t border-border pt-8 text-[0.9375rem] text-muted-foreground">
          No history yet. Your first digest lands tomorrow at 8am ET, and it&apos;ll show up here after that.
        </p>
      ) : (
        <ul className="border-t border-border">
          {rows.map(row => {
            const jobs = row.jobs as MatchedJob[];
            const previewCompanies = jobs.slice(0, 3).map(j => j.company).join(' · ');
            return (
              <li key={row.id} className="border-b border-border">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-baseline justify-between gap-6 py-6 transition-colors hover:bg-foreground/[0.02]">
                    <div className="min-w-0">
                      <div className="font-display text-xl tracking-tight">
                        {formatShortDate(row.digestDate)}, {row.digestDate.slice(0, 4)}
                      </div>
                      <div className="mt-1 truncate text-[0.8125rem] text-muted-foreground">
                        {previewCompanies || '(empty digest)'}
                      </div>
                    </div>
                    <span className="shrink-0 text-[0.8125rem] text-muted-foreground">
                      <span className="group-open:hidden">View all {jobs.length} →</span>
                      <span className="hidden group-open:inline">Hide ↑</span>
                    </span>
                  </summary>
                  <div className="border-t border-border pb-2">
                    <div className="divide-y divide-border">
                      {jobs.map(job => (
                        <JobCard key={job.id} job={job} />
                      ))}
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
