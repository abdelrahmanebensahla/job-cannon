'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error boundary caught:', error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-start justify-center px-6 py-24">
      <p className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">500</p>
      <h1 className="mt-4 font-display text-5xl tracking-tight">Something went wrong.</h1>
      <p className="mt-4 max-w-prose text-[0.9375rem] text-muted-foreground">
        The page hit an unexpected error. We&apos;ve logged it on our side.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-[0.75rem] text-muted-foreground">
          Reference: {error.digest}
        </p>
      )}
      <div className="mt-8 flex flex-wrap items-center gap-5 text-[0.875rem]">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-10 items-center border border-foreground bg-foreground px-5 text-[0.875rem] font-medium text-background transition-colors hover:bg-foreground/90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Go home →
        </Link>
      </div>
    </main>
  );
}
