import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { db } from '@/db';
import { resumes, hasActiveSubscription } from '@/db/schema';
import { getCurrentSubscription } from '@/lib/stripe/subscription';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ welcome?: string }>;

export default async function DashboardPage(props: { searchParams: SearchParams }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/dashboard');

  const sub = await getCurrentSubscription(userId);
  if (!hasActiveSubscription(sub)) redirect('/pricing');

  // No active resume? Send them to onboarding.
  const activeResume = await db
    .select({ id: resumes.id, filename: resumes.filename })
    .from(resumes)
    .where(and(eq(resumes.userId, userId), eq(resumes.isActive, true)))
    .limit(1);

  if (!activeResume[0]) redirect('/onboarding');

  const { welcome } = await props.searchParams;
  const status = sub!.status;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      {welcome && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <CardContent className="p-4 text-sm">
            🎉 You&apos;re in. Your trial is active — your first digest lands tomorrow at 8am ET.
          </CardContent>
        </Card>
      )}

      <header className="mb-8">
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Dashboard</h1>
          <Badge variant="secondary" className="capitalize">
            {status}
          </Badge>
        </div>
        <p className="mt-2 text-base text-muted-foreground">
          Resume on file: <span className="text-foreground/90">{activeResume[0].filename}</span>
        </p>
      </header>

      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="text-lg font-semibold tracking-tight">Today&apos;s digest is pending</h2>
          <p className="text-sm text-muted-foreground">
            The full dashboard (today&apos;s 10 matches, 30-day history, resume manager, billing portal
            link) ships in the next phase. For now this stub confirms your subscription is active
            and Stripe is wired up end-to-end.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
