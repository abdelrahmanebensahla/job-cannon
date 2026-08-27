import Anthropic from '@anthropic-ai/sdk';

// Claude Sonnet 5. Swapped from claude-sonnet-4-6 on 2026-08-27: same 1M
// context, newer model, and cheaper on both sides ($2/$10 per MTok vs
// $3/$15). Pinned in one place on purpose — every call site reads this.
export const MODEL = 'claude-sonnet-5';

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}
