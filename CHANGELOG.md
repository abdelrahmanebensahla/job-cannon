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

## SaaS Phase 1 — Authed resume upload (built, verification deferred)

**Date:** 2026-05-22

**Completed:**
- `components/Header.tsx` — sticky top nav (logo · Pricing · auth-state CTAs · `<UserButton />`). Uses Clerk v7's `<Show when="signed-in|signed-out">` server component pattern (replaces the old `<SignedIn>`/`<SignedOut>` boundary components — those moved out of `@clerk/nextjs` in v7).
- Mounted `<Header />` in `app/layout.tsx` so every route gets the nav.
- `lib/auth/ensure-user.ts` — read-then-insert helper that mirrors the Clerk user into our `users` table on first authed write. Belt-and-suspenders against the Clerk-webhook-vs-first-request race (e.g. social SSO with instant redirect).
- `app/api/resume/route.ts` — POST, Clerk-authed. Same PDF guardrails as `/api/match` (size, content-type, magic bytes). Calls `extractProfile`, then deactivates prior active resumes for the user, then inserts the new active resume. Returns `{ ok, resumeId, profile }` or a stable error code.
- `app/onboarding/page.tsx` — server component. Redirects unauthed users to `/sign-in?redirect_url=/onboarding`. Redirects users with an existing active resume to `/dashboard`. Otherwise renders `<OnboardingClient />`.
- `components/OnboardingClient.tsx` — dropzone (same UX as the public MatchClient), indeterminate Progress while processing, on success shows the extracted profile via `<ProfileSummary>` plus a "Continue to billing" link to `/pricing` (built in Phase 2).
- `pnpm build` clean; all 8 routes register and proxy attaches.

**Decisions / discoveries:**
- **Clerk v7 breaking change:** the boundary components `<SignedIn>`/`<SignedOut>` and `<SignIn.Loading>` etc. were removed from `@clerk/nextjs`. The replacement is `<Show when="signed-in">` (server component, awaitable). Migrated Header to it.
- **shadcn (base-ui flavor) doesn't ship `asChild`:** the new shadcn scaffolding uses `@base-ui/react/button` rather than Radix Slot, so `<Button asChild>` doesn't typecheck. Used `buttonVariants(...)` directly on `<Link>` elements where button styling on a link was needed.
- **Neon HTTP doesn't support multi-statement transactions.** The deactivate-old-then-insert-new resume flow runs as two sequential statements with a brief window where two rows could be active. All readers filter on `isActive=true` and we tolerate the race — single-user flow, very small window.
- **Did not refactor `lib/ai/extract.ts`** — already cleanly importable; spec only asked for the refactor "if you haven't already."
- **Landing page (`/`) now renders dynamic** because the Header uses `<Show>`, which reads auth state. Acceptable cost for the cleaner UX of a unified nav.

**Blocked on user (still):**
- Without Neon + Clerk provisioned, hitting `/onboarding` or `/api/resume` will throw at request time. Static checks pass.

**Next:** SaaS Phase 2 — Stripe checkout + Customer Portal + webhook. Requires user to create the two products in Stripe dashboard and copy the `price_xxx` IDs.

## SaaS Phase 2 — Stripe checkout + portal + webhook (built, verification pending)

**Date:** 2026-05-22

**Completed:**
- `lib/stripe/client.ts` — Stripe singleton + `resolvePriceId('monthly' | 'yearly')` server-side resolver + `TRIAL_PERIOD_DAYS = 7`.
- `lib/stripe/subscription.ts` — `getCurrentSubscription(userId)` and `syncSubscriptionFromStripe(sub, fallbackUserId?)`. The sync helper handles upserts from both `checkout.session.completed` (with fallbackUserId) and the `customer.subscription.*` events (which carry `metadata.userId`).
- `lib/app-url.ts` — auto-resolves absolute base URL: `NEXT_PUBLIC_APP_URL` > `VERCEL_PROJECT_PRODUCTION_URL` > `VERCEL_URL` > localhost. Means Vercel deploys "just work" without manual host config.
- `app/api/checkout/route.ts` — Clerk-authed POST `{ priceId }`. `ensureUser` mirror, then Stripe Checkout session with `client_reference_id: userId`, `customer_email`, `subscription_data.trial_period_days: 7`, **`subscription_data.metadata.userId`** (so future webhook events can route to the user even without the original session). Returns `{ ok, url }`.
- `app/api/portal/route.ts` — Clerk-authed POST. Looks up `stripeCustomerId` from the user's most recent subscription; creates billing-portal session with `return_url: /dashboard`.
- `app/api/webhooks/stripe/route.ts` — verifies `stripe-signature` against `STRIPE_WEBHOOK_SECRET`. Routes events:
  - `checkout.session.completed` (subscription mode only): retrieves the full subscription with `expand=['items.data.price']`, calls sync with `userId` from `client_reference_id` / `session.metadata.userId`.
  - `customer.subscription.updated` and `customer.subscription.deleted`: sync directly from `event.data.object`. If metadata is missing (stray test event), ack + log + ignore.
  - Other event types: ack with `ignored:<type>` so Stripe doesn't retry.
- `components/PricingClient.tsx` — client island. `useAuth()` from Clerk; signed-out clicks redirect to `/sign-up?redirect_url=/pricing`; signed-in clicks POST and `window.location.href = data.url`. Maps server error codes to user-friendly copy.
- `app/pricing/page.tsx` — two cards, "save $29" badge on the annual plan, feature list, links to `/terms` + `/privacy`, banner for `?canceled=1`.
- `app/privacy/page.tsx` + `app/terms/page.tsx` — minimal real text (not lorem-ipsum) so Stripe and the user have working links. Phase 5 can expand if needed.
- `app/dashboard/page.tsx` — Phase 2 stub. Redirects unauthed/no-sub/no-resume users; renders a welcome banner on `?welcome=1`. Phase 3 fully replaces with the real digest UI.
- `proxy.ts` — uses `createRouteMatcher(['/dashboard(.*)', '/onboarding(.*)'])` + `auth.protect()`. Subscription gate handled in the dashboard layout (kept out of middleware to avoid a Neon roundtrip on every nav).
- `.env.local.example` extended with optional `NEXT_PUBLIC_APP_URL`. README extended with Stripe CLI usage, expanded env var table.

**Spec correction acknowledged:** Stripe no longer accepts `trial_period_days` on the Price object. Set it on the Checkout Session via `subscription_data.trial_period_days: 7` instead. Both `/api/checkout` and the resulting Stripe Subscription pick it up correctly; the webhook flow stores `status: 'trialing'` until the trial elapses, then Stripe fires `customer.subscription.updated` with `status: 'active'`.

**Decisions:**
- **`current_period_end` lives on `SubscriptionItem`, not `Subscription`** in Stripe API ≥ 2025-04-30. `syncSubscriptionFromStripe` reads `sub.items.data[0].current_period_end` and gracefully falls back to `cancel_at` or epoch if the items array is somehow empty.
- **`metadata.userId` on the Subscription** (not just the Session) so every future `customer.subscription.*` event self-routes. Avoids needing to join Stripe customer ids back to Clerk user ids.
- **Sub check in dashboard layout, not middleware.** Spec wording suggested middleware; we chose the layout because Drizzle in edge runtime adds cold-start cost and route protection works identically either way. Auth gate stays in middleware.
- **`stripe.subscriptions.retrieve(..., { expand: ['items.data.price'] })`** on the session-completed path. Without expand, `items.data[0].price` would be a string id and we'd lose pricing data we might want later.
- **Idempotency** is upsert-based: every webhook handler ends up calling `syncSubscriptionFromStripe`, which `onConflictDoUpdate` on `subscriptions.id`. Out-of-order delivery is tolerated as long as the latest event represents the latest state — fine for Stripe's at-least-once guarantee.
- **No `apiVersion` pin on the Stripe SDK.** Letting the SDK use the version it's typed against avoids drift between runtime + types. If Stripe ships a new major API, we'll pin explicitly then.

**Blocked on user (Phase 2 DoD):**
1. **Set `STRIPE_WEBHOOK_SECRET` for local dev.** Run `stripe login` then `stripe listen --forward-to localhost:3000/api/webhooks/stripe`. Copy the printed `whsec_...` into `.env.local`. README has the full flow.
2. **Production webhook endpoint:** in the Stripe dashboard create a webhook endpoint pointing at `https://job-cannon.vercel.app/api/webhooks/stripe`, subscribed to `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`. Copy the signing secret into Vercel env vars as `STRIPE_WEBHOOK_SECRET`. (Spec correction note: this secret is different from the local Stripe-CLI one — keep both in their respective environments.)
3. **End-to-end test:** `pnpm dev`, drop a resume on `/onboarding`, hit "Continue to billing," start the monthly trial with test card `4242 4242 4242 4242`. Expected outcome: redirected to `/dashboard?welcome=1`, a `subscriptions` row exists with `status='trialing'`, the Clerk-CLI terminal logs the `checkout.session.completed` event being forwarded.

**Next:** SaaS Phase 3 — real dashboard (today's digest, history, resume manager, billing portal link). Phase 4 is the daily cron + Resend email digest.

### Phase 2 verification (closed 2026-05-24)

End-to-end test on prod with a fresh Clerk account `abdelrahmane4216+test1@gmail.com`:

- `users` row landed via Clerk webhook on signup.
- `resumes` row inserted by `/api/resume` (`abdelrahmane_bensahla_resume_2.0.pdf`, `is_active=true`).
- `subscriptions` row inserted by Stripe webhook: `sub_1Taf0x2OPNNpBbdKmB44d5xZ`, status `trialing`, price = monthly, period ends 2026-05-31 (= signup + 7d = trial-period working).

Two bugs caught + fixed during this verification round:

1. `auth.protect()` in Clerk v7 falls through to a 404 when `signInUrl` isn't configured via env vars. Replaced with explicit `NextResponse.redirect(/sign-in?redirect_url=…)` in `proxy.ts` (commit `ae9fc5a`).
2. The post-signup funnel had no path to `/onboarding`: my `/dashboard` checked sub *before* resume, so freshly-signed-up users bounced dashboard → /pricing in a loop. Two fixes (commit `f72ccae`):
   - `<SignUp forceRedirectUrl="/onboarding">` — new users always land on the resume upload step.
   - Dashboard layout/page checks resume *before* sub.

Also discovered (and acted on): Stripe holds failed webhook deliveries for 30 days; the user's orphan subscription self-healed via Stripe's retry once `STRIPE_WEBHOOK_SECRET` was correctly set on Vercel. No manual replay needed.

## SaaS Phase 3 — Subscriber dashboard (built)

**Date:** 2026-05-24

**Completed:**
- `app/dashboard/layout.tsx` — single source of truth for the three gates (auth → resume → active sub). Renders the sidebar + bottom-nav chrome. Replaces the per-page gate code from Phase 2.
- `app/dashboard/page.tsx` — today's digest in two states: digest present (renders 10 `<JobCard>`s with "X matches · emailed/pending") or empty state with a live countdown to the next 8am ET cron run.
- `app/dashboard/history/page.tsx` — past 30 days. Each entry is a `<details>` disclosure: date + top-3 company preview collapsed; full 10 `<JobCard>`s expanded. Empty state on first-day users.
- `app/dashboard/resume/page.tsx` — filename + upload date + full `<ProfileSummary>` for the active resume. "Replace resume" expands a dropzone that hits `/api/resume`; the existing resume row is auto-deactivated by the API and the new one becomes active.
- `app/dashboard/billing/page.tsx` — current plan ($9/mo or $79/yr, resolved by matching `priceId` against env vars), status badge, "Cancels at period end" badge if relevant, renewal date, and a `<PortalButton />` that opens Stripe's hosted portal.
- `components/DashboardNav.tsx` — `<DashboardSidebar>` (desktop, `sm:block`) and `<DashboardBottomBar>` (mobile, `sm:hidden`, fixed bottom). Active-route highlight via `usePathname`.
- `components/NextDigestCountdown.tsx` — client island, ticks every minute, computes next 13:00 UTC weekday in plain JS (no tz lib — accepts a ~1h drift across DST).
- `components/PdfDropzone.tsx` — extracted from `OnboardingClient` so the dashboard's "Replace resume" flow can reuse it.
- `components/ReplaceResumeClient.tsx` — inline dropzone + `router.refresh()` on success; no redirect.
- `components/PortalButton.tsx` — POSTs `/api/portal`, follows the returned Stripe URL.
- `components/resume-shared.ts` — extracted `RESUME_ERROR_COPY` + `ResumeApiResponse` type so both the onboarding and replace flows render the same error strings.
- `lib/date.ts` — `todayInET()` (YYYY-MM-DD in America/New_York) + `formatShortDate` / `formatLongDate` (also in ET). All dashboard date math runs through these so the user always sees the cron's tz.

**Decisions:**
- **Gates live in the layout, not per-page.** Layout runs the three DB checks once; child pages just `auth()` for the userId. Less duplication, fewer queries on /dashboard/* navigations.
- **`<details>` for history disclosure**, native HTML, no client state machine for the toggle.
- **Mobile = fixed bottom tab bar.** Spec offered shadcn `Sheet` as an alternative; the bar is more app-like for an MVP dashboard with only 4 destinations and is a fraction of the JS.
- **`router.refresh()` over an optimistic update** on resume replace. The server component re-runs with the new active row; correctness > perceived speed for a once-in-a-while action.
- **Plan label resolved by matching the stored `price_id` against the two `NEXT_PUBLIC_STRIPE_PRICE_*` env vars.** Falls back to "Custom plan" if neither matches, so legacy users on a deprecated price still get a sensible label.
- **Did NOT build re-engagement emails for users who sign up but don't subscribe** — spec said defer.

**Blocked on user (none for Phase 3 DoD per se — needs Phase 4 cron rows to populate):**
- Real verification of the "has digest" branch requires Phase 4's cron to have written a `daily_digests` row. Until then, every visit to `/dashboard` will render the empty state with the countdown.
- /dashboard/resume + /dashboard/billing can be exercised today (you have an active resume + trialing sub already).

**Next:** SaaS Phase 4 — `/api/cron/daily-digest` + React Email + Resend wiring + `vercel.json` cron config.

## SaaS Phase 4 — Daily cron + email digest (built, awaiting Resend + CRON_SECRET)

**Date:** 2026-05-24

**Completed:**
- Installed `resend@6.12.3` and `@react-email/components@1.0.12`.
- `emails/daily-digest.tsx` — React Email template. Light-mode-only per spec. Renders:
  - Greeting: "Good morning, {firstName}" with date label
  - Top 3 detailed cards (company, title, location, full reasoning, score chip color-coded red/amber/emerald)
  - Next 7 compact rows (title-as-link, company, location, score)
  - "View all on the dashboard" button
  - Footer with "Manage subscription or unsubscribe" → /dashboard/billing (per spec, unsubscribe = cancel)
- `lib/email/client.ts` — singleton Resend client + `getFromAddress()` (defaults to `Job Cannon <onboarding@resend.dev>`; override via `DIGEST_FROM_EMAIL` once a custom domain is verified).
- `lib/email/greeting.ts` — `firstNameFromEmail()`: strips trailing digits, splits on `._+-`, title-cases first token. No DB column needed; no Clerk roundtrip in the per-user loop.
- `lib/email/send-digest.ts` — render template + send via Resend with subject `"Your N startup jobs — Month Day"`.
- `app/api/cron/daily-digest/route.ts`:
  - `Authorization: Bearer ${CRON_SECRET}` check on both GET (Vercel Cron default) and POST (manual triggers).
  - `runtime='nodejs'`, `maxDuration=300` (Vercel Pro; on Hobby the function caps at 60s — flagged in code comments).
  - Joins users + subscriptions + resumes; collapses to one row per userId (handles users with multiple active subs).
  - Loads `data/jobs.json` once.
  - Concurrency-5 processing via a `runWithConcurrency` helper. Per user:
    1. Idempotency check on `(userId, digestDate)`
    2. `preFilter` → truncate to **30** candidates (smaller than MVP's 50 per spec — costs scale linearly with users)
    3. `rankJobs` → slice top 10
    4. Insert digest row with `onConflictDoNothing` on the unique index (catches concurrent inserts cleanly)
    5. Send email; on success, `update sent_at`. On email failure, leave `sent_at` null and continue.
  - Returns `{ ok, processed, sent, errors, skipped, digestDate }`.
- `vercel.json` — `crons: [{ path: '/api/cron/daily-digest', schedule: '0 13 * * 1-5' }]`. 13:00 UTC = 8am ET in DST, 9am EST in winter, per spec.

**Decisions:**
- **Persist-then-send.** Digest row commits before the email goes out. If email fails, the digest is still in the DB and shows up in the user's dashboard (sentAt null). Avoids the inverse failure (email sent, DB write lost = duplicate next run).
- **30 candidate jobs, top 10 returned.** Per spec, "Don't increase the per-user candidate pool beyond ~30 jobs. Costs scale linearly with users."
- **Email greeting uses email-prefix derivation** rather than a Clerk roundtrip or a new DB column. Trivial code, zero per-user cost.
- **Email rendered server-side via Resend's `react:` parameter.** No separate render step; Resend handles it.
- **No retry on email failures within a single cron run.** Failed emails just log; next-day run will see a previous-day digest exists and skip. Defer retry/admin replay until we have real volume.
- **GET + POST both supported.** Vercel Cron uses GET. POST is for manual `curl -X POST -H "Authorization: Bearer $CRON_SECRET" ...` triggers during testing.

**Blocked on user (Phase 4 DoD):**
1. **Resend account + `RESEND_API_KEY`** in Vercel (Production) and `.env.local`. Free tier is fine; no domain needed if we keep `onboarding@resend.dev` as the sender. With that sender, Resend only delivers to the account owner's email — which is what we want for the first end-to-end test anyway.
2. **`CRON_SECRET` in Vercel.** Two ways:
   - Vercel auto-generates it the first time you configure a cron. Check Vercel dashboard → Project → Settings → Cron Jobs.
   - Or set it manually: any high-entropy string is fine, e.g. `openssl rand -hex 32`.
   Put the same value in `.env.local` for local manual tests.
3. **Manual smoke test** once secrets are set:
   ```
   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://job-cannon.vercel.app/api/cron/daily-digest
   ```
   Expected: `{"ok":true,"processed":1,"sent":1,"errors":0,"skipped":0,"digestDate":"2026-05-24"}` (or close to it). Then check your inbox + visit `/dashboard` to see the digest rendered there.
4. **(Optional) Verify a sending domain in Resend** if you want emails from `digests@<your-domain>` instead of `onboarding@resend.dev`. Set `DIGEST_FROM_EMAIL=Job Cannon <digests@your-domain.com>` once verified.

**Notes for tomorrow's first scheduled cron fire (8am ET):**
- The cron will fire automatically per the `vercel.json` schedule once deployed. To validate without waiting: run the manual curl above any time after Resend + CRON_SECRET are set.
- After today's manual run, calling the endpoint again will return all `skipped` (idempotency on `(userId, digestDate)`). To re-test, delete the day's row: `delete from daily_digests where digest_date = '2026-05-24';`

**Next:** SaaS Phase 5 — landing page conversion polish (hero rewrite, nav bar, CTAs after free preview results). Phase 6 = launch checklist (migrations, live Stripe keys, analytics).

### Phase 4 verification (closed 2026-05-24, late)

End-to-end manual cron trigger:
```
{"ok":true,"processed":1,"sent":1,"errors":0,"skipped":0,"digestDate":"2026-05-24","details":[{"...","email":"abdelrahmane4216@gmail.com","status":"sent"}]}
```
Email arrived at `abdelrahmane4216@gmail.com` rendered as designed (top-3 fat cards, 7 compact rows, dashboard CTA, manage-sub footer).

**Bugs caught during verification:**

1. **Resend v6 SDK returns `{ data, error }` rather than throwing** on API errors. My initial code assumed `await emails.send(...)` would throw on failure — it doesn't, which made silent partial successes possible (`sentAt` getting set on a failed delivery). Fixed in `lib/email/send-digest.ts`: promote a non-null `error` to a thrown exception so the cron's `try/catch` sees the failure.
2. **React Email's `<Tailwind>` wrapper must wrap the `<Html>` element, not sit inside it**, because the wrapper needs to find a `<head>` child somewhere in its subtree to inject style tags for non-inlineable utilities like `hover:underline`. Initial template had `<Tailwind>` only wrapping `<Body>` → component threw at render time with a useful error message. Fixed by restructuring to `<Tailwind><Html><Head /><Body>...</Body></Html></Tailwind>` and dropping all `hover:` utilities (they're unreliable across email clients anyway).
3. **Vercel runtime logs collapse multi-line console output to one row per request in the API view** — `console.error` lines weren't surfaceable through the MCP tooling. Added a `details[]` array to the cron's JSON response so per-user outcomes are visible inline, no log spelunking needed.
4. **Resend sandbox restriction discovered:** the default `onboarding@resend.dev` sender (free tier, no domain verification) only delivers to the **exact** email address on the Resend account. Gmail `+aliases` like `abdelrahmane4216+test1@gmail.com` count as different recipients. Workaround for verification: updated the test user's email column in Neon to the unaliased version. Long term (Phase 6) we need a verified sending domain.
5. **Vercel env var changes don't propagate to existing deployments** — rotating `CRON_SECRET` after the latest deploy was built means the lambda still has the old value baked in. Required a manual "Redeploy" from the dashboard. Documented for the launch checklist.

**Outcome:** all 4 cron status codes (`sent`, `skipped`, `inserted_no_email`, `error`) exercised in the wild. Idempotency on `(userId, digestDate)` confirmed. Concurrency-5 batching confirmed (trivially — only 1 subscriber, but the code path ran). Pipeline is wired correctly; productionizing for non-self recipients requires the Resend domain step in Phase 6.

**Test state note:** the `users` row for `user_3EB8FrT34fC9HpHB8EjNEwgWUL7` now has email `abdelrahmane4216@gmail.com` instead of the original `+test1` alias. If you ever trigger a Clerk `user.updated` event, our `user.created` handler doesn't re-sync (we only handle `user.created` and `user.deleted` today). So the manual edit will persist unless you delete + recreate that test user in Clerk.

### User decisions (end of 2026-05-22 session)

- **GitHub remote:** user will create the repo + push themselves (no `gh` CLI install).
- **Vercel deploy:** user will deploy via the Vercel dashboard, not the CLI.
- **Phase 2 end-to-end verification:** explicitly skipped for now. Treat Phase 2 DoD as "code complete + static checks pass." A real verification will happen the first time someone runs the production deploy with a real key.

### Handoff to user for end-of-Phase-4 closure

1. **Push to GitHub.** `git remote add origin git@github.com:<you>/job-cannon.git && git push -u origin main`. Optionally set the repo description "AI resume to job matching, powered by Claude" and tag with `nextjs`, `typescript`, `claude`, `ai`, `job-search`. Once Actions is enabled (default on new repos), `Nightly scrape` will appear under the Actions tab. Run it manually via `workflow_dispatch` to confirm it works before the first cron fire.
2. **Deploy to Vercel.** Import the GitHub repo in the Vercel dashboard. Set `ANTHROPIC_API_KEY` under Project Settings → Environment Variables. Trigger a deploy. The function defaults work but if `/api/match` ever 504s, check that the project is on the Pro plan or drop the pre-filter to 25 candidates per spec.
3. **Update README.** Replace `_(coming after first Vercel deploy — see CHANGELOG.md)_` with the live URL. Take a screenshot of the landing page + a results page and add them in place of `_(Screenshot will land here...)_`. Commit.
4. **Verify e2e.** Drop a real resume PDF on the production URL and confirm the round-trip works.
