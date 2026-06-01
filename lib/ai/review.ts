import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';

import { getClient, MODEL } from './client';
import type { ResumeReview } from '../types';
import { ResumeReviewSchema } from '../types';

const REVIEW_TOOL_NAME = 'submit_review';

const REVIEW_INPUT_SCHEMA = (() => {
  const schema = z.toJSONSchema(ResumeReviewSchema) as Record<string, unknown>;
  delete schema.$schema;
  return schema as { type: 'object'; [k: string]: unknown };
})();

const SYSTEM_PROMPT = `You are an expert technical resume reviewer and career coach for software and startup roles. You give specific, honest, actionable feedback — never generic platitudes. You reference concrete lines from the resume and quantify suggestions wherever possible. You only output structured feedback via the submit_review tool.`;

const REVIEW_PROMPT = `Review the attached resume PDF thoroughly. Be specific and reference actual content from the document.

Provide, via the submit_review tool:
- overall_score: 0-100. 85+ = interview-ready for competitive startups; 70-84 = solid with clear gaps; below 70 = needs significant work.
- summary: one short paragraph giving your overall assessment.
- strengths: the strongest, most differentiating aspects of this resume.
- weaknesses: the most important problems — vague bullets, missing metrics, unclear impact, weak structure, missing or thin skills.
- section_feedback: for each major section present (e.g. Summary, Experience, Skills, Education, Projects), an assessment plus concrete suggestions.
- revision_suggestions: concrete before/after rewrites. "original" must quote or closely paraphrase real text from the resume; "revised" is your stronger version (quantified, active, impact-focused); "rationale" explains why it's better.
- recommendations: prioritized next steps — skills to add or emphasize, roles to target, and how to strengthen the resume for startup applications.

Call the submit_review tool exactly once. Do not include any other text.`;

function findToolUse(
  blocks: Anthropic.ContentBlock[],
  name: string,
): Anthropic.ToolUseBlock | undefined {
  return blocks.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === name,
  );
}

function buildInitialMessages(base64Pdf: string): Anthropic.MessageParam[] {
  return [
    {
      role: 'user',
      content: [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64Pdf,
          },
        },
        { type: 'text', text: REVIEW_PROMPT },
      ],
    },
  ];
}

export async function reviewResume(base64Pdf: string): Promise<ResumeReview> {
  const client = getClient();

  const tools: Anthropic.Tool[] = [
    {
      name: REVIEW_TOOL_NAME,
      description: 'Submit the structured resume review.',
      input_schema: REVIEW_INPUT_SCHEMA,
    },
  ];

  const messages = buildInitialMessages(base64Pdf);

  const first = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    tools,
    tool_choice: { type: 'tool', name: REVIEW_TOOL_NAME },
    messages,
  });

  const firstBlock = findToolUse(first.content, REVIEW_TOOL_NAME);
  if (firstBlock) {
    const parsed = ResumeReviewSchema.safeParse(firstBlock.input);
    if (parsed.success) return parsed.data;

    // Retry once: replay the conversation with the validation error.
    const second = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
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
    if (secondBlock) {
      const reparsed = ResumeReviewSchema.safeParse(secondBlock.input);
      if (reparsed.success) return reparsed.data;
    }
  }

  throw new Error('review_failed');
}
