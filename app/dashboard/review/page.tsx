import { auth } from '@clerk/nextjs/server';
import { and, desc, eq, sql } from 'drizzle-orm';

import { ReviewClient } from '@/components/ReviewClient';
import { db } from '@/db';
import { resumeReviews, resumes } from '@/db/schema';

export const dynamic = 'force-dynamic';

export default async function DashboardReviewPage() {
  // Layout already enforced auth + active resume + active subscription.
  const { userId } = await auth();

  const [[activeResume], [latest]] = await Promise.all([
    // hasPdf only — never pull the (large) base64 file_data blob into the page.
    db
      .select({
        filename: resumes.filename,
        hasPdf: sql<boolean>`${resumes.fileData} is not null`,
      })
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
          Claude reads your full uploaded resume PDF and gives an honest, specific critique —
          line-level feedback on wording, structure, and gaps, plus before/after revisions and
          recommendations to land more startup interviews.
        </p>
      </header>

      <ReviewClient
        initialReview={latest?.review ?? null}
        initialDate={latest ? latest.createdAt.toISOString() : null}
        resumeFilename={activeResume?.filename ?? 'your resume'}
        hasPdf={activeResume?.hasPdf ?? false}
      />
    </div>
  );
}
