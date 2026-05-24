import { auth } from '@clerk/nextjs/server';
import { desc, eq, gte, and } from 'drizzle-orm';

import { Card, CardContent } from '@/components/ui/card';
import { JobCard } from '@/components/JobCard';
import { db } from '@/db';
import { dailyDigests } from '@/db/schema';
import { formatShortDate } from '@/lib/date';
import type { MatchedJob } from '@/lib/types';

export const dynamic = 'force-dynamic';

function dateNDaysAgoIsoDate(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export default async function DashboardHistoryPage() {
  const { userId } = await auth();
  const cutoff = dateNDaysAgoIsoDate(30);

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
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Past 30 days of digests. Click any entry to see the full 10.
        </p>
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No history yet. Your first digest lands tomorrow at 8am ET, and it&apos;ll show up here
            after that.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map(row => {
            const jobs = row.jobs as MatchedJob[];
            const previewCompanies = jobs.slice(0, 3).map(j => j.company).join(' · ');
            return (
              <li key={row.id}>
                <Card>
                  <CardContent className="p-0">
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 hover:bg-muted/50">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{formatShortDate(row.digestDate)}</div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {previewCompanies || '(empty digest)'}
                          </div>
                        </div>
                        <div className="shrink-0 text-xs text-muted-foreground">
                          <span className="group-open:hidden">Show 10 ▸</span>
                          <span className="hidden group-open:inline">Hide ▾</span>
                        </div>
                      </summary>
                      <div className="space-y-3 border-t bg-muted/30 p-4">
                        {jobs.map(job => (
                          <JobCard key={job.id} job={job} />
                        ))}
                      </div>
                    </details>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
