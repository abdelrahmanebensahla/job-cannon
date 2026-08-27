import { lt } from 'drizzle-orm';

import { db } from '@/db';
import { dailyDigests } from '@/db/schema';
import { DIGEST_RETENTION_DAYS, daysAgoInET } from '@/lib/date';

/**
 * Data retention, enforced rather than merely promised.
 *
 * The privacy policy tells users their match history is kept for 30 days. The
 * history page only ever *displayed* 30 days — nothing deleted the rows, so
 * the claim was aspirational. This makes it true.
 *
 * Runs at the end of the daily-digest cron: one statement, no per-user work,
 * and the same ET day boundary the digests themselves are keyed by so a row
 * is never pruned while the history page would still list it.
 *
 * Superseded resume PDFs are handled separately, at the point of replacement
 * in `app/api/resume/route.ts` — see the `fileData: null` there.
 */
export async function pruneExpiredDigests(now: Date = new Date()): Promise<number> {
  const cutoff = daysAgoInET(DIGEST_RETENTION_DAYS, now);
  const deleted = await db
    .delete(dailyDigests)
    .where(lt(dailyDigests.digestDate, cutoff))
    .returning({ id: dailyDigests.id });
  return deleted.length;
}
