import Link from 'next/link';

import { CheckoutButton } from '@/components/PricingClient';

type SearchParams = Promise<{ canceled?: string }>;

const FEATURES = [
  'Daily ranked top 10 startup matches',
  'Email digest at 8am ET, weekdays',
  '30-day match history dashboard',
  'Resume re-upload anytime',
  'Cancel anytime via Stripe portal',
];

function Plan({
  name,
  price,
  cadence,
  description,
  priceKey,
  badge,
}: {
  name: string;
  price: string;
  cadence: string;
  description: string;
  priceKey: 'monthly' | 'yearly';
  badge?: string;
}) {
  return (
    <div className="border border-border p-8">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl tracking-tight">{name}</h2>
        {badge && (
          <span className="border border-foreground px-2 py-0.5 text-[0.6875rem] uppercase tracking-wide">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1 text-[0.8125rem] text-muted-foreground">{description}</p>

      <div className="mt-8 flex items-baseline gap-2">
        <span className="font-display text-[3.5rem] leading-none tracking-tight">{price}</span>
        <span className="text-[0.9375rem] text-muted-foreground">{cadence}</span>
      </div>

      <ul className="mt-8 space-y-2.5 text-[0.9375rem] text-foreground/85">
        {FEATURES.map(f => (
          <li key={f} className="flex items-baseline gap-2">
            <span className="text-muted-foreground" aria-hidden>
              —
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8 border-t border-border pt-6">
        <CheckoutButton priceKey={priceKey} label="Start free trial" />
      </div>
    </div>
  );
}

export default async function PricingPage(props: { searchParams: SearchParams }) {
  const { canceled } = await props.searchParams;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
      <header className="mb-16 text-center">
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
          One plan, your choice of cadence.
        </h1>
        <p className="mt-4 max-w-xl mx-auto text-[0.9375rem] text-muted-foreground">
          7-day free trial on both. Cancel any time before it ends and you won&apos;t be charged.
        </p>
      </header>

      {canceled && (
        <div className="mb-10 border border-border px-5 py-4 text-[0.9375rem]">
          Checkout canceled — your account is unchanged. Pick a plan when you&apos;re ready.
        </div>
      )}

      <section className="grid gap-6 sm:grid-cols-2">
        <Plan
          name="Monthly"
          price="$8"
          cadence="/ month"
          description="Pay as you go."
          priceKey="monthly"
        />
        <Plan
          name="Annual"
          price="$60"
          cadence="/ year"
          description="Four months free."
          priceKey="yearly"
          badge="Save $36"
        />
      </section>

      <p className="mt-12 text-center text-[0.8125rem] text-muted-foreground">
        By starting a trial you agree to our{' '}
        <Link href="/terms" className="text-foreground underline underline-offset-2">
          terms
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="text-foreground underline underline-offset-2">
          privacy policy
        </Link>
        . Payments are processed by Stripe.
      </p>
    </main>
  );
}
