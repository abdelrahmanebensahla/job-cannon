import Link from 'next/link';

import { DIGEST_RETENTION_DAYS } from '@/lib/date';

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
        Last updated · 2026-08-27
      </p>
      <h1 className="mt-3 font-display text-5xl tracking-tight">Privacy.</h1>
      <P>
        Job Cannon (&quot;we&quot;) helps you match your resume against startup job postings. This
        page describes what we collect, what we do with it, and what we don&apos;t.
      </P>

      <H2>What we collect</H2>
      <ul className="border-b border-border">
        <Bullet label="Resume file">
          When you upload a resume, we send the PDF to Anthropic&apos;s Claude API to extract a
          structured profile. If you have an account, we also store that PDF so the resume-review
          feature can read the full document later. We keep the file for your{' '}
          <strong className="font-medium text-foreground">current</strong> resume only — upload a
          new one and the previous file is erased immediately.
        </Bullet>
        <Bullet label="Resume profile">
          The structured profile Claude extracts (name, skills, target roles, seniority, locations,
          summary), stored so we can run daily matches against it.
        </Bullet>
        <Bullet label="Free preview">
          The preview on the home page requires no account. Nothing from it is stored — the PDF is
          held in memory for the length of the request and discarded. We keep a per-visitor count of
          previews run, derived from a one-way hash of your IP address, purely to stop automated
          abuse; the address itself is never written down.
        </Bullet>
        <Bullet label="Account info">Email address and a Clerk-issued user id.</Bullet>
        <Bullet label="Billing info">
          Handled entirely by Stripe — we never see your card details. We store your Stripe
          customer id and subscription status.
        </Bullet>
        <Bullet label="Match history">
          The ranked job lists we generate for you, automatically deleted after {DIGEST_RETENTION_DAYS}{' '}
          days.
        </Bullet>
        <Bullet label="Resume reviews">
          If you run a resume review, the written critique is stored so it&apos;s still there when
          you come back. It stays until you delete your account.
        </Bullet>
      </ul>

      <H2>What we don&apos;t do</H2>
      <ul className="border-b border-border">
        <Bullet label="Resume">
          We don&apos;t sell or share your resume with employers, recruiters, or anyone else.
        </Bullet>
        <Bullet label="Training">We don&apos;t use your resume to train models.</Bullet>
        <Bullet label="Ads">We don&apos;t run ads.</Bullet>
        <Bullet label="Tracking">
          No advertising or cross-site tracking cookies. We use Vercel Analytics, which is
          cookie-less and doesn&apos;t build a profile of you.
        </Bullet>
      </ul>

      <H2>Retention</H2>
      <P>
        Match history is deleted automatically {DIGEST_RETENTION_DAYS} days after it&apos;s
        generated. The stored PDF of a resume is erased as soon as you replace it. Everything else —
        your account row, your current resume and its profile, your subscription record, and any
        resume reviews — is kept for as long as your account exists.
      </P>

      <H2>Deletion</H2>
      <P>
        Cancel your subscription via the billing portal and you can request full account deletion
        (resume + match history + reviews + account row) by opening an issue on the GitHub repo
        below. Deleting your account through Clerk removes all of it too: every table that
        references your user id cascades on delete. Account deletion is permanent and irreversible.
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
