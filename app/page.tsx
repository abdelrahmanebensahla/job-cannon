import { MatchClient } from '@/components/MatchClient';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-10 sm:px-6 sm:py-16">
      <header className="mb-10 sm:mb-14">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Job Cannon</h1>
        <p className="mt-3 max-w-xl text-base text-muted-foreground sm:text-lg">
          Drop a resume PDF. Claude extracts your profile, scans thousands of fresh job postings,
          and returns the 20 best fits with reasoning for each one.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Powered by Claude · Sources: Greenhouse, Lever, RemoteOK · No accounts, no storage.
        </p>
      </header>

      <section aria-label="Match flow" className="flex-1">
        <MatchClient />
      </section>

      <footer className="mt-16 text-xs text-muted-foreground">
        Built with Next.js, Tailwind, shadcn/ui, and the Anthropic SDK.
      </footer>
    </main>
  );
}
