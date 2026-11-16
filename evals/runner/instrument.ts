import { AsyncLocalStorage } from 'node:async_hooks';
import type Anthropic from '@anthropic-ai/sdk';

import { costUsd, priceFor } from './pricing';

/**
 * Telemetry for the production AI functions, without editing them.
 *
 * lib/ai/* all go through the singleton from getClient(). Wrapping that
 * client's `messages.create` lets the runner see every request the real
 * pipeline makes (tokens, latency, the raw tool input of each attempt) while
 * the prompts, schemas and retry logic stay exactly as shipped.
 *
 * It also enforces the spend cap. The check runs before each request, using a
 * deliberately high estimate of that request's cost, so a run cannot exceed
 * its budget even mid-retry or with several calls in flight.
 */

export type ApiCallRecord = {
  model: string;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  stop_reason: string | null;
  /** `input` of the first tool_use block, or null if the model returned none. */
  tool_input: unknown;
};

export type Budget = {
  limitUsd: number;
  spentUsd: number;
  /** Worst-case cost of requests currently in flight. */
  reservedUsd: number;
};

export class BudgetExceededError extends Error {
  constructor(budget: Budget, estimateUsd: number) {
    super(
      `budget_exceeded: spent $${budget.spentUsd.toFixed(4)} + reserved $${budget.reservedUsd.toFixed(4)} + next call up to $${estimateUsd.toFixed(4)} > cap $${budget.limitUsd.toFixed(2)}`,
    );
    this.name = 'BudgetExceededError';
  }
}

type CreateFn = (
  params: Anthropic.MessageCreateParamsNonStreaming,
  options?: unknown,
) => Promise<Anthropic.Message>;

type Scope = { calls: ApiCallRecord[] };

const scopes = new AsyncLocalStorage<Scope>();
const INSTRUMENTED = Symbol.for('job-cannon.evals.instrumented');

/**
 * Upper bound on what one request can cost. Input is over-counted on purpose
 * (2.5 chars per token; English prose and JSON run 3.5 to 4), and output is
 * taken as the full max_tokens. An estimate that runs high only stops a run
 * early. One that runs low would break the cap.
 */
export function worstCaseCostUsd(params: Anthropic.MessageCreateParamsNonStreaming): number {
  const inputTokens = Math.ceil(JSON.stringify(params).length / 2.5);
  return costUsd(params.model, inputTokens, params.max_tokens);
}

export function instrument(client: Anthropic, budget: Budget): void {
  const messages = client.messages as unknown as { create: CreateFn } & Record<symbol, boolean>;
  if (messages[INSTRUMENTED]) return;

  const inner = messages.create.bind(client.messages);

  const wrapped: CreateFn = async (params, options) => {
    priceFor(params.model); // fail before spending if the model has no price

    const estimate = worstCaseCostUsd(params);
    if (budget.spentUsd + budget.reservedUsd + estimate > budget.limitUsd) {
      throw new BudgetExceededError(budget, estimate);
    }

    budget.reservedUsd += estimate;
    const startedAt = performance.now();
    let message: Anthropic.Message;
    try {
      message = await inner(params, options);
    } finally {
      budget.reservedUsd -= estimate;
    }
    const latencyMs = performance.now() - startedAt;

    // No prompt caching is used today. If it is added, cached tokens are
    // counted at the full input rate here, which overstates cost slightly
    // and so keeps the budget cap on the safe side.
    const inputTokens =
      message.usage.input_tokens +
      (message.usage.cache_creation_input_tokens ?? 0) +
      (message.usage.cache_read_input_tokens ?? 0);
    const outputTokens = message.usage.output_tokens;
    const cost = costUsd(params.model, inputTokens, outputTokens);
    budget.spentUsd += cost;

    const toolUse = message.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    scopes.getStore()?.calls.push({
      model: params.model,
      latency_ms: Math.round(latencyMs),
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: cost,
      stop_reason: message.stop_reason,
      tool_input: toolUse ? toolUse.input : null,
    });

    return message;
  };

  messages.create = wrapped;
  messages[INSTRUMENTED] = true;
}

/**
 * Runs `fn` and returns the API calls made inside it. AsyncLocalStorage keeps
 * the attribution correct when several profiles are ranked concurrently.
 */
export async function recordCalls<T>(
  fn: () => Promise<T>,
): Promise<{ result: T | undefined; error: unknown; calls: ApiCallRecord[] }> {
  const scope: Scope = { calls: [] };
  try {
    const result = await scopes.run(scope, fn);
    return { result, error: undefined, calls: scope.calls };
  } catch (error) {
    return { result: undefined, error, calls: scope.calls };
  }
}
