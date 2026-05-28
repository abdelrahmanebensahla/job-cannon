'use client';

import { SignIn, SignUp } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

/**
 * Client wrapper around Clerk's <SignIn /> and <SignUp />. Two reasons it
 * needs to be a client component:
 *   1. The Clerk widget itself only renders client-side anyway, so wrapping
 *      it loses nothing.
 *   2. We swap @clerk/themes baseTheme (dark | undefined-for-light) based
 *      on the resolved next-themes value. Without this the widget hard-
 *      codes white background + black inputs even when the app renders
 *      on a #0A0A0A page.
 *
 * Element-level class overrides still come through so brand-button styling
 * (palette black) survives both modes.
 */

type Mode = 'sign-in' | 'sign-up';
type Props = {
  mode: Mode;
};

const SHARED_APPEARANCE = {
  variables: {
    fontFamily: 'var(--font-geist-sans)',
    borderRadius: '4px',
  },
  elements: {
    rootBox: 'w-full',
    cardBox: 'shadow-none border-0',
    card: 'shadow-none border-0 bg-transparent px-0',
    header: 'pb-2',
    headerTitle:
      'font-[var(--font-newsreader)] tracking-tight text-3xl leading-tight',
    headerSubtitle: 'text-[0.9375rem]',
    socialButtonsBlockButton:
      'rounded-[4px] text-[0.875rem] normal-case shadow-none border',
    socialButtonsBlockButtonText: 'text-[0.875rem] font-medium',
    formButtonPrimary:
      'rounded-[4px] text-[0.875rem] font-medium normal-case shadow-none h-10',
    formFieldInput:
      'rounded-[4px] text-[0.9375rem] h-10 border focus:ring-2 focus:ring-offset-2',
    formFieldLabel: 'text-[0.8125rem] font-medium',
    footerActionLink: 'underline underline-offset-2',
    dividerLine: 'h-px',
    dividerText: 'text-[0.75rem] uppercase tracking-wide',
    identityPreviewText: 'text-[0.9375rem]',
    identityPreviewEditButton: 'underline underline-offset-2',
  },
} as const;

export function AuthForm({ mode }: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes only knows the resolved theme after first client render. To
  // avoid the widget mounting with the wrong baseTheme and flashing, we
  // render an invisible placeholder of equivalent height until mounted.
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div aria-hidden className="h-[420px]" />;
  }

  const isDark = resolvedTheme === 'dark';
  const appearance = {
    ...SHARED_APPEARANCE,
    baseTheme: isDark ? dark : undefined,
  };

  if (mode === 'sign-in') {
    return <SignIn fallbackRedirectUrl="/dashboard" appearance={appearance} />;
  }
  return <SignUp forceRedirectUrl="/onboarding" appearance={appearance} />;
}
