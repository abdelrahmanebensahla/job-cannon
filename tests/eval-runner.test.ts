import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, beforeEach, describe, it } from 'node:test';

import type Anthropic from '@anthropic-ai/sdk';

import { DIGEST_POOL, DIGEST_ROUTE_PATH, DIGEST_TOP_N } from '@/evals/runner/config';
import { checkAttempt, digestCandidates, evaluateProfile } from '@/evals/runner/evaluate';
import {
  BudgetExceededError,
  instrument,
  worstCaseCostUsd,
  type Budget,
} from '@/evals/runner/instrument';
import { costUsd } from '@/evals/runner/pricing';
import { CorpusLockSchema, LOCK_PATH, parseJobs } from '@/evals/runner/snapshot';
import { getClient, MODEL } from '@/lib/ai/client';
import type { Job, Profile } from '@/lib/types';

function job(id: string, overrides: Partial<Job> = {}): Job {
  return {
    id,
    source: 'greenhouse',
    company: 'Acme',
    title: 'Software Engineer',
    location: 'Remote',
    remote: true,
    description: 'We use TypeScript.',
    url: 'https://example.com',
    posted_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

const PROFILE: Profile = {
  name: 'Test Candidate',
  target_roles: ['Software Engineer'],
  seniority: 'mid',
  skills: [{ name: 'TypeScript', years: 5 }],
  locations: [],
  remote_ok: true,
  summary: 'A candidate.',
};

const JOBS = ['a', 'b', 'c'].map(id => job(id));

function ranking(ids: string[]) {
  return { rankings: ids.map((job_id, i) => ({ job_id, match_score: 90 - i, reasoning: 'fits' })) };
}

function message(input: unknown): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: MODEL,
    content: [{ type: 'tool_use', id: 'tu_test', name: 'submit_rankings', input }],
    stop_reason: 'tool_use',
    stop_sequence: null,
    usage: {
      input_tokens: 1000,
      output_tokens: 200,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
    },
  } as unknown as Anthropic.Message;
}

// The mirror in evals/runner/config.ts is only safe while it matches the
// route. If someone changes the digest's pool or top-N, this is what tells
// them the harness is now measuring a configuration nobody ships.
describe('digest config mirror', () => {
  const route = readFileSync(DIGEST_ROUTE_PATH, 'utf8');

  it('matches RANK_CANDIDATE_POOL in the digest route', () => {
    const m = route.match(/const RANK_CANDIDATE_POOL = (\d+);/);
    assert.ok(m, 'RANK_CANDIDATE_POOL not found in the digest route');
    assert.equal(Number(m[1]), DIGEST_POOL);
  });

  it('matches the top-N slice in the digest route', () => {
    const m = route.match(/ranked\.slice\(0, (\d+)\)/);
    assert.ok(m, 'top-N slice not found in the digest route');
    assert.equal(Number(m[1]), DIGEST_TOP_N);
  });

  it('caps the candidate pool at the digest size', () => {
    const many = Array.from({ length: 80 }, (_, i) => job(`j${i}`));
    assert.equal(digestCandidates(many, PROFILE).length, DIGEST_POOL);
  });
});

describe('checkAttempt', () => {
  const ids = new Set(['a', 'b', 'c']);

  it('accepts a clean ranking', () => {
    assert.deepEqual(checkAttempt(ranking(['a', 'b']), ids), {
      schema_valid: true,
      invalid_ids: [],
      duplicate_ids: [],
      returned: 2,
    });
  });

  it('flags ids outside the candidate set', () => {
    assert.deepEqual(checkAttempt(ranking(['a', 'ghost']), ids).invalid_ids, ['ghost']);
  });

  it('flags repeated ids, which rankJobs itself does not check', () => {
    assert.deepEqual(checkAttempt(ranking(['a', 'b', 'a']), ids).duplicate_ids, ['a']);
  });

  it('reports a schema failure without guessing at ids', () => {
    const bad = { rankings: [{ job_id: 'a', match_score: 400, reasoning: 'x' }] };
    assert.equal(checkAttempt(bad, ids).schema_valid, false);
    assert.equal(checkAttempt(null, ids).schema_valid, false);
  });
});

describe('snapshot', () => {
  it('ships a well-formed corpus lock', () => {
    const lock = CorpusLockSchema.parse(JSON.parse(readFileSync(LOCK_PATH, 'utf8')));
    assert.equal(lock.path, 'data/jobs.json');
  });

  it('skips rows that fail JobSchema and keeps file order', () => {
    const raw = Buffer.from(JSON.stringify([job('x'), { id: 'broken' }, job('y')]));
    assert.deepEqual(parseJobs(raw).map(j => j.id), ['x', 'y']);
  });
});

// These run the real rankJobs against a stubbed transport: the prompt, schema
// and retry logic are the shipped ones, only the network is replaced.
describe('evaluateProfile over the production rankJobs', () => {
  const budget: Budget = { limitUsd: 1, spentUsd: 0, reservedUsd: 0 };
  let responses: unknown[] = [];
  let requests = 0;

  before(() => {
    process.env.ANTHROPIC_API_KEY ??= 'test-key-never-sent';
    const client = getClient();
    (client.messages as unknown as { create: unknown }).create = async () => {
      requests++;
      return message(responses.shift());
    };
    instrument(client, budget);
  });

  beforeEach(() => {
    budget.limitUsd = 1;
    budget.spentUsd = 0;
    budget.reservedUsd = 0;
    requests = 0;
  });

  const run = () =>
    evaluateProfile({ runId: 'test', repeat: 0, profileId: 'p1', profile: PROFILE, jobs: JOBS });

  it('records one attempt, its tokens and its cost when the first answer is valid', async () => {
    responses = [ranking(['b', 'a'])];
    const r = await run();
    assert.equal(r.error, null);
    assert.equal(r.retried, false);
    assert.deepEqual(r.top_ids, ['b', 'a']);
    assert.deepEqual(r.candidate_ids.sort(), ['a', 'b', 'c']);
    assert.equal(r.input_tokens, 1000);
    assert.equal(r.output_tokens, 200);
    assert.equal(r.cost_usd, costUsd(MODEL, 1000, 200));
    assert.equal(budget.spentUsd, r.cost_usd);
  });

  it('shows the retry when the first answer invents an id', async () => {
    responses = [ranking(['a', 'ghost']), ranking(['a', 'c'])];
    const r = await run();
    assert.equal(r.retried, true);
    assert.deepEqual(r.attempts[0].invalid_ids, ['ghost']);
    assert.deepEqual(r.attempts[1].invalid_ids, []);
    assert.deepEqual(r.top_ids, ['a', 'c']);
    assert.deepEqual(r.dropped_invalid_ids, []);
    assert.equal(r.cost_usd, 2 * costUsd(MODEL, 1000, 200));
  });

  it('surfaces an invented id that survives the retry and is dropped silently', async () => {
    responses = [ranking(['a', 'ghost']), ranking(['ghost', 'b'])];
    const r = await run();
    assert.equal(r.error, null, 'rankJobs does not throw here; it drops the id');
    assert.deepEqual(r.dropped_invalid_ids, ['ghost']);
    assert.deepEqual(r.top_ids, ['b'], 'the invented id never reaches the output');
  });

  it('records ranking_failed when both attempts fail the schema', async () => {
    responses = [{ rankings: 'nope' }, { rankings: 'still nope' }];
    const r = await run();
    assert.equal(r.error, 'ranking_failed');
    assert.equal(r.attempts.length, 2);
    assert.equal(r.attempts.every(a => !a.schema_valid), true);
    assert.deepEqual(r.top_ids, []);
  });

  it('stops before sending a request the budget cannot cover', async () => {
    responses = [ranking(['a'])];
    budget.limitUsd = 0.0001;
    await assert.rejects(run(), BudgetExceededError);
    assert.equal(requests, 0, 'no request may leave once the cap would be crossed');
    assert.equal(budget.spentUsd, 0);
  });

  it('counts in-flight requests against the cap', async () => {
    responses = [ranking(['a'])];
    budget.limitUsd = 0.05;
    budget.reservedUsd = 0.05;
    await assert.rejects(run(), BudgetExceededError);
    assert.equal(requests, 0);
  });
});

describe('worstCaseCostUsd', () => {
  it('prices output at the full max_tokens', () => {
    const params = {
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: 'user' as const, content: 'hi' }],
    };
    assert.ok(worstCaseCostUsd(params) >= costUsd(MODEL, 0, 4000));
  });

  it('refuses a model with no listed price', () => {
    assert.throws(() => costUsd('not-a-real-model', 1, 1), /No price for model/);
  });
});
