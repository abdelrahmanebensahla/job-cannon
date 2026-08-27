import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import type { MatchedJob, Profile, ResumeReview } from '@/lib/types';

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Clerk user id
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey(), // Stripe subscription id
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id').notNull(),
  status: text('status').notNull(), // 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'
  priceId: text('price_id').notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const resumes = pgTable('resumes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  profile: jsonb('profile').$type<Profile>().notNull(),
  // base64 of the uploaded PDF, kept so resume review can read the full
  // document. Null for rows created before this column existed — those resumes
  // must be re-uploaded to enable review (we never backfill).
  fileData: text('file_data'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const dailyDigests = pgTable(
  'daily_digests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    digestDate: date('digest_date').notNull(), // the day this digest is FOR
    jobs: jsonb('jobs').$type<MatchedJob[]>().notNull(),
    sentAt: timestamp('sent_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => [uniqueIndex('daily_digest_user_date').on(table.userId, table.digestDate)],
);

export const resumeReviews = pgTable(
  'resume_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(), // source PDF name, for display only (PDF not stored)
    review: jsonb('review').$type<ResumeReview>().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => [index('resume_reviews_user').on(table.userId, table.createdAt)],
);

/**
 * Fixed-window counters for the unauthenticated /api/match endpoint.
 *
 * Not user data: the key is `match:ip:<salted sha256>:<ET date>` or
 * `match:global:<ET date>`, so no IP address is ever written to the database.
 * The window is baked into the key, which is why there's no reset logic —
 * a new day is simply a new row. `expiresAt` exists only so the daily cron
 * can sweep old rows.
 *
 * Deliberately its own tiny table with a text primary key: one upsert
 * statement can increment both the per-IP and the global counter and return
 * both values, which is the only way to do this atomically over Neon's HTTP
 * driver (no multi-statement transactions).
 */
export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  expiresAt: timestamp('expires_at').notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Resume = typeof resumes.$inferSelect;
export type NewResume = typeof resumes.$inferInsert;
export type DailyDigest = typeof dailyDigests.$inferSelect;
export type NewDailyDigest = typeof dailyDigests.$inferInsert;
export type ResumeReviewRow = typeof resumeReviews.$inferSelect;
export type NewResumeReviewRow = typeof resumeReviews.$inferInsert;
export type RateLimitRow = typeof rateLimits.$inferSelect;

export const ACTIVE_SUB_STATUSES = ['trialing', 'active'] as const;

/**
 * Has the user paid for a period that is still ongoing?
 *
 * Trialing + active obviously qualify. A canceled subscription whose
 * current_period_end is in the future also qualifies — the user paid for
 * (or is trialing) a window that hasn't elapsed yet, and standard billing
 * convention is to honor that window. Stripe's `subscriptions.cancel(id)`
 * marks status='canceled' immediately but leaves current_period_end at its
 * original value, so we use the date comparison as the source of truth.
 *
 * Once current_period_end is in the past, a canceled sub stops granting
 * access. past_due / incomplete fall through to false; we don't grant a
 * dunning grace period in v1.
 */
export function hasActiveSubscription(sub: Subscription | null | undefined): boolean {
  if (!sub) return false;
  if ((ACTIVE_SUB_STATUSES as readonly string[]).includes(sub.status)) return true;
  if (sub.status === 'canceled' && sub.currentPeriodEnd > new Date()) return true;
  return false;
}
