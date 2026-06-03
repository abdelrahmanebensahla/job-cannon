import { auth } from '@clerk/nextjs/server';
import { and, desc, eq, sql } from 'drizzle-orm';

import { ProfileSummary } from '@/components/ProfileSummary';
import { ReplaceResumeClient } from '@/components/ReplaceResumeClient';
import { db } from '@/db';
import { resumes } from '@/db/schema';
import { formatLongDate } from '@/lib/date';

export const dynamic = 'force-dynamic';

export default async function DashboardResumePage() {
  const { userId } = await auth();

  // Select only what the page renders — never pull the large base64 file_data
  // blob; `hasPdf` is enough to know whether review is enabled.
  const [active] = await db
    .select({
      filename: resumes.filename,
      profile: resumes.profile,
      createdAt: resumes.createdAt,
      hasPdf: sql<boolean>`${resumes.fileData} is not null`,
    })
    .from(resumes)
    .where(and(eq(resumes.userId, userId!), eq(resumes.isActive, true)))
    .orderBy(desc(resumes.createdAt))
    .limit(1);

  return (
    <div className="space-y-12">
      <header>
        <h1 className="font-display text-4xl tracking-tight">Resume</h1>
        <p className="mt-2 text-[0.9375rem] text-muted-foreground">
          We match against the profile we extracted from your most recently uploaded resume.
        </p>
      </header>

      <div className="border-t border-b border-border py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="text-[0.9375rem] text-foreground">{active!.filename}</div>
          <div className="text-[0.8125rem] text-muted-foreground">
            Uploaded {formatLongDate(active!.createdAt)}
          </div>
        </div>
      </div>

      {!active!.hasPdf && (
        <p className="max-w-prose text-[0.8125rem] text-muted-foreground">
          Heads up: this resume was uploaded before full-PDF resume review existed. Replace it below
          to enable a detailed resume review.
        </p>
      )}

      <ProfileSummary profile={active!.profile} />

      <section className="border-t border-border pt-8">
        <h2 className="font-display text-xl tracking-tight">Replace</h2>
        <p className="mt-2 max-w-prose text-[0.9375rem] text-muted-foreground">
          Upload a new PDF and we&apos;ll re-extract your profile. Tomorrow&apos;s 8am digest will use the new version.
        </p>
        <div className="mt-5">
          <ReplaceResumeClient />
        </div>
      </section>
    </div>
  );
}
