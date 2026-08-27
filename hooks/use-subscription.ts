'use client';

import { createContext, useContext } from 'react';

import type { SubscriptionView } from '@/lib/subscription-view';

/**
 * Subscription state context. Hydrated server-side by <SubscriptionProvider />
 * in app/layout.tsx so every client component reads from the same snapshot
 * without an extra fetch.
 *
 * The 'loading' state is the default before hydration completes; in practice
 * the provider always passes a server-resolved value, so 'loading' is rare.
 */
const SubscriptionContext = createContext<SubscriptionView>({ state: 'loading' });

export function useSubscription(): SubscriptionView {
  return useContext(SubscriptionContext);
}

export { SubscriptionContext };
