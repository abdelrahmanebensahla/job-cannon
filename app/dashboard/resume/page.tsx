import { auth } from '@clerk/nextjs/server';
import { and, desc, eq } from 'drizzle-orm';

import { Card, CardContent } from '@/components/ui/card';
import { ProfileSummary } from '@/components/ProfileSummary';
import { ReplaceResumeClient } from '@/components/ReplaceResumeClient';
import { db } from '@/db';
import { resumes } from '@/db/schema';
import { formatShortDate } from '@/lib/date';
import type { Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DashboardResumePage() {
  const { userId } = await auth();

  const [active] = await db
    .select()
    .from(resumes)
    .where(and(eq(resumes.userId, userId!), eq(resumes.isActive, true)))
    .orderBy(desc(resumes.createdAt))
    .limit(1);

  const profile = active!.profile as Profile;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Resume</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We match against the profile we extracted from your most recently uploaded resume.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-1 p-5">
          <div className="text-sm font-medium">{active!.filename}</div>
          <div className="text-xs text-muted-foreground">
            Uploaded {formatShortDate(active!.createdAt)}
          </div>
        </CardContent>
      </Card>

      <ProfileSummary profile={profile} />

      <section className="space-y-3 border-t pt-6">
        <h2 className="text-lg font-semibold tracking-tight">Replace</h2>
        <p className="text-sm text-muted-foreground">
          Upload a new PDF and we&apos;ll re-extract your profile. Tomorrow&apos;s 8am digest will use the
          new version.
        </p>
        <ReplaceResumeClient />
      </section>
    </div>
  );
}
