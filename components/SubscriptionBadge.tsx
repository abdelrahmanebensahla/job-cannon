'use client';

import { useSubscription } from '@/hooks/use-subscription';
import { formatShortDate } from '@/lib/date';
import { cn } from '@/lib/utils';

/**
 * Compact subscription pill for the global header. Status is conveyed
 * through typography + position, never color — except 'past_due' which
 * uses the single destructive red accent per the locked design system.
 */
export function SubscriptionBadge({ className }: { className?: string }) {
  const sub = useSubscription();

  if (sub.state === 'loading') {
    // Render an empty placeholder of equivalent width so layout doesn't
    // shift when hydration completes.
    return <span className={cn('inline-block h-5 w-12', className)} aria-hidden />;
  }

  const base = 'inline-flex items-center border px-2 py-0.5 text-[0.75rem] tracking-wide uppercase';

  if (sub.state === 'past_due') {
    return (
      <span
        className={cn(base, 'border-destructive text-destructive', className)}
      >
        Past due
      </span>
    );
  }

  let label: string;
  switch (sub.state) {
    case 'trialing':
      label = `Trial · ${sub.daysRemaining}d`;
      break;
    case 'active':
      label = 'Active';
      break;
    case 'canceled':
      label = `Canceled · ends ${formatShortDate(sub.endsAt)}`;
      break;
    case 'free':
      label = 'Free';
      break;
    default:
      return null;
  }

  return (
    <span className={cn(base, 'border-border text-muted-foreground', className)}>{label}</span>
  );
}
