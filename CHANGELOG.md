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
