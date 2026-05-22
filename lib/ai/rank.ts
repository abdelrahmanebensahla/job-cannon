import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';

import { getClient, MODEL } from './client';
import type { Job, MatchedJob, Profile } from '../types';
import { RankedJobsSchema } from '../types';

const RANK_TOOL_NAME = 'submit_rankings';

const RANK_INPUT_SCHEMA = (() => {
  const schema = z.toJSONSchema(RankedJobsSchema) as Record<string, unknown>;
  delete schema.$schema;
  return schema as { type: 'object'; [k: string]: unknown };
})();

const SYSTEM_PROMPT = `You are a careful technical recruiter. Given a candidate profile and a set of candidate jobs, you rank the jobs that fit the candidate best. You weigh skill overlap, seniority match, target roles, location/remote fit, and recency. You only output structured rankings via the submit_rankings tool.`;

function buildUserPrompt(profile: Profile, candidates: Job[]): string {
  const profileBlock = JSON.stringify(profile, null, 2);
  const jobsBlock = JSON.stringify(
    candidates.map(j => ({
      job_id: j.id,
      company: j.company,
      title: j.title,
      location: j.location,
      remote: j.remote,
      posted_at: j.posted_at,
      description: j.description,
    })),
    null,
    2,
  );
  return `Candidate profile:
${profileBlock}

Candidate jobs (${candidates.length}):
${jobsBlock}

Rank the up to 20 best-fit jobs for this candidate. For each:
- job_id MUST be one of the IDs in the candidate set above. Never invent IDs.
- match_score: 0-100, where 90+ is a clear strong match, 70-89 is a solid match, 50-69 is plausible but weaker, below 50 should rarely appear.
- reasoning: 1-3 sentences explaining the fit — concrete, citing specific skills/role/location signals. Max 400 chars.

Order rankings from best to worst. Call submit_rankings exactly once.`;
}

function findToolUse(
  blocks: Anthropic.ContentBlock[],
  name: string,
): Anthropic.ToolUseBlock | undefined {
  return blocks.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === name,
  );
}

export async function rankJobs(profile: Profile, candidates: Job[]): Promise<MatchedJob[]> {
  if (candidates.length === 0) return [];

  const client = getClient();

  const tools: Anthropic.Tool[] = [
    {
      name: RANK_TOOL_NAME,
      description: 'Submit a ranked list of the best-fit jobs for the candidate.',
      input_schema: RANK_INPUT_SCHEMA,
    },
  ];

  const userPrompt = buildUserPrompt(profile, candidates);

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: [{ type: 'text', text: userPrompt }] },
  ];

  async function callOnce(extra: Anthropic.MessageParam[] = []) {
    return client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      tools,
      tool_choice: { type: 'tool', name: RANK_TOOL_NAME },
      messages: [...messages, ...extra],
    });
  }

  const byId = new Map(candidates.map(j => [j.id, j]));

  const first = await callOnce();
  const firstBlock = findToolUse(first.content, RANK_TOOL_NAME);

  let parsed = firstBlock ? RankedJobsSchema.safeParse(firstBlock.input) : undefined;

  if (firstBlock && (!parsed?.success || parsed.data.rankings.some(r => !byId.has(r.job_id)))) {
    // Retry once with the specific issue surfaced.
    const issueMsg = !parsed?.success
      ? z.prettifyError(parsed!.error)
      : `Some job_id values are not in the candidate set. Use only IDs from the provided jobs list.`;

    const second = await callOnce([
      { role: 'assistant', content: first.content },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: firstBlock.id,
            is_error: true,
            content: `Your submission was rejected: ${issueMsg}\nCall ${RANK_TOOL_NAME} again with valid input.`,
          },
        ],
      },
    ]);
    const secondBlock = findToolUse(second.content, RANK_TOOL_NAME);
    parsed = secondBlock ? RankedJobsSchema.safeParse(secondBlock.input) : undefined;
  }

  if (!parsed?.success) throw new Error('ranking_failed');

  const out: MatchedJob[] = [];
  for (const r of parsed.data.rankings) {
    const job = byId.get(r.job_id);
    if (!job) continue;
    out.push({ ...job, match_score: r.match_score, reasoning: r.reasoning });
  }
  return out;
}
