import { desc, eq } from 'drizzle-orm';
import type Stripe from 'stripe';

import { db } from '@/db';
import { subscriptions, type Subscription } from '@/db/schema';

/**
 * Look up the most recent subscription row for a user, regardless of status.
 * Use `hasActiveSubscription` from `@/db/schema` to gate UI on it.
 */
export async function getCurrentSubscription(userId: string): Promise<Subscription | null> {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

function readPeriodEnd(sub: Stripe.Subscription): Date {
  const itemEnd = sub.items?.data[0]?.current_period_end;
  if (itemEnd) return new Date(itemEnd * 1000);
  // Fallback — Stripe should always populate this, but cancelled/incomplete
  // subs occasionally lack items. Use cancel_at or 0 (epoch) so we never
  // crash on the type guarantee.
  if (sub.cancel_at) return new Date(sub.cancel_at * 1000);
  return new Date(0);
}

function readPriceId(sub: Stripe.Subscription): string {
  const price = sub.items?.data[0]?.price;
  if (!price) return '';
  return typeof price === 'string' ? price : price.id;
}

/**
 * Upsert a subscription row from a Stripe.Subscription object. Used by:
 *   1. checkout.session.completed (initial creation)
 *   2. customer.subscription.updated (status / period changes)
 *   3. customer.subscription.deleted (terminal cancellation)
 *
 * Always reads userId from sub.metadata.userId (set when creating the
 * Checkout Session). If the metadata is missing, falls back to the optional
 * fallbackUserId param so callers that already know the user (like the
 * checkout-session handler) can pass it.
 */
export async function syncSubscriptionFromStripe(
  sub: Stripe.Subscription,
  fallbackUserId?: string,
): Promise<void> {
  const userId = sub.metadata?.userId ?? fallbackUserId;
  if (!userId) {
    throw new Error('subscription_missing_user_id');
  }

  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  await db
    .insert(subscriptions)
    .values({
      id: sub.id,
      userId,
      stripeCustomerId: customerId,
      status: sub.status,
      priceId: readPriceId(sub),
      currentPeriodEnd: readPeriodEnd(sub),
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    })
    .onConflictDoUpdate({
      target: subscriptions.id,
      set: {
        status: sub.status,
        priceId: readPriceId(sub),
        currentPeriodEnd: readPeriodEnd(sub),
        cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
        stripeCustomerId: customerId,
      },
    });
}
