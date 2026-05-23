import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import { getStripe } from '@/lib/stripe/client';
import { syncSubscriptionFromStripe } from '@/lib/stripe/subscription';

export const runtime = 'nodejs';

type WebhookResponse = { ok: true; handled: string } | { ok: false; error: string };

function fail(error: string, status = 400): NextResponse<WebhookResponse> {
  return NextResponse.json({ ok: false, error }, { status });
}

async function handleCheckoutSessionCompleted(
  event: Stripe.CheckoutSessionCompletedEvent,
): Promise<NextResponse<WebhookResponse>> {
  const session = event.data.object;
  if (session.mode !== 'subscription') {
    // One-off payments — not used in this app. Ack so Stripe doesn't retry.
    return NextResponse.json({ ok: true, handled: 'ignored:non_subscription_session' });
  }

  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id;
  if (!subscriptionId) return fail('session_missing_subscription', 422);

  const userId = session.client_reference_id ?? session.metadata?.userId;
  if (!userId) return fail('session_missing_user_reference', 422);

  // Retrieve the full subscription with prices expanded so we can read
  // the period end and price id reliably.
  const sub = await getStripe().subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price'],
  });
  await syncSubscriptionFromStripe(sub, userId);
  return NextResponse.json({ ok: true, handled: 'checkout.session.completed' });
}

async function handleSubscriptionEvent(
  event: Stripe.CustomerSubscriptionUpdatedEvent | Stripe.CustomerSubscriptionDeletedEvent,
): Promise<NextResponse<WebhookResponse>> {
  const sub = event.data.object;
  try {
    await syncSubscriptionFromStripe(sub);
    return NextResponse.json({ ok: true, handled: event.type });
  } catch (e) {
    if (e instanceof Error && e.message === 'subscription_missing_user_id') {
      // No metadata yet — likely a stray test event. Ack and ignore.
      console.warn(`${event.type} for ${sub.id} had no userId metadata; ignored.`);
      return NextResponse.json({ ok: true, handled: `${event.type}:ignored_no_user_id` });
    }
    throw e;
  }
}

export async function POST(request: Request): Promise<NextResponse<WebhookResponse>> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return fail('webhook_not_configured', 500);
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) return fail('missing_signature', 401);

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch (e) {
    console.warn('Stripe signature verification failed:', e instanceof Error ? e.message : e);
    return fail('invalid_signature', 401);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        return await handleCheckoutSessionCompleted(event);
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        return await handleSubscriptionEvent(event);
      default:
        return NextResponse.json({ ok: true, handled: `ignored:${event.type}` });
    }
  } catch (e) {
    console.error('Stripe webhook handler error:', e);
    return fail('handler_failed', 500);
  }
}
