import Stripe from 'stripe';

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
    client = new Stripe(key, {
      // No apiVersion — let the SDK pick the version it's typed against
      // (currently 2025-04-30+). Avoids us drifting from the type defs.
      typescript: true,
      appInfo: { name: 'Job Cannon', version: '0.1.0' },
    });
  }
  return client;
}

export type PriceKey = 'monthly' | 'yearly';

export function resolvePriceId(key: PriceKey): string {
  const id =
    key === 'monthly'
      ? process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY
      : process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY;
  if (!id) throw new Error(`price_not_configured:${key}`);
  return id;
}

export const TRIAL_PERIOD_DAYS = 7;
