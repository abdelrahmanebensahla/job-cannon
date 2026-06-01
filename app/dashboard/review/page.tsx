import { auth } from '@clerk/nextjs/server';
import { and, desc, eq } from 'drizzle-orm';

import { ReviewClient } from '@/components/ReviewClient';
import { db } from '@/db';
import { resumeReviews, resumes } from '@/db/schema';

export const dynamic = 'force-dynamic';

export default async function DashboardReviewPage() {
  // Layout already enforced auth + active resume + active subscription.
  const { userId } = await auth();

  const [[activeResume], [latest]] = await Promise.all([
    db
      .select({ filename: resumes.filename })
      .from(resumes)
      .where(and(eq(resumes.userId, userId!), eq(resumes.isActive, true)))
      .orderBy(desc(resumes.createdAt))
      .limit(1),
    db
      .select()
      .from(resumeReviews)
      .where(eq(resumeReviews.userId, userId!))
      .orderBy(desc(resumeReviews.createdAt))
      .limit(1),
  ]);

  return (
    <div className="space-y-12">
      <header>
        <h1 className="font-display text-4xl tracking-tight">Resume review</h1>
        <p className="mt-2 max-w-prose text-[0.9375rem] text-muted-foreground">
          An honest, specific critique of your active resume — strengths, gaps, and recommendations
          to land more startup interviews. Based on the profile we extracted from your latest
          upload, so it focuses on positioning, skills, and targeting (not formatting).
        </p>
      </header>

      <ReviewClient
        initialReview={latest?.review ?? null}
        initialDate={latest ? latest.createdAt.toISOString() : null}
        resumeFilename={activeResume?.filename ?? 'your resume'}
      />
    </div>
  );
}
