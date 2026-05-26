import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { z } from 'zod';

import { ensureUser } from '@/lib/auth/ensure-user';
import { appUrl } from '@/lib/app-url';
import { getStripe, resolvePriceId, TRIAL_PERIOD_DAYS } from '@/lib/stripe/client';

export const runtime = 'nodejs';

const BodySchema = z.object({
  priceId: z.enum(['monthly', 'yearly']),
});

type CheckoutResponse = { ok: true; url: string } | { ok: false; error: string };

function fail(error: string, status = 400): NextResponse<CheckoutResponse> {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request): Promise<NextResponse<CheckoutResponse>> {
  const { userId } = await auth();
  if (!userId) return fail('unauthorized', 401);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail('invalid_json');
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return fail('invalid_body');

  let priceId: string;
  try {
    priceId = resolvePriceId(parsed.data.priceId);
  } catch (e) {
    console.error('Stripe price not configured:', e);
    return fail('price_not_configured', 500);
  }

  let userEmail: string | undefined;
  try {
    const u = await currentUser();
    const primary = u?.emailAddresses.find(e => e.id === u.primaryEmailAddressId);
    userEmail = primary?.emailAddress ?? u?.emailAddresses[0]?.emailAddress;
  } catch (e) {
    console.warn('currentUser lookup failed:', e);
  }

  // Make sure the user row exists locally — useful for downstream queries
  // when the webhook fires.
  try {
    await ensureUser(userId);
  } catch (e) {
    console.error('ensureUser failed in checkout:', e);
    if (e instanceof Error && e.message === 'email_conflict') {
      return fail('email_conflict', 409);
    }
    return fail('user_not_provisioned', 500);
  }

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      customer_email: userEmail,
      success_url: appUrl('/dashboard?welcome=1'),
      cancel_url: appUrl('/pricing?canceled=1'),
      allow_promotion_codes: true,
      subscription_data: {
        // Trial moved off the Price object in current Stripe — set it here.
        trial_period_days: TRIAL_PERIOD_DAYS,
        // Stamp the Clerk userId on the subscription itself so future
        // subscription.* webhook events can route to the right user without
        // needing the original Session.
        metadata: { userId },
      },
      metadata: { userId },
    });

    if (!session.url) return fail('no_session_url', 500);
    return NextResponse.json({ ok: true, url: session.url });
  } catch (e) {
    console.error('Stripe checkout.create failed:', e);
    return fail('stripe_checkout_failed', 502);
  }
}
