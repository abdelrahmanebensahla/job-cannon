import Link from 'next/link';
import { Show, UserButton } from '@clerk/nextjs';

import { SubscriptionBadge } from './SubscriptionBadge';

/**
 * Global nav. Logo · How it works · Pricing · subscription badge ·
 * Clerk user menu (signed in) OR Sign in + Get started (signed out).
 *
 * Border-bottom hairline; no background fill, no shadow.
 */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <nav className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="font-display text-base tracking-tight text-foreground"
        >
          Job Cannon
        </Link>

        <div className="flex items-center gap-5">
          <Link
            href="/#how-it-works"
            className="hidden text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            How it works
          </Link>
          <Link
            href="/pricing"
            className="hidden text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            Pricing
          </Link>

          <Show when="signed-out">
            <Link
              href="/sign-in"
              className="text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex h-8 items-center border border-foreground bg-foreground px-3 text-[0.8125rem] font-medium text-background transition-colors hover:bg-foreground/90"
            >
              Get started
            </Link>
          </Show>

          <Show when="signed-in">
            <SubscriptionBadge />
            <Link
              href="/dashboard"
              className="hidden text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              Dashboard
            </Link>
            <UserButton />
          </Show>
        </div>
      </nav>
    </header>
  );
}
