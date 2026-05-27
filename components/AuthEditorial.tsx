/**
 * Subtle editorial column for /sign-in and /sign-up. One stat block —
 * not a fake testimonial, not a screenshot loaded from disk. Aligned
 * to typography hierarchy locked in HANDOFF.md.
 */
export function AuthEditorial() {
  return (
    <aside className="hidden flex-col justify-between border-l border-border px-10 py-12 lg:flex">
      <div>
        <p className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
          What you get
        </p>
        <p className="mt-6 font-display text-3xl leading-tight tracking-tight">
          Ten startup roles, ranked for you, in your inbox every weekday at 8am ET.
        </p>
      </div>

      <dl className="mt-12 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-border pt-8 text-[0.9375rem]">
        <div>
          <dt className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
            Source pool
          </dt>
          <dd className="mt-1 font-display text-2xl tracking-tight">~5,000 roles</dd>
          <dd className="mt-1 text-[0.8125rem] text-muted-foreground">
            Greenhouse · Lever · RemoteOK, refreshed nightly
          </dd>
        </div>
        <div>
          <dt className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
            Ranking
          </dt>
          <dd className="mt-1 font-display text-2xl tracking-tight">Claude</dd>
          <dd className="mt-1 text-[0.8125rem] text-muted-foreground">
            One paragraph of reasoning per match
          </dd>
        </div>
        <div>
          <dt className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
            Pricing
          </dt>
          <dd className="mt-1 font-display text-2xl tracking-tight">$8 / month</dd>
          <dd className="mt-1 text-[0.8125rem] text-muted-foreground">
            7-day free trial · Cancel anytime
          </dd>
        </div>
        <div>
          <dt className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
            Setup
          </dt>
          <dd className="mt-1 font-display text-2xl tracking-tight">Under a minute</dd>
          <dd className="mt-1 text-[0.8125rem] text-muted-foreground">
            Drop a resume, that&apos;s it
          </dd>
        </div>
      </dl>
    </aside>
  );
}
