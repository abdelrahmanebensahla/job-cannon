import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DIGEST_RETENTION_DAYS,
  daysAgoInET,
  formatLongDate,
  formatShortDate,
  todayInET,
} from '@/lib/date';

// These helpers exist because of two real bugs: a digest keyed to the wrong
// day, and an "Invalid time value" crash when a full ISO string hit a parser
// that only expected YYYY-MM-DD. The tests pin both.
describe('todayInET', () => {
  it('uses the ET calendar day, not UTC', () => {
    // 03:00 UTC on the 28th is still 23:00 on the 27th in New York.
    assert.equal(todayInET(new Date('2026-08-28T03:00:00Z')), '2026-08-27');
  });

  it('rolls over at ET midnight, not UTC midnight', () => {
    assert.equal(todayInET(new Date('2026-08-28T04:00:00Z')), '2026-08-28');
  });

  it('always returns a sortable YYYY-MM-DD string', () => {
    assert.match(todayInET(new Date('2026-01-05T18:00:00Z')), /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('daysAgoInET', () => {
  it('walks back whole days on the ET calendar', () => {
    assert.equal(daysAgoInET(1, new Date('2026-08-28T18:00:00Z')), '2026-08-27');
    assert.equal(daysAgoInET(30, new Date('2026-08-28T18:00:00Z')), '2026-07-29');
  });

  it('agrees with the retention constant the policy promises', () => {
    assert.equal(DIGEST_RETENTION_DAYS, 30);
  });

  it('crosses a month boundary correctly', () => {
    assert.equal(daysAgoInET(5, new Date('2026-03-03T18:00:00Z')), '2026-02-26');
  });
});

describe('formatShortDate / formatLongDate', () => {
  it('formats a date-only string without slipping a day westward', () => {
    // The naive `new Date('2026-08-27')` parses as UTC midnight, which is the
    // 26th in ET. The noon-UTC anchor is what prevents that.
    assert.equal(formatShortDate('2026-08-27'), 'Aug 27');
    assert.equal(formatLongDate('2026-08-27'), 'August 27, 2026');
  });

  it('accepts a full ISO string — the SubscriptionView case', () => {
    // Before the length check, this path built '2026-08-27T12:00:00.000ZT12:00:00Z'
    // and threw "Invalid time value" at format time.
    assert.doesNotThrow(() => formatShortDate('2026-08-27T18:30:00.000Z'));
    assert.equal(formatShortDate('2026-08-27T18:30:00.000Z'), 'Aug 27');
  });

  it('accepts a Date instance', () => {
    assert.equal(formatShortDate(new Date('2026-08-27T18:30:00.000Z')), 'Aug 27');
  });

  it('handles the first of a month in both formats', () => {
    assert.equal(formatLongDate('2026-01-01'), 'January 1, 2026');
    assert.equal(formatLongDate('2026-01-01T12:00:00.000Z'), 'January 1, 2026');
  });
});
