import Link from 'next/link';

import { AuthForm } from '@/components/AuthForm';

export default function SignInPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16 sm:py-24">
      <p className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
        Sign in
      </p>
      <h1 className="mt-3 font-display text-3xl tracking-tight">
        Welcome back.
      </h1>
      <p className="mt-2 text-[0.9375rem] text-muted-foreground">
        Sign in to access today&apos;s digest.
      </p>

      <div className="mt-10">
        <AuthForm mode="sign-in" />
      </div>

      <p className="mt-8 text-[0.8125rem] text-muted-foreground">
        New here?{' '}
        <Link href="/sign-up" className="text-foreground underline underline-offset-2">
          Create an account →
        </Link>
      </p>
    </main>
  );
}
