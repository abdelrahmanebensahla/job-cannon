# Changelog

Resume protocol: at session start, read `BUILD_SPEC.md` (or the spec the user pasted in) plus this file to find the current phase. Each phase entry below records what was completed, decisions made, and any deferred TODOs.

## Phase 0 — Bootstrap (in progress → completed)

**Date:** 2026-05-22

**Completed:**
- Scaffolded Next.js + Tailwind + TypeScript via `pnpm create next-app` (in-place into existing `job_cannon/` directory).
- Installed runtime deps: `@anthropic-ai/sdk` 0.98.0, `zod` 4.4.3, `react-dropzone` 15.0.0.
- Installed dev dep: `tsx`.
- Approved esbuild build script (needed by tsx).
- Initialized shadcn/ui with default preset; added Button, Card, Input, Badge, Skeleton, Progress.
- Created `.env.local.example` with `ANTHROPIC_API_KEY=` only.
- Adjusted `.gitignore` so `.env*.example` is committable while `.env.local` stays ignored.
- Created `data/.gitkeep` so the jobs.json directory exists.
- Replaced default scaffold landing page with a clean placeholder hero.
- Updated `<title>` and meta description in `app/layout.tsx`.
- Verified `pnpm build` compiles successfully with no TS errors.

**Decisions / deviations from spec:**
- Spec says Next.js 15; `create-next-app` defaults to Next.js **16.2.6** with Turbopack + Tailwind v4. Going with the defaults — App Router conventions unchanged, no spec requirement actually depends on v15. Next 16 ships an `AGENTS.md` reminding agents to read `node_modules/next/dist/docs/` before writing code that uses newer APIs (kept as-is in repo).
- Tailwind v4 uses CSS-based config (no `tailwind.config.ts`); shadcn handled this automatically.
- `pnpm create next-app` already ran `git init`, so no separate init needed.

**Deferred:**
- Public GitHub repo creation. `gh` CLI not installed on this machine. User needs to either install `gh`, manually create `github.com/<user>/job-cannon` and add as remote, or hand off the push step. Local commit will be made; remote setup waits on user.

**Next:** Phase 1 — scrapers + `data/jobs.json`.

## Phase 1 — Scrapers + `data/jobs.json` (completed)

**Date:** 2026-05-22

**Completed:**
- `lib/types.ts` — shared `Job`, `Profile`, `RankedJobs`, `MatchedJob` types + Zod schemas.
- `lib/scrapers/html.ts` — entity-decoding HTML→plain-text stripper, capped at 4000 chars.
- `lib/scrapers/greenhouse.ts` + `greenhouse-companies.ts` (30 slugs).
- `lib/scrapers/lever.ts` + `lever-companies.ts` (15 slugs).
- `lib/scrapers/remoteok.ts` (sends UA — endpoint 403s without it).
- `scripts/scrape.ts` orchestrator: parallel fetch, upsert by `id`, drop entries not seen in 14 days, write pretty JSON.
- `pnpm scrape` script.
- First scrape produced **4041 jobs** (Greenhouse 3715, Lever 226, RemoteOK 100). Comfortably above the 500 DoD.

**Decisions:**
- Tolerated per-board 404s. 13/30 Greenhouse and 12/15 Lever slugs returned 404 — most companies migrated ATSes (real-world list rot). Could revisit slugs later, but DoD is met and the scraper now degrades gracefully when any individual board breaks.
- jobs.json file is **17.8 MB** committed. Acceptable for MVP; can revisit (truncate descriptions, drop oldest by source) if Vercel function bundle size becomes a problem.
- Stripped HTML once on ingest (during scrape) instead of at match time — keeps the AI prompt cheap.
- Sorted output by `source, posted_at desc` for diff stability (nightly cron will produce smaller diffs).

**Deferred:**
- Per-board health metrics / surfacing the 404s in CI. Not needed yet.
- Slug repair pass (find current ATS for each migrated company).

**Next:** Phase 2 — `POST /api/match` route.

## Phase 2 — Match API (built, verification pending)

**Date:** 2026-05-22

**Completed:**
- `lib/ai/client.ts` — singleton Anthropic client, fail-fast on missing key. `MODEL = 'claude-sonnet-4-6'` constant shared across calls.
- `lib/ai/extract.ts` — PDF → Profile via document content block + forced `submit_profile` tool. Retries once on Zod parse failure, replaying the conversation with a `tool_result` error block. Uses `z.toJSONSchema(ProfileSchema)` (Zod 4 native).
- `lib/ai/rank.ts` — Profile + Job[] → MatchedJob[] via forced `submit_rankings` tool. Retries once on either Zod failure or hallucinated job_id (validates ids against the candidate set). Hydrates rankings with original Job data before returning.
- `lib/jobs.ts` — lazy module-level cache of `data/jobs.json`, plus `preFilter` (top-5 skill substring match, top 50 most-recent; fallback to 50 most-recent overall when <10 hits).
- `app/api/match/route.ts` — multipart PDF in, discriminated union out. Validates: file present, non-empty, ≤10 MB, content-type or `%PDF` magic bytes. `export const runtime='nodejs'; export const maxDuration=60`.
- `next.config.ts` — `outputFileTracingIncludes` for `/api/match` so Vercel bundles `data/jobs.json` into the lambda (the fs.readFile call uses a dynamic path arg that the tracer can't auto-resolve).
- `pnpm build` clean, route registered as ƒ /api/match.

**Decisions:**
- Used Zod 4's built-in `z.toJSONSchema(...)` instead of pulling in `zod-to-json-schema`. Stripped `$schema` key since Anthropic doesn't need it.
- Strict id validation in rank: Claude must use job_ids from the candidate set, dropped otherwise. Retry once with the error before failing.
- 10 MB PDF cap — protects against giant scans/photos. (Resumes are usually <500 KB.)
- All Claude calls funnel through `getClient()`; logging happens at the route level where it has request context. Centralized retry/logging deferred until a second call site demands the abstraction.

**Deferred / blocked:**
- End-to-end verification (Phase 2 DoD strictly requires this) needs `ANTHROPIC_API_KEY` in `.env.local`. Code path compiles and is statically clean. User to provide key before next run.

**Next:** Phase 3 — UI (landing + dropzone + processing + results).

## Phase 3 — UI (built, idle render verified)

**Date:** 2026-05-22

**Completed:**
- `components/MatchScoreRing.tsx` — SVG ring (red <50, amber 50–74, emerald 75+) with score inside.
- `components/JobCard.tsx` — company, title, location, remote/source badges, score ring, native `<details>` for expandable reasoning, "View job →" external link, relative posted-at.
- `components/ProfileSummary.tsx` — name, seniority badge, target roles, locations, top 10 skills as badges, summary.
- `components/MatchClient.tsx` — single client island. Three states: idle (dropzone), processing (Progress bar + 3-step indicator + skeletons), done (ProfileSummary + ranked JobCard list). Error state with friendly copy mapped from API error codes.
- `app/page.tsx` — server component hero + footer + `<MatchClient />` island. Mobile-first layout (`max-w-3xl`, `px-4` on small, `px-6` on sm+).
- Dev server boots cleanly; `GET /` returns 200 / 15 KB.

**Decisions:**
- Used native `<details>/<summary>` for reasoning disclosure — no extra state machine, no Radix Collapsible dependency. CSS handles the open/closed labels with `group-open:`.
- Processing UI is time-based, not event-based: the API is a single round-trip so the client has no real intermediate progress signal. The 3-step indicator advances on a timer (~8s) and the Progress bar tweens towards 92%. Honest visual cadence without faking precision. Worth swapping to SSE/streaming later if cycles allow.
- Friendly error copy lives in MatchClient (single source of truth). Underlying API still returns short stable codes for programmatic use.
- 10 MB cap enforced client-side via react-dropzone AND server-side in the API route.

**Deferred / blocked:**
- End-to-end smoke test (drop PDF → see real results) requires `ANTHROPIC_API_KEY`.

**Next:** Phase 4 — deploy + nightly scrape + README. Also still needs the GitHub remote (deferred from Phase 0).

## Phase 4 — README + cron (partial; deploy blocked on user)

**Date:** 2026-05-22

**Completed:**
- `README.md` rewritten per spec: live-demo placeholder, mermaid arch diagram, "how the matching works" rationale (leads with the explicit "keyword pre-filter vs vector embeddings" design choice for portfolio readers), tech stack, local setup, env table, project layout, MIT license link.
- `LICENSE` (MIT, attributed to the user).
- `.github/workflows/scrape.yml` — nightly cron at 07:00 UTC + `workflow_dispatch`. Sets up pnpm + Node 20, runs `pnpm scrape`, commits `data/jobs.json` only if it changed.

**Blocked on user:**
- **Vercel deployment.** Requires `vercel link` or a token plus a project name choice. Cannot run unattended.
- **GitHub remote + first push.** `gh` CLI not installed on this machine; user needs to either install it, manually create `github.com/<user>/job-cannon` and add it as origin, or hand off the push.
- **README hero screenshot.** Needs a live deploy to look real. Placeholder note left in README.
- **Phase 2 end-to-end verification.** Still pending `ANTHROPIC_API_KEY` in `.env.local`.

**Decisions:**
- Cron set to 07:00 UTC daily. Adjustable; just a sensible "before US workday" default.
- Workflow uses `pnpm/action-setup@v3` with `version: 10` (matches local pnpm 10.12.3).
- Avoided baking the user's name into the README beyond the LICENSE copyright — keeps it portable if the project gets forked.

**Next:** User confirms approach for ANTHROPIC_API_KEY + GitHub remote + Vercel. Then end-to-end verify, deploy, snapshot README screenshot, and Phase 4 closes.

### Phase 4 closure (2026-05-22, later)

- **GitHub remote live:** `github.com/abdelrahmanebensahla/job-cannon`. Auto-init `LICENSE` commit on the remote was overwritten by a `--force-with-lease` push of local main.
- **Nightly scrape verified:** workflow already ran once after the push (commit `447b3e2 chore: refresh jobs.json`). Refreshed counts: greenhouse 3716, lever 226, remoteok 112 — 4054 total. Pulled back into local with a fast-forward.
- **Vercel deploy live:** [job-cannon.vercel.app](https://job-cannon.vercel.app/). `GET /` returns 200 with the expected title + dropzone copy.
- **README updated** with the live demo link.

**Still open (lightweight):**
- Hero screenshot in the README (need a real screenshot from the live UI).
- Phase 2 end-to-end smoke (real resume → ranked results) — user opted to defer earlier; can do anytime now that the deploy is live.

---

# SaaS expansion — starts here

Spec: `SAAS_BUILD_SPEC.md` (pasted v1 by user mid-session 2026-05-22). MVP `/api/match` stays as the free preview.

## SaaS Phase 0 — Wire up DB + auth (built, awaiting user provisioning)

**Date:** 2026-05-22

**Completed:**
- Installed `@clerk/nextjs@7.4.1`, `drizzle-orm@0.45.2`, `@neondatabase/serverless@1.1.0`, `svix@1.94.0`, and dev deps `drizzle-kit`, `dotenv`.
- `db/schema.ts` — `users`, `subscriptions`, `resumes`, `dailyDigests` per spec. Unique index on `(userId, digestDate)` for digest idempotency. `Profile` and `MatchedJob` types reused from MVP via `$type<...>()` on jsonb columns. Inferred `$inferSelect`/`$inferInsert` types exported, plus `hasActiveSubscription` helper.
- `db/index.ts` — Neon HTTP client wrapped in a lazy proxy so module imports don't blow up `next build` when `DATABASE_URL` is absent (only fails on first actual access). Global cache for HMR.
- `drizzle.config.ts` — loads `.env.local` then `.env` (Next's order), emits to `db/migrations/`.
- `package.json` scripts: `db:push`, `db:generate`, `db:migrate`, `db:studio`.
- `proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts` — see deprecation warning) with `clerkMiddleware()`. No route guards yet; SaaS Phase 2 wires those.
- `app/layout.tsx` wrapped in `<ClerkProvider>`.
- `app/sign-in/[[...sign-in]]/page.tsx` + `app/sign-up/[[...sign-up]]/page.tsx` (Clerk catch-all routes).
- `app/api/webhooks/clerk/route.ts` — Svix signature verification + handlers for `user.created` (insert, `onConflictDoNothing`) and `user.deleted` (delete by id). Idempotent. Returns 401 on bad signature, 500 on missing config, 200 on success or ignored event.
- `.env.local.example` extended with all new env vars (DB, Clerk, Stripe placeholders for Phase 2, Resend for Phase 4, CRON_SECRET).
- `pnpm build` still clean. Routes: /, /api/match, /api/webhooks/clerk, /sign-in/[[...sign-in]], /sign-up/[[...sign-up]]; Proxy (Middleware) attached.

**Decisions:**
- **Next 16 file convention change discovered:** `middleware.ts` → `proxy.ts`. The Clerk SDK works unchanged (it returns a NextMiddleware function which Next 16's proxy accepts as a default export). Renamed accordingly to silence the deprecation warning and stay aligned with Next 16 conventions.
- **Lazy Drizzle client:** wrapping the db export in a Proxy means `next build` (which transitively imports the schema during route collection) doesn't crash on missing `DATABASE_URL`. Only request-time code paths trigger client creation.
- **Schema location:** spec said `db/`, not `lib/db/`. Followed spec.
- **jsonb `$type` annotations** on `resumes.profile` and `dailyDigests.jobs` give us full TS narrowing without a runtime cost.
- **Did not factor out `extract-profile.ts`** as a shared helper yet — the spec said "if you haven't already." We have `lib/ai/extract.ts` already exporting `extractProfile`; SaaS Phase 1's `/api/resume` can import it directly. No rename needed.

**Blocked on user (DoD requires all three):**
1. **Neon project + `DATABASE_URL`** in `.env.local`. Once set, `pnpm db:push` creates the four tables.
2. **Clerk app + keys** (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) in `.env.local`. Once set, `/sign-up` renders the Clerk component.
3. **Clerk webhook endpoint** pointing at the deployed `/api/webhooks/clerk`, subscribed to `user.created` and `user.deleted`. Copy the signing secret into `CLERK_WEBHOOK_SECRET`.

**Next:** SaaS Phase 1 — authed resume upload + persisted profile (`/onboarding`, `/api/resume`, `<UserButton />`). Can scaffold without DB up; final verification waits on Phase 0 provisioning.

### User decisions (end of 2026-05-22 session)

- **GitHub remote:** user will create the repo + push themselves (no `gh` CLI install).
- **Vercel deploy:** user will deploy via the Vercel dashboard, not the CLI.
- **Phase 2 end-to-end verification:** explicitly skipped for now. Treat Phase 2 DoD as "code complete + static checks pass." A real verification will happen the first time someone runs the production deploy with a real key.

### Handoff to user for end-of-Phase-4 closure

1. **Push to GitHub.** `git remote add origin git@github.com:<you>/job-cannon.git && git push -u origin main`. Optionally set the repo description "AI resume to job matching, powered by Claude" and tag with `nextjs`, `typescript`, `claude`, `ai`, `job-search`. Once Actions is enabled (default on new repos), `Nightly scrape` will appear under the Actions tab. Run it manually via `workflow_dispatch` to confirm it works before the first cron fire.
2. **Deploy to Vercel.** Import the GitHub repo in the Vercel dashboard. Set `ANTHROPIC_API_KEY` under Project Settings → Environment Variables. Trigger a deploy. The function defaults work but if `/api/match` ever 504s, check that the project is on the Pro plan or drop the pre-filter to 25 candidates per spec.
3. **Update README.** Replace `_(coming after first Vercel deploy — see CHANGELOG.md)_` with the live URL. Take a screenshot of the landing page + a results page and add them in place of `_(Screenshot will land here...)_`. Commit.
4. **Verify e2e.** Drop a real resume PDF on the production URL and confirm the round-trip works.
