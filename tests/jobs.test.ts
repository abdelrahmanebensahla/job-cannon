import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { preFilter } from '@/lib/jobs';
import type { Job, Profile } from '@/lib/types';

function job(overrides: Partial<Job> & { id: string }): Job {
  return {
    source: 'greenhouse',
    company: 'Acme',
    title: 'Software Engineer',
    location: 'Remote',
    remote: true,
    description: 'Build things.',
    url: 'https://example.com',
    posted_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function profile(skills: { name: string; years: number }[]): Profile {
  return {
    name: 'Test Candidate',
    target_roles: ['Software Engineer'],
    seniority: 'mid',
    skills,
    locations: [],
    remote_ok: true,
    summary: 'A candidate.',
  };
}

describe('preFilter', () => {
  it('keeps jobs matching the top skills', () => {
    const jobs = [
      job({ id: 'a', description: 'We use TypeScript and Postgres.' }),
      job({ id: 'b', description: 'A COBOL mainframe role.' }),
    ];
    const out = preFilter(jobs, profile([{ name: 'TypeScript', years: 5 }]));
    assert.deepEqual(out.map(j => j.id), ['a', 'b']); // 'b' only as padding
    assert.equal(out[0].id, 'a', 'skill match must rank ahead of padding');
  });

  it('matches case-insensitively across title and description', () => {
    const jobs = [job({ id: 'a', title: 'Senior RUST Engineer', description: 'n/a' })];
    const out = preFilter(jobs, profile([{ name: 'rust', years: 3 }]));
    assert.equal(out[0].id, 'a');
  });

  it('only considers the five longest-tenured skills', () => {
    const jobs = [job({ id: 'match', description: 'We need Fortran.' })];
    const p = profile([
      { name: 'TypeScript', years: 10 },
      { name: 'Python', years: 9 },
      { name: 'Go', years: 8 },
      { name: 'Rust', years: 7 },
      { name: 'Java', years: 6 },
      { name: 'Fortran', years: 1 }, // 6th — outside the top five
    ]);
    // Still returned, but as padding rather than a skill hit. With only one
    // job in the pool we can't distinguish, so assert the ordering contract
    // on a pool where we can.
    const out = preFilter([...jobs, job({ id: 'ts', description: 'TypeScript shop.' })], p);
    assert.equal(out[0].id, 'ts', 'top-five skill must outrank a 6th-skill match');
  });

  it('sorts by real instants, not string order, across mixed ISO formats', () => {
    // Greenhouse and Ashby emit UTC offsets; Lever and RemoteOK emit Z. As
    // strings "…T03:12-04:00" sorts before "…T05:00Z", but as instants it is
    // later (07:12Z vs 05:00Z). A lexical sort gets this backwards.
    const jobs = [
      job({ id: 'zulu', posted_at: '2026-08-26T05:00:00.000Z', description: 'TypeScript' }),
      job({ id: 'offset', posted_at: '2026-08-26T03:12:35-04:00', description: 'TypeScript' }),
    ];
    const out = preFilter(jobs, profile([{ name: 'TypeScript', years: 5 }]));
    assert.equal(out[0].id, 'offset', 'later real instant must sort first');
  });

  it('keeps thin skill matches instead of discarding them', () => {
    // The old fallback replaced a short match list with "the 50 newest
    // overall", throwing away the genuine hits. Matches must survive.
    const jobs = [
      job({ id: 'hit', description: 'Elixir shop.', posted_at: '2020-01-01T00:00:00.000Z' }),
      ...Array.from({ length: 20 }, (_, i) =>
        job({ id: `pad${i}`, description: 'Unrelated.', posted_at: '2026-08-01T00:00:00.000Z' }),
      ),
    ];
    const out = preFilter(jobs, profile([{ name: 'Elixir', years: 4 }]));
    assert.equal(out[0].id, 'hit', 'the only skill match must lead, despite being oldest');
    assert.equal(out.length, 21, 'padding fills the rest of the slate');
  });

  it('caps the candidate set at 50', () => {
    const jobs = Array.from({ length: 200 }, (_, i) =>
      job({ id: `j${i}`, description: 'TypeScript everywhere.' }),
    );
    assert.equal(preFilter(jobs, profile([{ name: 'TypeScript', years: 5 }])).length, 50);
  });

  it('excludes ids the caller has already sent', () => {
    const jobs = [
      job({ id: 'old', description: 'TypeScript' }),
      job({ id: 'new', description: 'TypeScript' }),
    ];
    const out = preFilter(jobs, profile([{ name: 'TypeScript', years: 5 }]), new Set(['old']));
    assert.deepEqual(out.map(j => j.id), ['new']);
  });

  it('ignores an empty exclusion set rather than filtering everything out', () => {
    const jobs = [job({ id: 'a', description: 'TypeScript' })];
    assert.equal(preFilter(jobs, profile([{ name: 'TypeScript', years: 5 }]), new Set()).length, 1);
  });

  it('survives a profile whose skills are empty strings', () => {
    const jobs = [job({ id: 'a' }), job({ id: 'b' })];
    const out = preFilter(jobs, profile([{ name: '', years: 1 }]));
    assert.equal(out.length, 2, 'empty skill must not match everything or throw');
  });

  it('returns an empty list for an empty corpus', () => {
    assert.deepEqual(preFilter([], profile([{ name: 'Go', years: 2 }])), []);
  });
});
