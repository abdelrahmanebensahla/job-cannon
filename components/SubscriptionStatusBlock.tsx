import { formatLongDate } from '@/lib/date';
import type { SubscriptionView } from '@/lib/subscription-view';

const MONTHLY_PRICE = '$8/month';
const YEARLY_PRICE = '$60/year';

/**
 * Full subscription status block for /dashboard/billing. Server component;
 * receives the view directly rather than reading from the client hook so
 * the page can stay server-rendered.
 */
export function SubscriptionStatusBlock({ view }: { view: SubscriptionView }) {
  if (view.state === 'free' || view.state === 'loading') {
    return (
      <p className="text-[0.8125rem] text-muted-foreground">
        No active subscription on file. <a href="/pricing" className="text-foreground underline underline-offset-2">See pricing →</a>
      </p>
    );
  }

  if (view.state === 'trialing') {
    return (
      <p className="text-[0.8125rem]">
        <span className="font-medium text-foreground">Free trial</span>
        <span className="text-muted-foreground">
          {' '}· ends {formatLongDate(view.endsAt)} · then {MONTHLY_PRICE}
        </span>
      </p>
    );
  }

  if (view.state === 'active') {
    const cadence = view.interval === 'year' ? YEARLY_PRICE : MONTHLY_PRICE;
    return (
      <p className="text-[0.8125rem]">
        <span className="font-medium text-foreground">Active</span>
        <span className="text-muted-foreground">
          {' '}· renews {formatLongDate(view.renewsAt)} · {cadence}
        </span>
      </p>
    );
  }

  if (view.state === 'past_due') {
    return (
      <p className="text-[0.8125rem] text-destructive">
        Payment failed · update your card to continue receiving digests.
      </p>
    );
  }

  // canceled
  return (
    <p className="text-[0.8125rem]">
      <span className="font-medium text-foreground">Canceled</span>
      <span className="text-muted-foreground">
        {' '}· access ends {formatLongDate(view.endsAt)}
      </span>
    </p>
  );
}
