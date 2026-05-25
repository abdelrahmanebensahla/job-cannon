import Link from 'next/link';
import { Show, UserButton } from '@clerk/nextjs';

import { buttonVariants } from '@/components/ui/button';

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <nav className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Job Cannon
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/#how-it-works"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            How it works
          </Link>
          <Link
            href="/pricing"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            Pricing
          </Link>

          <Show when="signed-out">
            <Link
              href="/sign-in"
              className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              Sign in
            </Link>
            <Link href="/sign-up" className={buttonVariants({ size: 'sm' })}>
              Get started
            </Link>
          </Show>

          <Show when="signed-in">
            <Link href="/dashboard" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
              Dashboard
            </Link>
            <UserButton />
          </Show>
        </div>
      </nav>
    </header>
  );
}
