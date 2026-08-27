import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { hasActiveSubscription, type Subscription } from '@/db/schema';
import { toView, isActiveView } from '@/lib/subscription-view';

const NOW = new Date('2026-08-27T12:00:00Z');
const FUTURE = new Date('2026-09-27T12:00:00Z');
const PAST = new Date('2026-07-27T12:00:00Z');

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub_test',
    userId: 'user_test',
    stripeCustomerId: 'cus_test',
    status: 'active',
    priceId: 'price_monthly',
    currentPeriodEnd: FUTURE,
    cancelAtPeriodEnd: false,
    createdAt: PAST,
    ...overrides,
  };
}

// This function decides who gets into /dashboard and who gets bounced to
// /pricing. It is the entitlement check for a paid product, so the cases
// below are the ones that would cost money or lock out a paying customer.
describe('hasActiveSubscription', () => {
  it('grants access while trialing', () => {
    assert.equal(hasActiveSubscription(sub({ status: 'trialing' })), true);
  });

  it('grants access while active', () => {
    assert.equal(hasActiveSubscription(sub({ status: 'active' })), true);
  });

  it('keeps access for a canceled sub whose paid period has not elapsed', () => {
    // Stripe flips status to canceled immediately on cancel-now but honours
    // the window already paid for. Bouncing them out here would be taking
    // money for access we then denied.
    assert.equal(
      hasActiveSubscription(sub({ status: 'canceled', currentPeriodEnd: FUTURE })),
      true,
    );
  });

  it('revokes access once a canceled period has elapsed', () => {
    assert.equal(
      hasActiveSubscription(sub({ status: 'canceled', currentPeriodEnd: PAST })),
      false,
    );
  });

  it('denies past_due and incomplete — no dunning grace period in v1', () => {
    assert.equal(hasActiveSubscription(sub({ status: 'past_due' })), false);
    assert.equal(hasActiveSubscription(sub({ status: 'incomplete' })), false);
  });

  it('denies when there is no subscription at all', () => {
    assert.equal(hasActiveSubscription(null), false);
    assert.equal(hasActiveSubscription(undefined), false);
  });
});

describe('toView', () => {
  it('maps a missing subscription to free', () => {
    assert.deepEqual(toView(null, NOW), { state: 'free' });
  });

  it('reports whole days remaining on a trial, rounding up', () => {
    const view = toView(
      sub({ status: 'trialing', currentPeriodEnd: new Date('2026-08-30T18:00:00Z') }),
      NOW,
    );
    assert.equal(view.state, 'trialing');
    // 3 days 6 hours out still reads as "4d" — a partial day is a day the
    // user still has, so ceil is the honest direction to round.
    assert.equal(view.state === 'trialing' && view.daysRemaining, 4);
  });

  it('never reports negative days for an expired trial', () => {
    const view = toView(sub({ status: 'trialing', currentPeriodEnd: PAST }), NOW);
    assert.equal(view.state === 'trialing' && view.daysRemaining, 0);
  });

  it('resolves the billing interval from the configured price ids', () => {
    process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY = 'price_yearly';
    assert.equal(
      toView(sub({ status: 'active', priceId: 'price_yearly' }), NOW).state === 'active' &&
        (toView(sub({ status: 'active', priceId: 'price_yearly' }), NOW) as { interval: string })
          .interval,
      'year',
    );
    assert.equal(
      (toView(sub({ status: 'active', priceId: 'price_monthly' }), NOW) as { interval: string })
        .interval,
      'month',
    );
    delete process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY;
  });

  it('surfaces past_due as its own state so the UI can flag it', () => {
    assert.equal(toView(sub({ status: 'past_due' }), NOW).state, 'past_due');
  });

  it('collapses unknown statuses to canceled rather than throwing', () => {
    assert.equal(toView(sub({ status: 'unpaid' }), NOW).state, 'canceled');
  });

  it('emits ISO strings, which lib/date can parse back', () => {
    const view = toView(sub({ status: 'active' }), NOW);
    assert.equal(view.state === 'active' && typeof view.renewsAt, 'string');
    assert.ok(!Number.isNaN(Date.parse((view as { renewsAt: string }).renewsAt)));
  });
});

describe('isActiveView', () => {
  it('treats only trialing and active as live', () => {
    assert.equal(isActiveView({ state: 'trialing', daysRemaining: 3, endsAt: '' }), true);
    assert.equal(isActiveView({ state: 'active', renewsAt: '', interval: 'month' }), true);
    assert.equal(isActiveView({ state: 'canceled', endsAt: '' }), false);
    assert.equal(isActiveView({ state: 'free' }), false);
  });
});
