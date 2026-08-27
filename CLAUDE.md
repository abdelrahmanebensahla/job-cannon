# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> **Next.js 16, not the one you know.** APIs, file conventions, and bundling differ from older Next. Before writing framework-touching code, read the relevant guide under `node_modules/next/dist/docs/` and heed deprecation notices. Concrete things already in play here: the Clerk middleware lives in **`proxy.ts`** (Next 16's middleware file convention), and a route that reads a file at runtime must be declared in `next.config.ts` → `outputFileTracingIncludes` (see below).

`README.md` is the source of truth for the product narrative, the pipeline diagram, pricing, and the full env-var table. This file covers what you need to *operate in the code* and the patterns that span multiple files.

## Commands

Package manager is **npm** (there's a `package-lock.json`). Don't use pnpm/yarn — the project migrated off pnpm on 2026-08-27, so a stray `pnpm install` will produce a second, divergent lockfile.

`package.json` carries one `overrides` entry: `"esbuild": "^0.25.0"`. `drizzle-kit` loads `drizzle.config.ts` through the abandoned `@esbuild-kit/*` packages, which pin a vulnerable esbuild and have no fixed release — npm's own suggested fix is a downgrade to `drizzle-kit@0.18.1`, which would break the migration workflow. The override takes the audit to zero; `npm run db:generate` is verified working through it. Remove it only once `drizzle-kit` drops `@esbuild-kit`.

```bash
npm run dev            # next dev
npm run build          # next build  — also the strictest type/bundle check
npm run lint           # eslint (next core-web-vitals + typescript configs)
npm test               # tsx --test over tests/*.test.ts (node:test, no framework dep)
npm run scrape         # tsx scripts/scrape.ts — rebuild data/jobs.json locally

npm run db:push        # apply db/schema.ts straight to the DB (dev workflow)
npm run db:generate    # diff schema → emit SQL into db/migrations/ (prod workflow)
npm run db:migrate     # apply committed migrations (prod)
npm run db:studio      # drizzle studio
```

Tests run on **Node's built-in runner** via tsx — no jest/vitest/playwright, no new dependency. `tests/*.test.ts` covers the pure logic that is expensive to get wrong: `hasActiveSubscription` and `toView` (who gets into the paid product), `preFilter` (candidate selection, including the mixed-ISO sort and the dedupe exclusion), the `lib/date.ts` timezone helpers, `stripHtml`, `firstNameFromEmail`, and the rate limiter's IP handling.

There is still **no integration or browser harness** — anything touching Clerk, Stripe, Neon, Resend or the Anthropic API is unverified by tests. Full verification is `npm run lint` + `npm test` + `npm run build`, all three of which CI runs on every push (`.github/workflows/ci.yml`).

A note on importing app modules from tests: `lib/subscription.ts` imports `server-only`, which throws outside a React Server context. The pure view mapper lives in **`lib/subscription-view.ts`** for that reason — import from there in tests, not from `lib/subscription`.

Local Stripe webhooks and the cron trigger have setup steps — see README "Local setup". Quick reference: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, and `curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily-digest`.

Path alias: **`@/*` → repo root** (e.g. `@/lib/types`, `@/db`). `drizzle-kit` loads env via `.env.local` then `.env` (mirrors Next's order).

## Architecture in two layers

The free MVP and the paid SaaS share one ranking pipeline. Read `README.md`'s mermaid diagram first; the load-bearing details:

**Free preview — `POST /api/match`** ([app/api/match/route.ts](app/api/match/route.ts)): multipart PDF → `extractProfile` → `preFilter` → `rankJobs` → JSON. No auth. Node runtime, `maxDuration = 60`.

It is **rate limited**, and that is load-bearing: the route takes no auth and each call costs two Claude requests, so an unmetered loop against it is a direct bill. `consumeMatchQuota` ([lib/rate-limit.ts](lib/rate-limit.ts)) increments a per-IP and a global daily counter in one upsert and returns 429 `rate_limited` / `daily_capacity_reached`. Limits come from `MATCH_DAILY_LIMIT_PER_IP` (default 5) and `MATCH_DAILY_LIMIT_GLOBAL` (default 100). The counter write is the **only** DB access on this path — keep it that way — and it fails open, because the limiter is a guard, not the product.

Order matters: quota is consumed *after* PDF validation (a malformed upload shouldn't cost a visitor a preview) and *before* `extractProfile` (the first thing that costs money).

**Paid digest — `GET|POST /api/cron/daily-digest`** ([app/api/cron/daily-digest/route.ts](app/api/cron/daily-digest/route.ts)): Bearer-auth (`CRON_SECRET`), fired by Vercel Cron (`vercel.json`, 13:00 UTC Mon–Fri). Joins eligible subscribers, re-ranks per user with concurrency 5, persists a `daily_digests` row, then emails via Resend. `maxDuration = 300` (needs Vercel Pro). Eligibility mirrors `hasActiveSubscription` (trialing/active **or** canceled-but-within-period), not a raw `status` check.

Two behaviours worth not regressing:

- **Idempotency is keyed on *delivery*, not existence.** A `daily_digests` row with `sentAt = null` means the ranking survived and the email didn't, so the next run re-sends from the stored jobs (status `resent`) without paying to re-rank. Checking only whether the row exists — which is what it used to do — makes a single Resend blip cost that subscriber the day permanently.
- **Digests exclude recently-sent jobs.** `recentlySentJobIds` unnests the last `DEDUPE_WINDOW_DAYS` (14) of digests **in Postgres** (`jsonb_array_elements`) so only the ids cross the wire, and passes them to `preFilter`. Without it the digest re-serves yesterday's list: the corpus turns over slowly and `preFilter` is deterministic. The lookup fails open — a repetitive digest beats no digest.

The response body and logs carry `userId`, never `email`: this payload goes to whoever holds `CRON_SECRET` and into Vercel's log retention.

**Resume review — `POST /api/review`** ([app/api/review/route.ts](app/api/review/route.ts)): authed **and** active-subscription-gated (`hasActiveSubscription` → 403 `not_subscribed`). Takes no body — it reads the **stored** PDF of the user's active resume (`resumes.file_data`, base64) and passes it to `reviewResume`, then persists a `resume_reviews` row. A resume uploaded before that column existed has `file_data = null` and returns `pdf_unavailable`; the UI prompts a re-upload rather than falling back to the extracted profile. Surfaced at `/dashboard/review` ([app/dashboard/review/page.tsx](app/dashboard/review/page.tsx)) via `ReviewClient`. Node runtime, `maxDuration = 120`.

### The AI layer is the core abstraction — `lib/ai/`

The free/paid pipelines call `extractProfile` + `rankJobs`; the subscriber resume-review feature adds `reviewResume`. All three follow one rigid pattern worth preserving when you touch them:

- **Forced tool call + Zod validation + single retry.** `extractProfile` ([lib/ai/extract.ts](lib/ai/extract.ts)), `rankJobs` ([lib/ai/rank.ts](lib/ai/rank.ts)), and `reviewResume` ([lib/ai/review.ts](lib/ai/review.ts)) each call Claude with `tool_choice: { type: 'tool', name: ... }`, validate the tool input with a Zod schema, and on failure **replay the conversation with a `tool_result` carrying `is_error: true` and the prettified Zod error**, then try once more. No third attempt — they throw `extraction_failed` / `ranking_failed` / `review_failed`, which the routes map to a 502.
- **Tool input schemas come from Zod via `z.toJSONSchema(...)`, with `$schema` deleted.** Keep that deletion — the Anthropic SDK rejects the `$schema` key.
- **`rankJobs` guards against invented IDs**: every returned `job_id` must be in the candidate set (`byId` map); a mismatch triggers the same retry path.
- The model is pinned in one place: `MODEL` in [lib/ai/client.ts](lib/ai/client.ts) (`claude-sonnet-5`). The client is lazily constructed so missing `ANTHROPIC_API_KEY` only throws at request time.
- **`rankJobs` truncates each description to `RANK_DESCRIPTION_CHARS` (1200) in the prompt.** This is the single biggest cost lever in the product — uncapped, a 50-candidate ranking measured ~53K input tokens. Do not raise it without a reason: the keyword pre-filter already ran against the *full* description, so ranking only needs enough to judge fit among candidates that already matched.
- All shared shapes live in [lib/types.ts](lib/types.ts): `JobSchema`, `ProfileSchema`, `RankedJobsSchema`, `ResumeReviewSchema`, and the derived TS types. This is the contract between scraping, AI, DB (`jsonb` columns are typed `$type<Profile>()` / `$type<MatchedJob[]>()` / `$type<ResumeReview>()`), and UI.

### Jobs data is a committed JSON file, not a table — `lib/jobs.ts` + `data/jobs.json`

- `loadJobs()` reads `data/jobs.json` once and caches it, sharing a single in-flight promise so concurrent requests on a cold lambda don't each parse the ~44 MB file. `preFilter(jobs, profile, excludeIds?)` keeps jobs whose `title + description` contains any of the candidate's top-5 skills (case-insensitive substring), sorts by **parsed instant** (not string — the sources emit different ISO formats), and returns 50. A thin skill match is **padded** with the freshest remaining jobs rather than discarded. `excludeIds` drops jobs already sent to that subscriber. The README explains *why* keyword pre-filter beats embeddings at this scale.
- **Don't call `loadJobs()` just to count.** `loadJobsMeta()` reads the ~100-byte `data/jobs-meta.json` sidecar the scrape writes (`count`, `companies`, `sources`, `generatedAt`) and returns `null` if it's missing. `/dashboard` uses it for the "ranked from N roles" line.
- **Runtime `fs` read gotcha:** because `/api/match` reads `data/jobs.json` at runtime, [next.config.ts](next.config.ts) declares `outputFileTracingIncludes: { "/api/match": ["./data/jobs.json"] }` so Vercel bundles the file. **If you add another route or function that reads `data/jobs.json`, add it to that map too** or it'll 500 in production (the file tracer can't follow the dynamic `path.join`).
- The file is regenerated nightly by GitHub Actions ([.github/workflows/scrape.yml](.github/workflows/scrape.yml)) which runs `npm run scrape` and commits the result (Vercel auto-redeploys). The scrape needs **no secrets** — only public JSON endpoints.
- `scripts/scrape.ts` upserts by job id, stamps `_last_seen`, **drops anything not seen in 14 days**, and sorts (source, then parsed `posted_at` desc) for diff stability. Four sources, one file each in `lib/scrapers/` returning `Job[]`: **greenhouse**, **ashby**, **lever**, **remoteok**. To add a company, edit the matching `*-companies.ts` slug list — and put a company on exactly **one** ATS list, or the same role is ingested twice under different ids.
- **Ashby is where the startups are.** A 2026-08-27 audit found 27 of 45 configured slugs dead; most had migrated to Ashby (OpenAI, Notion, Supabase, Linear, Ramp, Plaid, Zapier, Snowflake, Perplexity). Its API also gives `descriptionPlain` (no HTML stripping) and a real `publishedAt`, where Greenhouse only exposes `updated_at` — which is why an edited old Greenhouse posting looks brand new.
- **The scrape fails loudly on rot.** `assertHealthy` enforces `MIN_JOBS_PER_SOURCE`, a 50% shrink guard, and a `MAX_TOTAL_JOBS` ceiling, exiting non-zero *before* writing. Board slugs die constantly and every scraper swallows per-board failures by design, so without this the nightly job stays green while coverage decays. If it trips, find the current slug and update the list — don't lower the floor to make it pass.

### Database — `db/`

- **Neon serverless over HTTP** (`drizzle-orm/neon-http`), not the pooled/websocket driver. Drizzle is the ORM.
- `db` ([db/index.ts](db/index.ts)) is a **lazy `Proxy`** — the real client is created on first property access. This is deliberate: `next build` / lint can run without `DATABASE_URL`, and it only throws at actual query time if the var is missing. Don't replace it with an eager client.
- [db/schema.ts](db/schema.ts) is the schema source of truth. Dev applies it with `db:push` (no migration files); production uses `db:generate` → commit the SQL in `db/migrations/` → `db:migrate`. Tables: `users`, `subscriptions`, `resumes`, `daily_digests`, `rate_limits` (free-preview counters, see below — no user data, keys hold a salted IP hash), `resume_reviews` (latest review per user, indexed on `(user_id, created_at)`, no uniqueness). `resume_reviews` shipped via the committed `0001` migration — the first real exercise of the generate→migrate flow against prod (prod tracks applied migrations in `drizzle.__drizzle_migrations`).
### Data retention is code, not just policy — keep them in sync

`/privacy` makes three concrete promises, and each is enforced somewhere specific. If you change one, change the other:

- **Only the current resume's PDF is stored.** `app/api/resume/route.ts` clears `file_data` on the rows it supersedes (`.set({ isActive: false, fileData: null })`) in the same statement that deactivates them. Don't drop that — without it every PDF a user ever uploaded accumulates forever.
- **Match history lives `DIGEST_RETENTION_DAYS` (30) days.** `pruneExpiredDigests()` in [lib/retention.ts](lib/retention.ts) runs at the end of every daily-digest cron. `/dashboard/history` filters on the *same* `daysAgoInET(DIGEST_RETENTION_DAYS)` cutoff, so the window shown and the window kept can't drift apart.
- **The free preview stores nothing.** `/api/match` never touches `resumes`. It writes only a rate-limit counter keyed by a salted **hash** of the caller's IP — never the address itself (see `lib/rate-limit.ts`).

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
