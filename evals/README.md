# Evals

Offline evaluation for the ranking pipeline. A TypeScript runner calls the production functions (`preFilter` and `rankJobs`, no copied prompts) over frozen profiles and a frozen corpus, and writes JSONL. Python scores it.

Status: runner plus a smoke workflow. Golden set, scoring, judge and the CI gate land in later PRs.

## Baseline

TBD. No baseline has been measured yet.

## Run it

```bash
# Build candidate pools only. No API calls, no cost.
npm run eval:run -- --profiles evals/runner/fixtures/smoke-profiles.jsonl --dry-run

# Paid run. The budget is required and is a hard cap.
ANTHROPIC_API_KEY=... npm run eval:run -- \
  --profiles evals/runner/fixtures/smoke-profiles.jsonl --budget-usd 0.50
```

In CI, `.github/workflows/evals.yml` runs the same command with the `ANTHROPIC_API_KEY_EVALS` secret. It triggers on PRs that touch `lib/ai/**`, `lib/jobs.ts`, `lib/types.ts`, the digest route or the harness, and can be started by hand from the Actions tab. Today it runs the three smoke profiles under a $0.50 cap and gates nothing.

Output goes to `evals/runs/<run_id>.jsonl` plus a `<run_id>.meta.json` with the commit, model, corpus lock and spend. Both are gitignored.

## What a record holds

One line per profile per repeat:

- `candidate_ids`: the 30 jobs the pre-filter handed the ranker
- `ranked`, `top_ids`: what `rankJobs` returned, and the top 10 a subscriber would get
- `attempts`: one entry per API request, with tokens, cost, latency, whether the tool input passed the schema, and any invented or repeated job ids
- `retried`, `dropped_invalid_ids`, `error`
- `input_tokens`, `output_tokens`, `cost_usd`, `latency_ms`

## How it stays honest

- **Same code as production.** The runner wraps the Anthropic client that `lib/ai` already uses, so it sees every request without editing a prompt or a schema. No production file changes for the harness.
- **Same config as the digest.** Pool of 30, top 10. Those numbers live inside the cron route, so they are mirrored in `runner/config.ts` and a test fails if the route changes.
- **Frozen corpus.** `data/jobs.json` changes every night. `golden/corpus.lock.json` pins one commit and its sha256, and the runner refuses to start on a mismatch. To re-lock: `npm run eval:lock -- <commit> <tag>`. Re-locking invalidates existing labels and baselines.
- **Hard budget.** Before each request the runner assumes the worst case (inflated input estimate, full `max_tokens` of output) and stops if that would cross the cap. A stopped run exits with code 3.

## Known limits

- Evaluates the first-day digest. The 14-day "already sent" exclusion is not simulated.
- The free preview config (50 candidates, top 20) is not evaluated.
- SDK-level network retries are invisible to the runner. They show up only as latency.
