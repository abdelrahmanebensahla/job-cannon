# Job Cannon — Frontend Polish Pass · Locked Design System

This file is the canonical record of design decisions locked during the frontend polish pass started 2026-05-26. Once a value is here, don't re-litigate it in code or future sessions. Update this file (with a dated entry) if a decision is intentionally revised.

The pre-polish source-of-truth handoff lives in chat as the v1 spec the user pasted. See also `CHANGELOG.md` for session history.

---

## Aesthetic direction

**Editorial minimalism.** Visual reference: Vercel.com circa 2024, Linear's marketing, original Stripe. Heavy whitespace, sharp typographic hierarchy, restraint as the signature.

## Palette — strict, no additions

| Token              | Light     | Dark      | Used for                                                        |
| ------------------ | --------- | --------- | --------------------------------------------------------------- |
| `background`       | `#FFFFFF` | `#0A0A0A` | Page surface                                                    |
| `foreground`       | `#0A0A0A` | `#FAFAFA` | Body text + filled-button labels                                |
| `border`           | `#E5E5E5` | `#262626` | All borders, hairlines, focus rings (use offset)                |
| `muted-foreground` | `#737373` | `#A3A3A3` | Secondary text (metadata, timestamps, helper copy)              |
| `destructive`      | `#DC2626` | `#DC2626` | Errors, trial-ending warnings, destructive actions — only these |

**Banned:** purple, blue, green, anything saturated other than the single destructive red. No gradients anywhere. Status conveyed through **typography and position**, not color.

## Typography — max 5 sizes total

- **Display + headings:** Newsreader (Google Fonts, variable). Loaded via `next/font/google` as `--font-display`. Used for hero, page titles (h1), section titles (h2), and the score number in job cards.
- **Body + UI:** Geist Sans. Loaded via `next/font/google` as `--font-sans` (also the html default).
- **Mono:** Geist Mono. Loaded via `next/font/google` as `--font-mono`. Used for code, secret strings, Stripe customer IDs in billing.
- **Banned:** Inter, Roboto, system stacks for primary type.

The type ramp that actually shipped (honest revision — the original "max 5" lock was aspirational; the work needs ~7 to do hierarchy properly):

| Size token      | px / rem      | Tailwind                  | Where it's used                                                          |
| --------------- | ------------- | ------------------------- | ------------------------------------------------------------------------ |
| `display-xl`    | 56 / 3.5rem   | `text-[3.5rem] leading-[1.05]` | Hero on `/` only, error/404 h1s on sm+. Newsreader.                 |
| `display`       | 48 / 3rem     | `text-5xl` / `text-[3rem]`| Page titles (h1) on smaller pages, dashboard empty-state countdown. Newsreader. |
| `display-section` | 36 / 2.25rem| `text-4xl`                | Dashboard / billing / history / resume h1, pricing h1. Newsreader.   |
| `display-sub`   | 30 / 1.875rem | `text-3xl`                | Landing section h2 ("How it works"), MatchClient results count, billing plan name. Newsreader. |
| `subhead`       | 24 / 1.5rem   | `text-2xl`                | Pricing card heading, ProfileSummary name, AuthEditorial header. Newsreader. |
| `subhead-sm`    | 20 / 1.25rem  | `text-xl`                 | Job card company name, MatchClient processing title. Newsreader.     |
| `body`          | 15 / 0.9375rem| `text-[0.9375rem]`        | Default body, button labels, job titles, dashboard meta. Geist Sans. |
| `caption`       | 13 / 0.8125rem| `text-[0.8125rem]`        | Muted metadata, helper text, badge content. Geist Sans.              |
| `eyebrow`       | 11 / 0.6875rem| `text-[0.6875rem] uppercase tracking-wider` | Section labels, "step N of N", status block field labels. Geist Sans. |

Letter-spacing: `tracking-tight` on Newsreader display sizes; default on body; `tracking-wide` on caption when it's an uppercase eyebrow.

## Spacing & components

- **4px base unit** (Tailwind default). Generous vertical rhythm — most sections `py-24` (96px) or `py-32` (128px).
- **Border radius:** `--radius` = `4px`. Maximum. Applied consistently. No 12px buttons, no 24px cards.
- **No shadows** except for modals/dropdowns/popovers. **Borders do the work.**
- **Buttons:**
  - `primary` — filled (bg-foreground text-background, border-foreground)
  - `secondary` — outlined (bg-transparent text-foreground border-border, hover bg-foreground/[0.04])
  - `tertiary` — ghost / text-only link (no border, hover text-foreground from text-muted-foreground)
- **Cards:** no background, no shadow. Hairline borders only. Lists of cards: `border-t` between rows.
- **Focus ring:** 2px solid `foreground`, 2px `outline-offset`. Always visible on `:focus-visible`.

## Motion

- Transitions ≤200ms, easing `cubic-bezier(0.4, 0, 0.2, 1)` (Tailwind's default).
- Respect `prefers-reduced-motion` — disable all transitions when set.
- No scroll-triggered animations. No springs. No entrance effects. No parallax.

## Icons

Reserved for three uses only:
1. External links: `↗` (text glyph, not an icon font)
2. Expand / collapse: `↓` and `↑` (text glyphs)
3. User avatar (Clerk's `<UserButton />`)

No `lucide-react` icons in UI copy. No emoji.

## Subscription state visibility

Single source of truth — read from one of:
- `getSubscriptionView(userId)` — server, in `lib/subscription.ts`. Used by layouts + server components.
- `useSubscription()` — client, in `hooks/use-subscription.ts`. Used by client islands. Hydrates from a `<SubscriptionContext>` that the root layout fills server-side.

Shape:

```ts
type SubscriptionView =
  | { state: 'loading' }
  | { state: 'free' }
  | { state: 'trialing'; daysRemaining: number; endsAt: Date }
  | { state: 'active'; renewsAt: Date; interval: 'month' | 'year' }
  | { state: 'past_due'; endsAt: Date }
  | { state: 'canceled'; endsAt: Date };
```

Three components consume it:

- `<SubscriptionBadge />` — compact pill in `<AppHeader />`. Reads from `useSubscription()`.
- `<SubscriptionStatusBlock />` — full block on `/dashboard/billing`.
- `<AppHeader />` — global nav: logo · `How it works` · `Pricing` · badge · Clerk `<UserButton />` (or Sign in / Get started when signed out).

Badge copy:
- `Trial · 4d`
- `Active`
- `Past due` (red)
- `Canceled · ends May 30`
- `Free` (signed in but no subscription record)
- (no badge when signed out)

## Light/dark mode

- `next-themes` with `attribute="class"`, `defaultTheme="system"`, no manual toggle in v1.
- Every token defined in both `:root` and `.dark`.
- Test every page in both via OS preference.

## Quality bar

- TypeScript strict. No `any`.
- Lighthouse a11y ≥ 95 on `/` and `/dashboard`.
- Every interactive element has a visible `:focus-visible` ring + an explicit non-opacity hover state (color shift, not blur or fade).
- Icon-only buttons get explicit `aria-label`s.

## What this pass deliberately does NOT do

- No new component library; existing shadcn + Tailwind + base-ui.
- No Tailwind animation plugins; CSS-only for any custom motion.
- No manual dark toggle.
- No `/api/match` logic changes.
- No new backend code.
- No scroll-triggered effects.

---

## Session log — pointers to CHANGELOG entries

Detailed per-session notes live in `CHANGELOG.md`. This section is the chronological pointer to design-decision changes (if any) so the latest locked state stays scannable.

- **2026-05-26:** Initial lock of palette, typography, components, subscription-state spec. CSS variables migrated from shadcn OKLCH defaults to hex per palette table.
- **2026-05-26 (later):** Type ramp expanded from 5 → 9 sizes in HANDOFF after `design:design-critique` flagged the budget breach. The 5-size lock was visually impossible without flattening hierarchy. New ramp documented above is the actual shipped system. Legacy shadcn `components/ui/*` primitives (Card, Button, Input, Progress, Skeleton, Badge) deleted as dead code — every page now uses raw Tailwind classes that hew directly to the locked tokens.
