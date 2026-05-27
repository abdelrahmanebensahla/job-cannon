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
    <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <header className="mb-12">
        <p className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
          Step 1 of 2
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
          Upload your resume.
        </h1>
        <p className="mt-4 max-w-xl text-[1.0625rem] leading-relaxed text-muted-foreground">
          One upload. We extract a structured profile and match it against fresh startup roles
          every weekday at 8am ET.
        </p>
      </header>
      <OnboardingClient />
    </main>
  );
}
