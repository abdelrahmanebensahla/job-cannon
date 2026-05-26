import Link from 'next/link';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckoutButton } from '@/components/PricingClient';

type SearchParams = Promise<{ canceled?: string }>;

const FEATURES = [
  'Daily ranked top 10 startup matches',
  'Email digest at 8am ET, weekdays',
  '30-day match history dashboard',
  'Resume re-upload anytime',
  'Cancel anytime via Stripe portal',
];

export default async function PricingPage(props: { searchParams: SearchParams }) {
  const { canceled } = await props.searchParams;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          One plan, your choice of cadence.
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          7-day free trial on both. Cancel any time before the trial ends and you won't be charged.
        </p>
      </header>

      {canceled && (
        <Card className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30">
          <CardContent className="p-4 text-sm">
            Checkout canceled — your account is unchanged. Pick a plan whenever you&apos;re ready.
          </CardContent>
        </Card>
      )}

      <section className="grid gap-6 sm:grid-cols-2">
        {/* Monthly */}
        <Card>
          <CardContent className="space-y-5 p-6">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Monthly</h2>
              <p className="mt-1 text-sm text-muted-foreground">Pay as you go.</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-semibold tracking-tight">$9</span>
              <span className="text-sm text-muted-foreground">/month</span>
            </div>
            <ul className="space-y-2 text-sm text-foreground/90">
              {FEATURES.map(f => (
                <li key={f}>· {f}</li>
              ))}
            </ul>
            <CheckoutButton priceKey="monthly" label="Start free trial" />
          </CardContent>
        </Card>

        {/* Annual */}
        <Card className="relative border-foreground/30">
          <div className="absolute -top-3 right-6">
            <Badge variant="secondary">Save $28</Badge>
          </div>
          <CardContent className="space-y-5 p-6">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Annual</h2>
              <p className="mt-1 text-sm text-muted-foreground">Two months free.</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-semibold tracking-tight">$80</span>
              <span className="text-sm text-muted-foreground">/year</span>
            </div>
            <ul className="space-y-2 text-sm text-foreground/90">
              {FEATURES.map(f => (
                <li key={f}>· {f}</li>
              ))}
            </ul>
            <CheckoutButton priceKey="yearly" label="Start free trial" />
          </CardContent>
        </Card>
      </section>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        By starting a trial you agree to our{' '}
        <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
          terms
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          privacy policy
        </Link>
        . Payments are processed by Stripe.
      </p>
    </main>
  );
}
