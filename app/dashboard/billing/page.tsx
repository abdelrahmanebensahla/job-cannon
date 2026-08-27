import { auth } from '@clerk/nextjs/server';

import { PortalButton } from '@/components/PortalButton';
import { SubscriptionStatusBlock } from '@/components/SubscriptionStatusBlock';
import { getCurrentSubscription } from '@/lib/stripe/subscription';
import { toView } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

function planLabel(priceId: string | null | undefined): string {
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY) return 'Monthly';
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY) return 'Annual';
  return 'Custom';
}

function planPrice(priceId: string | null | undefined): string {
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY) return '$8 / month';
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY) return '$60 / year';
  return '—';
}

export default async function DashboardBillingPage() {
  const { userId } = await auth();
  // One read, then derive. `getSubscriptionView()` would issue a second,
  // identical query for a row we're already holding — `toView` is exported as
  // a pure mapper for exactly this case. The layout guarantees an active
  // subscription exists before this page renders.
  const sub = (await getCurrentSubscription(userId!))!;
  const view = toView(sub);

  return (
    <div className="space-y-12">
      <header>
        <h1 className="font-display text-4xl tracking-tight">Billing</h1>
        <p className="mt-2 text-[0.9375rem] text-muted-foreground">
          Subscription, invoices, and payment methods.
        </p>
      </header>

      <section className="border-t border-b border-border py-8">
        <div className="font-display text-3xl tracking-tight">
          {planLabel(sub.priceId)}
          <span className="text-muted-foreground"> · {planPrice(sub.priceId)}</span>
        </div>
        <div className="mt-4">
          <SubscriptionStatusBlock view={view} />
        </div>
      </section>

      <section className="border-t border-border pt-8">
        <h2 className="font-display text-xl tracking-tight">Manage subscription</h2>
        <p className="mt-2 max-w-prose text-[0.9375rem] text-muted-foreground">
          Cancel, switch plans, view invoices, or update your payment method in Stripe&apos;s hosted portal. You&apos;ll come back here when done.
        </p>
        <div className="mt-5">
          <PortalButton />
        </div>

        <p className="mt-8 text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
          Stripe customer
        </p>
        <p className="mt-1 font-mono text-[0.8125rem] text-foreground/80">{sub.stripeCustomerId}</p>
      </section>
    </div>
  );
}
