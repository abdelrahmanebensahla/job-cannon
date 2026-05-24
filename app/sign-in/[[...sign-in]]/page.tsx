import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      {/* Existing users default to /dashboard. fallbackRedirectUrl honors
          ?redirect_url= when present (e.g. middleware sent them here). */}
      <SignIn fallbackRedirectUrl="/dashboard" />
    </main>
  );
}
