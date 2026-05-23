export const metadata = {
  title: 'Privacy policy — Job Cannon',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <article className="prose prose-sm dark:prose-invert max-w-none">
        <h1>Privacy policy</h1>
        <p>
          <em>Last updated: 2026-05-22.</em>
        </p>
        <p>
          Job Cannon (&quot;we&quot;) helps you match your resume against startup job postings. This page describes
          what we collect, what we do with it, and what we don&apos;t.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Resume content.</strong> When you upload a resume, we send the PDF to Anthropic&apos;s
            Claude API to extract a structured profile. The PDF itself is not retained; the extracted
            profile (name, skills, target roles, summary) is stored in our database so we can run
            daily matches against it.
          </li>
          <li>
            <strong>Account info.</strong> Email address and a Clerk-issued user id.
          </li>
          <li>
            <strong>Billing info.</strong> Handled entirely by Stripe — we never see your card details.
            We store your Stripe customer id and subscription status.
          </li>
          <li>
            <strong>Match history.</strong> The ranked job lists we generate for you, kept for 30 days
            so you can review past digests.
          </li>
        </ul>

        <h2>What we don&apos;t do</h2>
        <ul>
          <li>We don&apos;t sell or share your resume with employers, recruiters, or anyone else.</li>
          <li>We don&apos;t use your resume to train models.</li>
          <li>We don&apos;t run ads.</li>
        </ul>

        <h2>Deletion</h2>
        <p>
          Cancel your subscription via the billing portal and you can request full account deletion
          (resume + match history + account row) by emailing the address in our GitHub repo. Account
          deletion is permanent and irreversible.
        </p>

        <h2>Contact</h2>
        <p>
          Questions? Open an issue at{' '}
          <a href="https://github.com/abdelrahmanebensahla/job-cannon">
            github.com/abdelrahmanebensahla/job-cannon
          </a>
          .
        </p>
      </article>
    </main>
  );
}
