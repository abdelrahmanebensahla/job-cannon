import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { firstNameFromEmail } from '@/lib/email/greeting';
import { stripHtml } from '@/lib/scrapers/html';
import { clientIpFrom, hashIp } from '@/lib/rate-limit';

describe('firstNameFromEmail', () => {
  it('title-cases the first token of the local part', () => {
    assert.equal(firstNameFromEmail('ada.lovelace@example.com'), 'Ada');
    assert.equal(firstNameFromEmail('ADA@example.com'), 'Ada');
  });

  it('splits on dots, underscores, plus signs and hyphens', () => {
    assert.equal(firstNameFromEmail('grace_hopper@example.com'), 'Grace');
    assert.equal(firstNameFromEmail('alan+jobs@example.com'), 'Alan');
    assert.equal(firstNameFromEmail('kat-mck@example.com'), 'Kat');
  });

  it('strips trailing digits', () => {
    assert.equal(firstNameFromEmail('linus42@example.com'), 'Linus');
  });

  it('falls back rather than greeting someone by nothing', () => {
    assert.equal(firstNameFromEmail('not-an-email'), 'there');
    assert.equal(firstNameFromEmail(''), 'there');
    assert.equal(firstNameFromEmail('@example.com'), 'there');
    assert.equal(firstNameFromEmail('123@example.com'), 'there');
  });

  it('honours a custom fallback', () => {
    assert.equal(firstNameFromEmail('', 'friend'), 'friend');
  });
});

describe('stripHtml', () => {
  it('removes tags and collapses whitespace', () => {
    assert.equal(stripHtml('<p>Hello   <b>world</b></p>'), 'Hello world');
  });

  it('turns block ends and <br> into newlines', () => {
    // The opening <p> collapses to a space, so the second line keeps a leading
    // one. Asserting the line split rather than exact whitespace.
    assert.deepEqual(
      stripHtml('<p>One</p><p>Two</p>').split('\n').map(l => l.trim()),
      ['One', 'Two'],
    );
    assert.equal(stripHtml('One<br/>Two'), 'One\nTwo');
  });

  it('drops script and style bodies entirely', () => {
    assert.equal(stripHtml('<script>alert(1)</script>Text'), 'Text');
    assert.equal(stripHtml('<style>.a{color:red}</style>Text'), 'Text');
  });

  it('decodes entities, including the double-escaped ones Greenhouse sends', () => {
    assert.equal(stripHtml('R&amp;D'), 'R&D');
    assert.equal(stripHtml('&amp;lt;p&amp;gt;Hi&amp;lt;/p&amp;gt;'), 'Hi');
    assert.equal(stripHtml('caf&#233;'), 'café');
    assert.equal(stripHtml('caf&#xE9;'), 'café');
  });

  it('truncates to the cap', () => {
    assert.equal(stripHtml('x'.repeat(5000)).length, 4000);
    assert.equal(stripHtml('x'.repeat(5000), 100).length, 100);
  });

  it('returns empty string for empty input', () => {
    assert.equal(stripHtml(''), '');
  });
});

describe('clientIpFrom', () => {
  it('prefers the platform-set header a caller cannot spoof', () => {
    const h = new Headers({
      'x-vercel-forwarded-for': '203.0.113.5',
      'x-forwarded-for': '10.0.0.1',
      'x-real-ip': '10.0.0.2',
    });
    assert.equal(clientIpFrom(h), '203.0.113.5');
  });

  it('takes the first entry of a proxy chain', () => {
    const h = new Headers({ 'x-forwarded-for': '203.0.113.5, 70.41.3.18, 150.172.238.178' });
    assert.equal(clientIpFrom(h), '203.0.113.5');
  });

  it('falls back to x-real-ip, then null', () => {
    assert.equal(clientIpFrom(new Headers({ 'x-real-ip': '203.0.113.9' })), '203.0.113.9');
    assert.equal(clientIpFrom(new Headers()), null);
  });
});

describe('hashIp', () => {
  it('is stable for the same address', () => {
    assert.equal(hashIp('203.0.113.5'), hashIp('203.0.113.5'));
  });

  it('separates different addresses', () => {
    assert.notEqual(hashIp('203.0.113.5'), hashIp('203.0.113.6'));
  });

  it('never returns the address itself', () => {
    const ip = '203.0.113.5';
    const h = hashIp(ip);
    assert.ok(!h.includes(ip));
    assert.match(h, /^[0-9a-f]{32}$/);
  });
});
