import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-start justify-center px-6 py-24">
      <p className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">404</p>
      <h1 className="mt-4 font-display text-5xl tracking-tight">Page not found.</h1>
      <p className="mt-4 max-w-prose text-[0.9375rem] text-muted-foreground">
        That URL doesn&apos;t map to anything here.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex text-[0.875rem] text-foreground underline underline-offset-4 hover:text-foreground/80"
      >
        Go home →
      </Link>
    </main>
  );
}
