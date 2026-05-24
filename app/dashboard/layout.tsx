import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';

import { DashboardBottomBar, DashboardSidebar } from '@/components/DashboardNav';
import { db } from '@/db';
import { resumes, hasActiveSubscription } from '@/db/schema';
import { getCurrentSubscription } from '@/lib/stripe/subscription';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/dashboard');

  // Resume first (the funnel order): no resume → /onboarding before billing.
  const activeResume = await db
    .select({ id: resumes.id })
    .from(resumes)
    .where(and(eq(resumes.userId, userId), eq(resumes.isActive, true)))
    .limit(1);
  if (!activeResume[0]) redirect('/onboarding');

  const sub = await getCurrentSubscription(userId);
  if (!hasActiveSubscription(sub)) redirect('/pricing');

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-6 pb-24 sm:px-6 sm:pt-10 sm:pb-10">
      <div className="flex gap-8">
        <DashboardSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      <DashboardBottomBar />
    </div>
  );
}
