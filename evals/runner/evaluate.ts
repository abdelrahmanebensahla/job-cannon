import { rankJobs } from '@/lib/ai/rank';
import { preFilter } from '@/lib/jobs';
import { RankedJobsSchema, type Job, type Profile } from '@/lib/types';

import { DIGEST_POOL, DIGEST_TOP_N } from './config';
import { BudgetExceededError, recordCalls } from './instrument';

/** What one attempt's tool input looked like, judged the way rankJobs judges it. */
export type AttemptCheck = {
  /** Passed RankedJobsSchema. */
  schema_valid: boolean;
  /** job_ids not in the candidate set, i.e. invented. */
  invalid_ids: string[];
  /** job_ids that appear more than once. rankJobs does not check this. */
  duplicate_ids: string[];
  returned: number;
};

export type RunRecord = {
  schema_version: 1;
  run_id: string;
  repeat: number;
  profile_id: string;
  pool_size: number;
  top_n: number;
  /** The pool handed to the ranker, in preFilter order. */
  candidate_ids: string[];
  /** Everything rankJobs returned (up to 20), best first. */
  ranked: { job_id: string; match_score: number; reasoning: string }[];
  /** The first top_n of `ranked`: what a subscriber would be emailed. */
  top_ids: string[];
  /** One entry per request. Two entries means the single retry fired. */
  attempts: (AttemptCheck & {
    latency_ms: number;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    stop_reason: string | null;
  })[];
  retried: boolean;
  /** Invented ids still present after the last attempt. rankJobs drops these silently. */
  dropped_invalid_ids: string[];
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  /** Wall time of the whole rankJobs call, retry included. */
  latency_ms: number;
  error: string | null;
};

export function checkAttempt(toolInput: unknown, candidateIds: ReadonlySet<string>): AttemptCheck {
  const parsed = RankedJobsSchema.safeParse(toolInput);
  if (!parsed.success) {
    return { schema_valid: false, invalid_ids: [], duplicate_ids: [], returned: 0 };
  }
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const invalid: string[] = [];
  for (const r of parsed.data.rankings) {
    if (!candidateIds.has(r.job_id)) invalid.push(r.job_id);
    if (seen.has(r.job_id)) duplicates.add(r.job_id);
    seen.add(r.job_id);
  }
  return {
    schema_valid: true,
    invalid_ids: invalid,
    duplicate_ids: [...duplicates],
    returned: parsed.data.rankings.length,
  };
}

/** The digest's candidate selection: preFilter, then the route's pool cap. */
export function digestCandidates(jobs: Job[], profile: Profile): Job[] {
  return preFilter(jobs, profile).slice(0, DIGEST_POOL);
}

/**
 * Ranks one profile through the production path and records what happened.
 * A ranking failure is data, so it is captured in the record. A budget stop
 * is not: it is rethrown so the run halts.
 */
export async function evaluateProfile(args: {
  runId: string;
  repeat: number;
  profileId: string;
  profile: Profile;
  jobs: Job[];
}): Promise<RunRecord> {
  const candidates = digestCandidates(args.jobs, args.profile);
  const candidateIds = new Set(candidates.map(j => j.id));

  const startedAt = performance.now();
  const { result, error, calls } = await recordCalls(() => rankJobs(args.profile, candidates));
  const latencyMs = Math.round(performance.now() - startedAt);

  if (error instanceof BudgetExceededError) throw error;

  const attempts = calls.map(c => ({
    ...checkAttempt(c.tool_input, candidateIds),
    latency_ms: c.latency_ms,
    input_tokens: c.input_tokens,
    output_tokens: c.output_tokens,
    cost_usd: c.cost_usd,
    stop_reason: c.stop_reason,
  }));
  const last = attempts.at(-1);
  const ranked = (result ?? []).map(j => ({
    job_id: j.id,
    match_score: j.match_score,
    reasoning: j.reasoning,
  }));

  return {
    schema_version: 1,
    run_id: args.runId,
    repeat: args.repeat,
    profile_id: args.profileId,
    pool_size: candidates.length,
    top_n: DIGEST_TOP_N,
    candidate_ids: candidates.map(j => j.id),
    ranked,
    top_ids: ranked.slice(0, DIGEST_TOP_N).map(r => r.job_id),
    attempts,
    retried: attempts.length > 1,
    dropped_invalid_ids: last?.invalid_ids ?? [],
    input_tokens: calls.reduce((n, c) => n + c.input_tokens, 0),
    output_tokens: calls.reduce((n, c) => n + c.output_tokens, 0),
    cost_usd: calls.reduce((n, c) => n + c.cost_usd, 0),
    latency_ms: latencyMs,
    error: error === undefined ? null : error instanceof Error ? error.message : String(error),
  };
}
