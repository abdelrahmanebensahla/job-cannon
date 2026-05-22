import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';

import { getClient, MODEL } from './client';
import type { Profile } from '../types';
import { ProfileSchema } from '../types';

const PROFILE_TOOL_NAME = 'submit_profile';

const PROFILE_INPUT_SCHEMA = (() => {
  const schema = z.toJSONSchema(ProfileSchema) as Record<string, unknown>;
  delete schema.$schema;
  return schema as { type: 'object'; [k: string]: unknown };
})();

const EXTRACTION_PROMPT = `Extract a structured profile from the attached resume PDF.

Rules:
- target_roles: 1-4 short role titles the candidate is targeting (e.g. "Software Engineer", "ML Engineer"). Infer from experience and education if not explicitly stated.
- seniority: one of intern, junior, mid, senior, staff. Pick the best fit based on years of experience and titles held.
- skills: 5-20 concrete, searchable skills (languages, frameworks, tools, domains). Each with an approximate years number based on the resume. Use canonical lowercase-or-titlecase names (e.g. "TypeScript", "PostgreSQL", "AWS", "React").
- locations: cities or regions the candidate has mentioned (current or preferred). Empty array if none stated.
- remote_ok: true if the resume mentions remote work, open to remote, or includes a remote role.
- summary: 1-2 sentence elevator pitch in your own words.

Call the submit_profile tool with the result. Do not include any other text.`;

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
        { type: 'text', text: EXTRACTION_PROMPT },
      ],
    },
  ];
}

export async function extractProfile(base64Pdf: string): Promise<Profile> {
  const client = getClient();

  const tools: Anthropic.Tool[] = [
    {
      name: PROFILE_TOOL_NAME,
      description: 'Submit the structured candidate profile extracted from the resume.',
      input_schema: PROFILE_INPUT_SCHEMA,
    },
  ];

  const messages = buildInitialMessages(base64Pdf);

  const first = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    tools,
    tool_choice: { type: 'tool', name: PROFILE_TOOL_NAME },
    messages,
  });

  const firstBlock = findToolUse(first.content, PROFILE_TOOL_NAME);
  if (firstBlock) {
    const parsed = ProfileSchema.safeParse(firstBlock.input);
    if (parsed.success) return parsed.data;

    // Retry once: replay the conversation with the validation error.
    const second = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      tools,
      tool_choice: { type: 'tool', name: PROFILE_TOOL_NAME },
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
              content: `Your submission did not validate. Issues:\n${z.prettifyError(parsed.error)}\n\nPlease call ${PROFILE_TOOL_NAME} again with valid input.`,
            },
          ],
        },
      ],
    });
    const secondBlock = findToolUse(second.content, PROFILE_TOOL_NAME);
    if (secondBlock) {
      const reparsed = ProfileSchema.safeParse(secondBlock.input);
      if (reparsed.success) return reparsed.data;
    }
  }

  throw new Error('extraction_failed');
}
