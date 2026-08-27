import { hasActiveSubscription, type Subscription } from '@/db/schema';

/**
 * The pure half of the subscription contract: the view type and the mapper
 * from a database row to it. No `auth()`, no queries, no `server-only`.
 *
 * Split out of `lib/subscription.ts` so it can be imported from anywhere —
 * including the client hook's type import and the test suite. The server-side
 * reader (`getSubscriptionView`) lives next door and re-exports everything
 * here, so existing `@/lib/subscription` imports are unaffected.
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
  // Ceil, not floor: a trial with six hours left is still a day the user has.
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/**
 * Pure mapper from a subscription row to the view model. Use it whenever you
 * already hold the row — a second `getSubscriptionView()` call would issue an
 * identical query for data you have.
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

/** Convenience guard for pages that want a single boolean. */
export function isActiveView(view: SubscriptionView): boolean {
  return view.state === 'trialing' || view.state === 'active';
}

// Keep parity with the DB helper for callers importing from one place.
export { hasActiveSubscription };
