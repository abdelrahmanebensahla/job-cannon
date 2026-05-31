import 'server-only';
import { auth } from '@clerk/nextjs/server';

import { getCurrentSubscription } from '@/lib/stripe/subscription';
import { hasActiveSubscription, type Subscription } from '@/db/schema';

/**
 * Discriminated view of the current user's subscription state. The single
 * shape consumed by <SubscriptionBadge />, <SubscriptionStatusBlock />, the
 * AppHeader, and any page that needs to gate by sub state.
 *
 * Read once at the layout level; do NOT re-query in child pages.
 */
export type SubscriptionView =
  | { state: 'loading' }
  | { state: 'free' }
  | { state: 'trialing'; daysRemaining: number; endsAt: string }
  | { state: 'active'; renewsAt: string; interval: 'month' | 'year' }
  | { state: 'past_due'; endsAt: string }
  | { state: 'canceled'; endsAt: string };

function intervalFromPriceId(priceId: string): 'month' | 'year' {
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY) return 'year';
  return 'month';
}

function daysBetween(end: Date, now: Date): number {
  const ms = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/**
 * Pure mapper from a subscription row to the view model. Exported so a server
 * component that already holds the row can derive the view without a second
 * query — e.g. the landing page, which also needs `hasActiveSubscription(sub)`
 * for the entitlement gate and so fetches the row directly.
 */
export function toView(sub: Subscription | null, now: Date = new Date()): SubscriptionView {
  if (!sub) return { state: 'free' };

  const endsAt = sub.currentPeriodEnd;
  const endsAtIso = endsAt.toISOString();
  const interval = intervalFromPriceId(sub.priceId);

  if (sub.status === 'trialing') {
    return {
      state: 'trialing',
      daysRemaining: daysBetween(endsAt, now),
      endsAt: endsAtIso,
    };
  }
  if (sub.status === 'active') {
    return { state: 'active', renewsAt: endsAtIso, interval };
  }
  if (sub.status === 'past_due') {
    return { state: 'past_due', endsAt: endsAtIso };
  }
  // 'canceled' | 'incomplete' | anything else maps to canceled for view purposes.
  return { state: 'canceled', endsAt: endsAtIso };
}

/**
 * Read the current user's subscription view. Safe to call from any server
 * component, layout, or server action. Returns 'free' (effectively a
 * signed-out marker) if the user is not authenticated.
 */
export async function getSubscriptionView(): Promise<SubscriptionView> {
  const { userId } = await auth();
  if (!userId) return { state: 'free' };
  const sub = await getCurrentSubscription(userId);
  return toView(sub);
}

/**
 * Convenience guard for pages that want a single boolean.
 */
export function isActiveView(view: SubscriptionView): boolean {
  return view.state === 'trialing' || view.state === 'active';
}

// Keep parity with the legacy DB helper while we migrate callers.
export { hasActiveSubscription };
