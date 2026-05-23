import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';

import { OnboardingClient } from '@/components/OnboardingClient';
import { db } from '@/db';
import { resumes } from '@/db/schema';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in?redirect_url=/onboarding');
  }

  // If they already have an active resume on file, send them to the dashboard.
  const existing = await db
    .select({ id: resumes.id })
    .from(resumes)
    .where(and(eq(resumes.userId, userId), eq(resumes.isActive, true)))
    .limit(1);

  if (existing[0]) {
    redirect('/dashboard');
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Upload your resume</h1>
        <p className="mt-2 max-w-xl text-base text-muted-foreground">
          One upload. We extract a structured profile, then match it against fresh startup
          jobs every weekday at 8am ET.
        </p>
      </header>
      <OnboardingClient />
    </main>
  );
}
