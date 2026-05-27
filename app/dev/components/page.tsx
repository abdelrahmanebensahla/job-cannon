import { notFound } from 'next/navigation';

import { SubscriptionBadge } from '@/components/SubscriptionBadge';
import { SubscriptionProvider } from '@/components/SubscriptionProvider';
import { SubscriptionStatusBlock } from '@/components/SubscriptionStatusBlock';
import type { SubscriptionView } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

const NOW = new Date('2026-05-26T12:00:00Z');

const STATES: { label: string; view: SubscriptionView }[] = [
  { label: 'free', view: { state: 'free' } },
  {
    label: 'trialing · 4 days',
    view: {
      state: 'trialing',
      daysRemaining: 4,
      endsAt: new Date(NOW.getTime() + 4 * 86_400_000).toISOString(),
    },
  },
  {
    label: 'trialing · 1 day',
    view: {
      state: 'trialing',
      daysRemaining: 1,
      endsAt: new Date(NOW.getTime() + 1 * 86_400_000).toISOString(),
    },
  },
  {
    label: 'active · monthly',
    view: {
      state: 'active',
      renewsAt: new Date(NOW.getTime() + 28 * 86_400_000).toISOString(),
      interval: 'month',
    },
  },
  {
    label: 'active · yearly',
    view: {
      state: 'active',
      renewsAt: new Date(NOW.getTime() + 300 * 86_400_000).toISOString(),
      interval: 'year',
    },
  },
  {
    label: 'past_due',
    view: {
      state: 'past_due',
      endsAt: new Date(NOW.getTime() + 7 * 86_400_000).toISOString(),
    },
  },
  {
    label: 'canceled',
    view: {
      state: 'canceled',
      endsAt: new Date(NOW.getTime() + 10 * 86_400_000).toISOString(),
    },
  },
  { label: 'loading', view: { state: 'loading' } },
];

export default function ComponentsReviewPage() {
  // Gate to non-production. The build emits this route in prod too, but the
  // guard makes it inaccessible behind the live domain.
  if (process.env.VERCEL_ENV === 'production') notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="font-display text-4xl tracking-tight">Components</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Visual review surface for the locked design system. Every subscription state ×
        every consumer component. Not visible in production.
      </p>

      <section className="mt-16 space-y-10">
        <SectionHeader title="Subscription badge" subtitle="Compact pill for global nav" />
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 font-normal">State</th>
              <th className="py-2 font-normal">Badge</th>
            </tr>
          </thead>
          <tbody>
            {STATES.map(({ label, view }) => (
              <tr key={label} className="border-b border-border">
                <td className="py-3 pr-6 text-muted-foreground">{label}</td>
                <td className="py-3">
                  <SubscriptionProvider value={view}>
                    <SubscriptionBadge />
                  </SubscriptionProvider>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-16 space-y-6">
        <SectionHeader title="Subscription status block" subtitle="For /dashboard/billing" />
        <div className="space-y-8">
          {STATES.filter(s => s.view.state !== 'loading').map(({ label, view }) => (
            <div key={label} className="border-t border-border pt-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <SubscriptionStatusBlock view={view} />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 space-y-6">
        <SectionHeader title="Type ramp" subtitle="Locked at 5 sizes max" />
        <div className="space-y-4 border-t border-border pt-6">
          <p className="font-display text-[3.5rem] leading-[1.05] tracking-tight">
            Display XL · hero
          </p>
          <p className="font-display text-4xl leading-tight tracking-tight">Display · h1</p>
          <p className="font-display text-xl leading-snug">Subhead · h2</p>
          <p className="text-[0.9375rem] leading-relaxed">
            Body — default text. Geist Sans, 15px, relaxed line-height.
          </p>
          <p className="text-[0.8125rem] text-muted-foreground">
            Caption — muted, 13px, used for metadata and helper copy.
          </p>
        </div>
      </section>

      <section className="mt-16 space-y-6">
        <SectionHeader title="Buttons" subtitle="3 levels, no more" />
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
          <button className="inline-flex h-9 items-center border border-foreground bg-foreground px-4 text-[0.8125rem] font-medium text-background transition-colors hover:bg-foreground/90">
            Primary
          </button>
          <button className="inline-flex h-9 items-center border border-border bg-background px-4 text-[0.8125rem] font-medium text-foreground transition-colors hover:bg-foreground/[0.04]">
            Secondary
          </button>
          <button className="inline-flex h-9 items-center px-2 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:text-foreground">
            Tertiary ↗
          </button>
        </div>
      </section>
    </main>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="font-display text-xl tracking-tight">{title}</h2>
      <p className="mt-1 text-[0.8125rem] text-muted-foreground">{subtitle}</p>
    </div>
  );
}
