import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';

import { getClient, MODEL } from './client';
import type { Profile, ResumeReview } from '../types';
import { ResumeReviewSchema } from '../types';

const REVIEW_TOOL_NAME = 'submit_review';

const REVIEW_INPUT_SCHEMA = (() => {
  const schema = z.toJSONSchema(ResumeReviewSchema) as Record<string, unknown>;
  delete schema.$schema;
  return schema as { type: 'object'; [k: string]: unknown };
})();

const SYSTEM_PROMPT = `You are an expert technical resume reviewer and career coach for software and startup roles. You give specific, honest, actionable, concise feedback — never generic platitudes. You only output structured feedback via the submit_review tool.`;

function buildUserPrompt(profile: Profile): string {
  return `Here is the structured profile we extracted from a candidate's resume:

${JSON.stringify(profile, null, 2)}

Review this candidate's resume for competitive startup software roles. Be concise and prioritize the highest-impact points (the schema caps how much you can return — spend it well).

Provide, via the submit_review tool:
- overall_score: 0-100. 85+ = interview-ready for competitive startups; 70-84 = solid with clear gaps; below 70 = needs significant work.
- summary: 1-2 sentences — your overall assessment.
- strengths / weaknesses: the most important, specific to THIS profile.
- section_feedback: per profile area (e.g. Summary, Skills, Target roles, Seniority/positioning) — a short assessment plus concrete suggestions.
- revision_suggestions: concrete rewrites — especially a stronger "summary" and how to present target roles and skills. "original" quotes the current text (e.g. the summary verbatim); "revised" is your stronger version; "rationale" explains why.
- recommendations: prioritized next steps — skills to add or emphasize, roles to target, and how to strengthen the resume.

Note: you only have the structured profile (skills, target roles, seniority, summary, locations), not the raw resume text — so focus on positioning, skills coverage, seniority fit, and targeting rather than formatting or specific bullet wording. Call submit_review exactly once.`;
}

function findToolUse(
  blocks: Anthropic.ContentBlock[],
  name: string,
): Anthropic.ToolUseBlock | undefined {
  return blocks.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === name,
  );
}

export async function reviewResume(profile: Profile): Promise<ResumeReview> {
  const client = getClient();

  const tools: Anthropic.Tool[] = [
    {
      name: REVIEW_TOOL_NAME,
      description: 'Submit the structured resume review.',
      input_schema: REVIEW_INPUT_SCHEMA,
    },
  ];

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: buildUserPrompt(profile) },
  ];

  const first = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools,
    tool_choice: { type: 'tool', name: REVIEW_TOOL_NAME },
    messages,
  });

  const firstBlock = findToolUse(first.content, REVIEW_TOOL_NAME);
  if (!firstBlock) {
    console.error(`review: no tool_use in first response (stop_reason=${first.stop_reason})`);
    throw new Error('review_failed');
  }

  const parsed = ResumeReviewSchema.safeParse(firstBlock.input);
  if (parsed.success) return parsed.data;
  console.warn(
    `review: attempt 1 failed validation (stop_reason=${first.stop_reason}):\n${z.prettifyError(parsed.error)}`,
  );

  // Retry once: replay the conversation with the validation error.
  const second = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools,
    tool_choice: { type: 'tool', name: REVIEW_TOOL_NAME },
    messages: [
      ...messages,
      { role: 'assistant', content: first.content },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: firstBlock.id,
            is_error: true,
            content: `Your submission did not validate. Issues:\n${z.prettifyError(parsed.error)}\n\nPlease call ${REVIEW_TOOL_NAME} again with valid input.`,
          },
        ],
      },
    ],
  });

  const secondBlock = findToolUse(second.content, REVIEW_TOOL_NAME);
  if (!secondBlock) {
    console.error(`review: no tool_use in retry (stop_reason=${second.stop_reason})`);
    throw new Error('review_failed');
  }
  const reparsed = ResumeReviewSchema.safeParse(secondBlock.input);
  if (reparsed.success) return reparsed.data;

  console.error(
    `review: attempt 2 failed validation (stop_reason=${second.stop_reason}):\n${z.prettifyError(reparsed.error)}`,
  );
  throw new Error('review_failed');
}
