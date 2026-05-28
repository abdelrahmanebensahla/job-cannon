# Screenshots

Capture instructions for the README hero strip. File names below are what the project README references — drop the captured images here with these exact names and the README renders correctly.

The polish pass renders cleanly in dark mode (system preference) and light mode. For portfolio screenshots, dark mode looks more distinctive — capture in dark unless otherwise noted.

Capture at **1440×900** browser viewport for consistent crops. Full-page captures (Cmd+Shift+S in Chrome → "Capture full size screenshot" via DevTools cmd palette) for pages that scroll past the fold.

## Captured this session

Live captures verified from `https://job-cannon-abdelrahmane-bensahlas-projects.vercel.app` (Vercel fallback URL — `jobcannon.app` failed to load in the automation browser, see HANDOFF.md). Save the same URLs from your local browser to:

- `landing-logged-out.png` — `/` while signed out. Shows hero, dropzone, How-it-works numbered rows.
- `pricing.png` — `/pricing`. Two-plan bordered cards ($8/$60).

## Still to capture (need active subscription)

Capture from your own browser when you're back to having an active sub on `jobcannon.app`:

- `dashboard-today.png` — `/dashboard` with today's digest rendered. Top 10 ranked job cards (the headline portfolio screenshot — pure-typography match scores and hairline dividers).
- `dashboard-billing.png` — `/dashboard/billing`. Plan name + status block + Manage button.
- `email-digest.png` — Open today's `digests@jobcannon.app` email in Gmail or Mail.app, screenshot the rendered email. This is the value-prop screenshot.

## Captures from the marketing path (no auth needed)

These can be captured anytime even without an active sub:

- `sign-in.png` — `/sign-in` rendered from `jobcannon.app` (Clerk's production widget only loads on that origin — won't render from `*.vercel.app`).
- `dev-components.png` (optional, design-system flex) — `/dev/components` rendered locally via `pnpm dev`. Shows every subscription-state variant of the badge + status block on one page.

## Acceptance bar

- 1440px wide minimum
- No browser chrome (URL bar, bookmarks bar) visible — use Cmd+Shift+P → "Capture full size screenshot" in Chrome DevTools
- No private/personal data (real user emails, real Stripe customer IDs) visible. Use the live test account or blur in post.
- PNG preferred; JPEG OK if the file is enormous.
