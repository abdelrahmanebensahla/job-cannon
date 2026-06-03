import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { z } from 'zod';

import { ensureUser } from '@/lib/auth/ensure-user';
import { appUrl } from '@/lib/app-url';
import { getStripe, resolvePriceId, TRIAL_PERIOD_DAYS } from '@/lib/stripe/client';
import { getCurrentSubscription } from '@/lib/stripe/subscription';
import { ACTIVE_SUB_STATUSES } from '@/db/schema';

export const runtime = 'nodejs';

const BodySchema = z.object({
  priceId: z.enum(['monthly', 'yearly']),
});

type CheckoutResponse =
  | { ok: true; url: string }
  | { ok: false; error: string; detail?: string };

function fail(
  error: string,
  status = 400,
  detail?: string,
): NextResponse<CheckoutResponse> {
  return NextResponse.json(
    detail ? { ok: false, error, detail } : { ok: false, error },
    { status },
  );
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

  // Subscription history drives both the duplicate guard and trial eligibility.
  const existing = await getCurrentSubscription(userId);

  // Duplicate-subscription guard: if they already have a live plan, don't open a
  // second one — direct them to the Customer Portal to manage the existing one.
  if (existing && (ACTIVE_SUB_STATUSES as readonly string[]).includes(existing.status)) {
    return fail('already_subscribed', 409);
  }

  // One Stripe customer per user: reuse the customer from any prior subscription,
  // otherwise create one stamped with the Clerk user_id. Never `customer_email`,
  // which makes Checkout mint a brand-new customer on every session.
  let customerId = existing?.stripeCustomerId ?? null;
  if (!customerId) {
    try {
      const customer = await getStripe().customers.create({
        email: userEmail,
        metadata: { userId },
      });
      customerId = customer.id;
    } catch (e) {
      console.error('Stripe customer.create failed:', e);
      return fail('stripe_checkout_failed', 502, e instanceof Error ? e.message : 'unknown');
    }
  }

  // Trial eligibility: first-time subscribers only. ANY prior subscriptions row
  // (even canceled) means they've already trialed/subscribed, so no trial. This
  // closes the observed bug — cancel, then re-sign-up on the SAME Clerk account
  // to get a second trial. A determined user with a fresh email + card can still
  // trial once; not worth fingerprinting/captcha at this scale.
  const trialEligible = existing === null;

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      customer: customerId,
      success_url: appUrl('/dashboard?welcome=1'),
      cancel_url: appUrl('/pricing?canceled=1'),
      allow_promotion_codes: true,
      subscription_data: {
        // Trial only for first-time subscribers (see trialEligible above).
        ...(trialEligible ? { trial_period_days: TRIAL_PERIOD_DAYS } : {}),
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
    const detail = e instanceof Error ? e.message : 'unknown';
    return fail('stripe_checkout_failed', 502, detail);
  }
}
