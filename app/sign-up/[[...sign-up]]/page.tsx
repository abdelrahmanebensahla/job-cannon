import Link from 'next/link';

import { AuthForm } from '@/components/AuthForm';

export default function SignUpPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16 sm:py-24">
      <p className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
        Get started
      </p>
      <h1 className="mt-3 font-display text-3xl tracking-tight">
        Create your account.
      </h1>
      <p className="mt-2 text-[0.9375rem] text-muted-foreground">
        Then drop a resume and start your 7-day free trial. No card needed for the free preview.
      </p>

      <div className="mt-10">
        <AuthForm mode="sign-up" />
      </div>

      <p className="mt-8 text-[0.8125rem] text-muted-foreground">
        Already have an account?{' '}
        <Link href="/sign-in" className="text-foreground underline underline-offset-2">
          Sign in →
        </Link>
      </p>
    </main>
  );
}
