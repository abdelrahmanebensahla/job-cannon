import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { appUrl } from '@/lib/app-url';
import { getStripe } from '@/lib/stripe/client';
import { getCurrentSubscription } from '@/lib/stripe/subscription';

export const runtime = 'nodejs';

type PortalResponse = { ok: true; url: string } | { ok: false; error: string };

function fail(error: string, status = 400): NextResponse<PortalResponse> {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(): Promise<NextResponse<PortalResponse>> {
  const { userId } = await auth();
  if (!userId) return fail('unauthorized', 401);

  const sub = await getCurrentSubscription(userId);
  if (!sub) return fail('no_subscription', 404);
  if (!sub.stripeCustomerId) return fail('no_stripe_customer', 404);

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: appUrl('/dashboard'),
    });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (e) {
    console.error('Stripe portal.create failed:', e);
    return fail('stripe_portal_failed', 502);
  }
}
