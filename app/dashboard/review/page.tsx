import { auth } from '@clerk/nextjs/server';
import { desc, eq } from 'drizzle-orm';

import { ReviewClient } from '@/components/ReviewClient';
import { db } from '@/db';
import { resumeReviews } from '@/db/schema';

export const dynamic = 'force-dynamic';

export default async function DashboardReviewPage() {
  // Layout already enforced auth + active resume + active subscription.
  const { userId } = await auth();

  const [latest] = await db
    .select()
    .from(resumeReviews)
    .where(eq(resumeReviews.userId, userId!))
    .orderBy(desc(resumeReviews.createdAt))
    .limit(1);

  return (
    <div className="space-y-12">
      <header>
        <h1 className="font-display text-4xl tracking-tight">Resume review</h1>
        <p className="mt-2 max-w-prose text-[0.9375rem] text-muted-foreground">
          Upload your resume for an honest, specific critique — strengths, gaps, line-by-line
          revisions, and recommendations. We read the PDF to generate the review but don&apos;t store
          it; only the review is kept.
        </p>
      </header>

      <ReviewClient
        initialReview={latest?.review ?? null}
        initialFilename={latest?.filename ?? null}
        initialDate={latest ? latest.createdAt.toISOString() : null}
      />
    </div>
  );
}
