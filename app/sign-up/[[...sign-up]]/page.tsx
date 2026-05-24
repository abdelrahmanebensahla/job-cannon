import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      {/* New users always land on /onboarding first — resume upload is the
          gate before billing. forceRedirectUrl overrides any redirect_url
          query param so even users who came from /pricing still upload first. */}
      <SignUp forceRedirectUrl="/onboarding" />
    </main>
  );
}
