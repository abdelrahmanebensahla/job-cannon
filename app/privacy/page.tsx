import Link from 'next/link';

export const metadata = {
  title: 'Privacy — Job Cannon',
};

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-2xl tracking-tight mt-12 mb-4">{children}</h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.9375rem] leading-relaxed text-foreground/85 mt-4">{children}</p>
  );
}

function Bullet({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="mt-4 grid gap-1 sm:grid-cols-[10rem_1fr]">
      <span className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-[0.9375rem] leading-relaxed text-foreground/85">{children}</span>
    </li>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
        Last updated · 2026-05-22
      </p>
      <h1 className="mt-3 font-display text-5xl tracking-tight">Privacy.</h1>
      <P>
        Job Cannon (&quot;we&quot;) helps you match your resume against startup job postings. This
        page describes what we collect, what we do with it, and what we don&apos;t.
      </P>

      <H2>What we collect</H2>
      <ul className="border-b border-border">
        <Bullet label="Resume content">
          When you upload a resume, we send the PDF to Anthropic&apos;s Claude API to extract a
          structured profile. The PDF itself is not retained; the extracted profile (name, skills,
          target roles, summary) is stored in our database so we can run daily matches against it.
        </Bullet>
        <Bullet label="Account info">Email address and a Clerk-issued user id.</Bullet>
        <Bullet label="Billing info">
          Handled entirely by Stripe — we never see your card details. We store your Stripe
          customer id and subscription status.
        </Bullet>
        <Bullet label="Match history">
          The ranked job lists we generate for you, kept for 30 days so you can review past digests.
        </Bullet>
      </ul>

      <H2>What we don&apos;t do</H2>
      <ul className="border-b border-border">
        <Bullet label="Resume">
          We don&apos;t sell or share your resume with employers, recruiters, or anyone else.
        </Bullet>
        <Bullet label="Training">We don&apos;t use your resume to train models.</Bullet>
        <Bullet label="Ads">We don&apos;t run ads.</Bullet>
      </ul>

      <H2>Deletion</H2>
      <P>
        Cancel your subscription via the billing portal and you can request full account deletion
        (resume + match history + account row) by opening an issue on the GitHub repo below.
        Account deletion is permanent and irreversible.
      </P>

      <H2>Contact</H2>
      <P>
        Questions? Open an issue at{' '}
        <Link
          href="https://github.com/abdelrahmanebensahla/job-cannon"
          className="text-foreground underline underline-offset-2"
        >
          github.com/abdelrahmanebensahla/job-cannon ↗
        </Link>
        .
      </P>
    </main>
  );
}
