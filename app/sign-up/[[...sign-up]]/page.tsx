import { SignUp } from '@clerk/nextjs';

import { authAppearance } from '@/components/AuthAppearance';
import { AuthEditorial } from '@/components/AuthEditorial';

export default function SignUpPage() {
  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 lg:grid-cols-[1fr_1fr]">
      <div className="flex items-center justify-center px-6 py-16 sm:py-24">
        <div className="w-full max-w-sm">
          <SignUp forceRedirectUrl="/onboarding" appearance={authAppearance} />
        </div>
      </div>
      <AuthEditorial />
    </main>
  );
}
