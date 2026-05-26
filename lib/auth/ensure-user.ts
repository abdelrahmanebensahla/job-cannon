import { currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users, type User } from '@/db/schema';

/**
 * Look up (or create) the local users row for the currently authenticated
 * Clerk user. Belt-and-suspenders against the Clerk webhook race — when a
 * user signs up, the webhook usually fires before they hit any authed
 * route, but not always (e.g. social SSO with instant redirect).
 */
export async function ensureUser(userId: string): Promise<User> {
  const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (existing[0]) return existing[0];

  const u = await currentUser();
  if (!u || u.id !== userId) {
    throw new Error('clerk_user_not_found');
  }
  const primary = u.emailAddresses.find(e => e.id === u.primaryEmailAddressId);
  const email = primary?.emailAddress ?? u.emailAddresses[0]?.emailAddress;
  if (!email) {
    throw new Error('clerk_user_has_no_email');
  }

  let inserted: User | undefined;
  try {
    [inserted] = await db
      .insert(users)
      .values({ id: userId, email })
      .onConflictDoNothing({ target: users.id })
      .returning();
  } catch (e) {
    // Likely an email-unique conflict — another row already owns this
    // email. Surface a distinct error so the API route can map it to a
    // clearer user message than the generic 'user_not_provisioned'.
    if (e instanceof Error && /duplicate key|23505|unique/i.test(e.message)) {
      throw new Error('email_conflict');
    }
    throw e;
  }

  if (inserted) return inserted;

  // onConflictDoNothing returns [] when the row already exists (race with
  // the webhook firing simultaneously). Re-read.
  const rerun = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!rerun[0]) throw new Error('user_upsert_failed');
  return rerun[0];
}
