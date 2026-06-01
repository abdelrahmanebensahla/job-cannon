# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> **Next.js 16, not the one you know.** APIs, file conventions, and bundling differ from older Next. Before writing framework-touching code, read the relevant guide under `node_modules/next/dist/docs/` and heed deprecation notices. Concrete things already in play here: the Clerk middleware lives in **`proxy.ts`** (Next 16's middleware file convention), and a route that reads a file at runtime must be declared in `next.config.ts` → `outputFileTracingIncludes` (see below).

`README.md` is the source of truth for the product narrative, the pipeline diagram, pricing, and the full env-var table. This file covers what you need to *operate in the code* and the patterns that span multiple files.

## Commands

Package manager is **pnpm** (there's a lockfile + `pnpm-workspace.yaml`). Don't use npm/yarn.

```bash
pnpm dev            # next dev
pnpm build          # next build  — also the strictest type/bundle check
pnpm lint           # eslint (next core-web-vitals + typescript configs)
pnpm scrape         # tsx scripts/scrape.ts — rebuild data/jobs.json locally

pnpm db:push        # apply db/schema.ts straight to the DB (dev workflow)
pnpm db:generate    # diff schema → emit SQL into db/migrations/ (prod workflow)
pnpm db:migrate     # apply committed migrations (prod)
pnpm db:studio      # drizzle studio
```

There is **no test framework** wired up — no jest/vitest/playwright, no `test` script. Verification is `pnpm lint` + `pnpm build` (and manual checks). Don't invent a test command; if a change needs a test, raise that the harness doesn't exist yet.

Local Stripe webhooks and the cron trigger have setup steps — see README "Local setup". Quick reference: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, and `curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily-digest`.

Path alias: **`@/*` → repo root** (e.g. `@/lib/types`, `@/db`). `drizzle-kit` loads env via `.env.local` then `.env` (mirrors Next's order).

## Architecture in two layers

The free MVP and the paid SaaS share one ranking pipeline. Read `README.md`'s mermaid diagram first; the load-bearing details:

**Free preview — `POST /api/match`** ([app/api/match/route.ts](app/api/match/route.ts)): multipart PDF → `extractProfile` → `preFilter` → `rankJobs` → JSON. No auth, no DB. Node runtime, `maxDuration = 60`.

**Paid digest — `GET|POST /api/cron/daily-digest`** ([app/api/cron/daily-digest/route.ts](app/api/cron/daily-digest/route.ts)): Bearer-auth (`CRON_SECRET`), fired by Vercel Cron (`vercel.json`, 13:00 UTC Mon–Fri). Joins eligible subscribers, re-ranks per user with concurrency 5, persists a `daily_digests` row, then emails via Resend. `maxDuration = 300` (needs Vercel Pro). Eligibility mirrors `hasActiveSubscription` (trialing/active **or** canceled-but-within-period), not a raw `status` check.

**Resume review — `POST /api/review`** ([app/api/review/route.ts](app/api/review/route.ts)): authed **and** active-subscription-gated (`hasActiveSubscription` → 403 `not_subscribed`). Multipart PDF → validated exactly like `/api/match` → `reviewResume` → persists a `resume_reviews` row (latest-per-user). The PDF is processed transiently, **never stored**. Surfaced at `/dashboard/review` ([app/dashboard/review/page.tsx](app/dashboard/review/page.tsx)) via `ReviewClient`; the server page renders the saved latest review. Node runtime, `maxDuration = 60`.

### The AI layer is the core abstraction — `lib/ai/`

The free/paid pipelines call `extractProfile` + `rankJobs`; the subscriber resume-review feature adds `reviewResume`. All three follow one rigid pattern worth preserving when you touch them:

- **Forced tool call + Zod validation + single retry.** `extractProfile` ([lib/ai/extract.ts](lib/ai/extract.ts)), `rankJobs` ([lib/ai/rank.ts](lib/ai/rank.ts)), and `reviewResume` ([lib/ai/review.ts](lib/ai/review.ts)) each call Claude with `tool_choice: { type: 'tool', name: ... }`, validate the tool input with a Zod schema, and on failure **replay the conversation with a `tool_result` carrying `is_error: true` and the prettified Zod error**, then try once more. No third attempt — they throw `extraction_failed` / `ranking_failed` / `review_failed`, which the routes map to a 502.
- **Tool input schemas come from Zod via `z.toJSONSchema(...)`, with `$schema` deleted.** Keep that deletion — the Anthropic SDK rejects the `$schema` key.
- **`rankJobs` guards against invented IDs**: every returned `job_id` must be in the candidate set (`byId` map); a mismatch triggers the same retry path.
- The model is pinned in one place: `MODEL` in [lib/ai/client.ts](lib/ai/client.ts) (`claude-sonnet-4-6`). The client is lazily constructed so missing `ANTHROPIC_API_KEY` only throws at request time.
- All shared shapes live in [lib/types.ts](lib/types.ts): `JobSchema`, `ProfileSchema`, `RankedJobsSchema`, `ResumeReviewSchema`, and the derived TS types. This is the contract between scraping, AI, DB (`jsonb` columns are typed `$type<Profile>()` / `$type<MatchedJob[]>()` / `$type<ResumeReview>()`), and UI.

### Jobs data is a committed JSON file, not a table — `lib/jobs.ts` + `data/jobs.json`

- `loadJobs()` reads `data/jobs.json` once and caches it in a module-level variable. `preFilter(jobs, profile)` keeps jobs whose `title + description` contains any of the candidate's top-5 skills (case-insensitive substring), sorts by `posted_at` desc, takes 50 — falling back to the 50 most-recent overall if fewer than 10 match. The README explains *why* keyword pre-filter beats embeddings at this scale.
- **Runtime `fs` read gotcha:** because `/api/match` reads `data/jobs.json` at runtime, [next.config.ts](next.config.ts) declares `outputFileTracingIncludes: { "/api/match": ["./data/jobs.json"] }` so Vercel bundles the file. **If you add another route or function that reads `data/jobs.json`, add it to that map too** or it'll 500 in production (the file tracer can't follow the dynamic `path.join`).
- The file is regenerated nightly by GitHub Actions ([.github/workflows/scrape.yml](.github/workflows/scrape.yml)) which runs `pnpm scrape` and commits the result (Vercel auto-redeploys). The scrape needs **no secrets** — only public JSON endpoints.
- `scripts/scrape.ts` upserts by job id, stamps `_last_seen`, **drops anything not seen in 14 days**, and sorts (source, then `posted_at` desc) for diff stability. To add a company, edit the slug lists in `lib/scrapers/greenhouse-companies.ts` / `lever-companies.ts`. Each source is one file in `lib/scrapers/` returning `Job[]`; `html.ts` strips HTML from descriptions.

### Database — `db/`

- **Neon serverless over HTTP** (`drizzle-orm/neon-http`), not the pooled/websocket driver. Drizzle is the ORM.
- `db` ([db/index.ts](db/index.ts)) is a **lazy `Proxy`** — the real client is created on first property access. This is deliberate: `next build` / lint can run without `DATABASE_URL`, and it only throws at actual query time if the var is missing. Don't replace it with an eager client.
- [db/schema.ts](db/schema.ts) is the schema source of truth. Dev applies it with `db:push` (no migration files); production uses `db:generate` → commit the SQL in `db/migrations/` → `db:migrate`. Tables: `users`, `subscriptions`, `resumes`, `daily_digests`, `resume_reviews` (latest review per user, indexed on `(user_id, created_at)`, no uniqueness). `resume_reviews` shipped via the committed `0001` migration — the first real exercise of the generate→migrate flow against prod (prod tracks applied migrations in `drizzle.__drizzle_migrations`).
- **`hasActiveSubscription(sub)` in `db/schema.ts` is the canonical access check** and it's date-based: `trialing`/`active` qualify, *and* a `canceled` sub whose `currentPeriodEnd` is still in the future qualifies (Stripe marks status `canceled` immediately on cancel-now but honors the paid window). Use this rather than checking `status` directly.

### Auth + subscription gating happens in layers — don't double-query

- **`proxy.ts`** only enforces *authentication* for `/dashboard/*` and `/onboarding` (redirects to `/sign-in` if signed out). It deliberately does **no DB hit** — keeps every nav cheap.
- **`app/dashboard/layout.tsx`** enforces the *funnel*: signed-in but no active resume → redirect `/onboarding`; resume but no active sub → redirect `/pricing`. It's `force-dynamic`.
- **`lib/subscription.ts` → `getSubscriptionView()`** returns the discriminated `SubscriptionView` consumed by the header/badges. **Read it once at the layout level; child pages should not re-query** (the comment in the file says so explicitly). `lib/stripe/subscription.ts` holds the DB lookup (`getCurrentSubscription`) and the Stripe→DB upsert.
- **`ensureUser(userId)`** ([lib/auth/ensure-user.ts](lib/auth/ensure-user.ts)) is the belt-and-suspenders mirror of a Clerk user into the local `users` table, for the race where an authed route is hit before the Clerk webhook lands. Reuse it instead of inserting users ad hoc.

### Webhooks are signature-verified and ack-and-ignore unknowns

- **Stripe** ([app/api/webhooks/stripe/route.ts](app/api/webhooks/stripe/route.ts)): verifies with `constructEvent`, handles `checkout.session.completed` + `customer.subscription.{updated,deleted}`, all funnelling into `syncSubscriptionFromStripe` (upsert keyed on the Stripe subscription id; `userId` resolved from `sub.metadata.userId` or the session's `client_reference_id`). Unknown events return `{ ok: true, handled: 'ignored:...' }` so Stripe stops retrying.
- **Clerk** ([app/api/webhooks/clerk/route.ts](app/api/webhooks/clerk/route.ts)): Svix-verified; `user.created` inserts (`onConflictDoNothing` on id) and `user.deleted` deletes. An email-unique conflict is logged and acked (not silently deleted — a `ON DELETE CASCADE` could wipe a paying customer's history).
- Cron idempotency: the `daily_digests` unique index `(user_id, digest_date)` plus **persist-then-send** means a failed email leaves a visible unsent digest (`sent_at: null`) rather than dropping work, and reruns are safe.

### Dates are timezone-sensitive — `lib/date.ts`

The digest "day" is the **America/New_York** date (`todayInET()`), since the cron fires at 13:00 UTC = 8am ET. `toDate()` accepts both a `YYYY-MM-DD` date-only string (anchored at 12:00 UTC so it never rolls back a day) **and** a full ISO string (e.g. `SubscriptionView.endsAt`). When formatting dates, route through these helpers — a naive `new Date(input)` reintroduces the off-by-one-day bug these guard against.

### URL resolution — `lib/app-url.ts`

`appUrl(path)` resolves the deployment base in order: `NEXT_PUBLIC_APP_URL` → `VERCEL_PROJECT_PRODUCTION_URL` → `VERCEL_URL` → `localhost:3000`. **`NEXT_PUBLIC_APP_URL` is required in production behind a custom domain** (Vercel's auto-detected var stays the `.vercel.app` URL). Use this for any Stripe redirect or email link.

## UI conventions

- **Tailwind v4** — config is CSS-first in `app/globals.css` (`@theme`), there is no `tailwind.config.*`. PostCSS via `@tailwindcss/postcss`.
- **shadcn/ui in its base-ui flavor** (`components.json`: style `base-nova`, components from `@base-ui/react`, **not** Radix). Icons are `lucide-react`. Generated primitives land in `@/components/ui`; app-level islands live in `@/components` (e.g. `MatchClient`, `JobCard`, `DashboardNav`). `next-themes` drives dark mode; merge classes with `cn()` from `@/lib/utils`.
- `app/dev/components/page.tsx` is an in-repo component gallery for eyeballing UI states.
