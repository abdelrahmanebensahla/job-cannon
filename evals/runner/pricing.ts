/**
 * List prices in USD per million tokens, keyed by model id.
 *
 * A model missing from this table is an error, never a silent $0: a cost
 * figure that quietly reads zero would end up in a results table.
 * Check https://platform.claude.com/docs/en/about-claude/pricing before
 * adding or trusting a row.
 */
type Price = { inputPerMTok: number; outputPerMTok: number };

const PRICES: Record<string, Price> = {
  // Matches the rate recorded in lib/ai/client.ts when the model was pinned.
  'claude-sonnet-5': { inputPerMTok: 2, outputPerMTok: 10 },
};

export function priceFor(model: string): Price {
  const price = PRICES[model];
  if (!price) {
    throw new Error(
      `No price for model "${model}". Add it to evals/runner/pricing.ts before running.`,
    );
  }
  return price;
}

export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = priceFor(model);
  return (inputTokens * price.inputPerMTok + outputTokens * price.outputPerMTok) / 1_000_000;
}
