import 'server-only';
import { auth } from '@clerk/nextjs/server';

import { getCurrentSubscription } from '@/lib/stripe/subscription';
import { toView, type SubscriptionView } from '@/lib/subscription-view';

/**
 * Server-side reader for the current user's subscription state.
 *
 * The view type and the pure row→view mapper live in `lib/subscription-view.ts`
 * and are re-exported below, so `@/lib/subscription` remains the single import
 * for server components while anything that can't take a `server-only`
 * dependency (the client hook's type import, the test suite) can reach the
 * pure half directly.
 *
 * Read this ONCE at the layout level; child pages that already hold the row
 * should call `toView(sub)` rather than querying again.
 */
export async function getSubscriptionView(): Promise<SubscriptionView> {
  const { userId } = await auth();
  if (!userId) return { state: 'free' };
  const sub = await getCurrentSubscription(userId);
  return toView(sub);
}

export { toView, isActiveView, hasActiveSubscription } from '@/lib/subscription-view';
export type { SubscriptionView } from '@/lib/subscription-view';
