# Job Cannon

**Live demo:** [job-cannon.vercel.app](https://job-cannon.vercel.app/)

AI-powered resume-to-job matching. Drop a PDF resume on the landing page; Claude extracts a structured profile, scans thousands of fresh postings from Greenhouse, Lever, and RemoteOK, and returns the 20 best fits with reasoning for each.

_(Screenshot will land here after the first production deploy.)_

## How the matching works

This is the part that matters for the design choice.

```mermaid
graph LR
  A[PDF upload] --> B[Claude: extract profile]
  B --> C[Keyword pre-filter on top 5 skills]
  C --> D[Top 50 most-recent candidates]
  D --> E[Claude: rank top 20 with reasoning]
  E --> F[Results UI]
  G[GitHub Actions nightly] --> H[Scrape Greenhouse, Lever, RemoteOK]
  H --> I[Commit data/jobs.json]
  I --> J[Vercel auto-redeploys]
```

I deliberately chose **keyword pre-filter + LLM re-rank** instead of vector embeddings. At MVP scale (~5K jobs) with a structured domain (tech jobs always list skills explicitly), keyword filtering has better precision and zero embedding infrastructure. Two Claude calls — one for extraction, one for ranking — cover the entire pipeline. No vector store, no DB, no second AI vendor.

A single `POST /api/match` endpoint runs the whole flow:

1. Parse the multipart PDF (size + magic-byte check).
2. Call Claude with the PDF as a `document` content block, forcing a `submit_profile` tool call. Zod-validate the tool input; retry once with the validation error replayed.
3. Load `data/jobs.json` (lazily cached in-process).
4. Keyword pre-filter: keep jobs whose `title + description` contains any of the candidate's top-5 skills (case-insensitive substring). Sort by `posted_at` desc. Take top 50. Fall back to the 50 most-recent overall if matches < 10.
5. Send those 50 + the profile back to Claude, forcing a `submit_rankings` tool call. Validate ids belong to the candidate set; retry once on mismatch.
6. Return `{ ok: true, profile, results }`.

No `/results/[id]` route. No persistence of match results. Re-upload to re-match.

## Tech stack

- **Framework:** Next.js 16 (App Router) + TypeScript strict
- **UI:** Tailwind v4 + shadcn/ui (Card, Badge, Button, Input, Progress, Skeleton)
- **AI:** Anthropic Claude API — `claude-sonnet-4-6`, native PDF document support, tool use for structured outputs
- **Validation:** Zod 4 (with `z.toJSONSchema` for tool input schemas)
- **Data store:** `data/jobs.json` (committed; ~4K jobs after first scrape)
- **Scraping:** Native `fetch` against public JSON APIs (Greenhouse boards-api, Lever postings, RemoteOK feed). No browser automation.
- **Hosting:** Vercel (web) + GitHub Actions (nightly scrape commits jobs.json → Vercel redeploys)
- **Package manager:** pnpm

## Local setup

```bash
pnpm install
cp .env.local.example .env.local   # then fill in ANTHROPIC_API_KEY
pnpm dev
```

To refresh the job set:

```bash
pnpm scrape
```

To apply schema changes to your Neon database (dev only — Phase 6 switches to migrations):

```bash
pnpm db:push
```

### Stripe webhooks during local development

Use the Stripe CLI to forward live test events to your local server:

```bash
stripe login                                              # one-time
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# copy the printed "whsec_..." into STRIPE_WEBHOOK_SECRET in .env.local
# in another terminal:
pnpm dev
# then go through /pricing → Stripe Checkout. Use 4242 4242 4242 4242 for
# the test card; any future date, any CVC.
```

## Environment variables

The MVP free preview only needs `ANTHROPIC_API_KEY`. The SaaS surface adds DB, auth, payments, email, and cron.

| Name                                  | Required        | Used in                                | Purpose                                       |
| ------------------------------------- | --------------- | -------------------------------------- | --------------------------------------------- |
| `ANTHROPIC_API_KEY`                   | yes             | `/api/match`, `/api/resume`, cron      | Claude extraction + ranking.                  |
| `DATABASE_URL`                        | SaaS            | Drizzle / Neon HTTP client             | Postgres connection (Neon).                   |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`   | SaaS            | client                                 | Clerk frontend.                               |
| `CLERK_SECRET_KEY`                    | SaaS            | server                                 | Clerk backend.                                |
| `CLERK_WEBHOOK_SECRET`                | SaaS            | `/api/webhooks/clerk`                  | Svix signature verification.                  |
| `STRIPE_SECRET_KEY`                   | SaaS            | server                                 | Stripe REST calls.                            |
| `STRIPE_WEBHOOK_SECRET`               | SaaS            | `/api/webhooks/stripe`                 | Stripe webhook signature verification.        |
| `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY`    | SaaS            | `/api/checkout` (resolved server-side) | Stripe Price id for the $9/month plan.        |
| `NEXT_PUBLIC_STRIPE_PRICE_YEARLY`     | SaaS            | `/api/checkout` (resolved server-side) | Stripe Price id for the $79/year plan.        |
| `RESEND_API_KEY`                      | SaaS (Phase 4)  | cron handler                           | Daily email digest delivery.                  |
| `CRON_SECRET`                         | SaaS (Phase 4)  | `/api/cron/daily-digest`               | Bearer auth for the Vercel-scheduled cron.    |
| `NEXT_PUBLIC_APP_URL` (optional)      | SaaS            | Stripe redirects, email links          | Override the auto-detected deploy URL.        |

The nightly GitHub Actions scrape needs **no secrets** — it only hits public JSON endpoints.

## Project layout

```
app/api/match/route.ts          POST endpoint: PDF in, ranked matches out
app/page.tsx                    Landing page (server) + <MatchClient />
components/                     UI: MatchClient, JobCard, ProfileSummary, MatchScoreRing
lib/ai/                         Anthropic client + extract.ts + rank.ts
lib/jobs.ts                     Lazy-cached jobs + preFilter
lib/scrapers/                   One file per source + html stripper
lib/types.ts                    Job + Profile + RankedJobs Zod schemas
scripts/scrape.ts               Orchestrator for `pnpm scrape`
data/jobs.json                  Committed job index, refreshed nightly
.github/workflows/scrape.yml    Nightly cron
```

## License

MIT — see [LICENSE](./LICENSE).
