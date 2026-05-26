import { auth } from '@clerk/nextjs/server';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PortalButton } from '@/components/PortalButton';
import { getCurrentSubscription } from '@/lib/stripe/subscription';
import { formatLongDate } from '@/lib/date';

export const dynamic = 'force-dynamic';

function planLabel(priceId: string): string {
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY) return 'Monthly · $9/mo';
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY) return 'Annual · $80/yr';
  return 'Custom plan';
}

export default async function DashboardBillingPage() {
  const { userId } = await auth();
  const sub = (await getCurrentSubscription(userId!))!;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Subscription, invoices, and payment methods.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-base font-semibold tracking-tight">{planLabel(sub.priceId)}</h2>
            <Badge variant="secondary" className="capitalize">
              {sub.status}
            </Badge>
            {sub.cancelAtPeriodEnd && <Badge variant="outline">Cancels at period end</Badge>}
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">
                {sub.cancelAtPeriodEnd ? 'Access through' : 'Renews on'}
              </dt>
              <dd className="font-medium">{formatLongDate(sub.currentPeriodEnd)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Stripe customer</dt>
              <dd className="truncate font-mono text-xs text-foreground/80">
                {sub.stripeCustomerId}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <section className="space-y-3 border-t pt-6">
        <h2 className="text-lg font-semibold tracking-tight">Manage subscription</h2>
        <p className="text-sm text-muted-foreground">
          Cancellations, plan changes, invoices, and payment-method updates all live in Stripe&apos;s
          hosted portal. You&apos;ll come back here when done.
        </p>
        <PortalButton />
      </section>
    </div>
  );
}
