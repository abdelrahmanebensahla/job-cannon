'use client';

import { SubscriptionContext } from '@/hooks/use-subscription';
import type { SubscriptionView } from '@/lib/subscription';

export function SubscriptionProvider({
  value,
  children,
}: {
  value: SubscriptionView;
  children: React.ReactNode;
}) {
  return (
    <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
  );
}
