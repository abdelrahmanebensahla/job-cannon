'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

type Props = {
  priceKey: 'monthly' | 'yearly';
  label: string;
};

type CheckoutResponse = { ok: true; url: string } | { ok: false; error: string };

const ERROR_COPY: Record<string, string> = {
  unauthorized: 'Sign in first, then come back.',
  invalid_body: 'Bad request. Refresh and try again.',
  price_not_configured: 'Pricing not configured. Reach out to support.',
  user_not_provisioned: 'Your account is still being set up. Refresh and try again in a few seconds.',
  email_conflict: 'An older account is already using this email. Please contact support to reconcile.',
  no_session_url: 'Stripe did not return a checkout URL.',
  stripe_checkout_failed: 'Stripe rejected the request. Please retry.',
  already_subscribed: "You're already subscribed — opening your billing portal.",
};

export function CheckoutButton({ priceKey, label }: Props) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setError(null);
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push(`/sign-up?redirect_url=${encodeURIComponent('/pricing')}`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ priceId: priceKey }),
      });
      const data = (await res.json()) as CheckoutResponse;
      if (!res.ok || !data.ok) {
        const code = !data.ok ? data.error : 'unknown';
        // Already on a plan → send them to the Stripe Customer Portal instead.
        if (code === 'already_subscribed') {
          try {
            const portalRes = await fetch('/api/portal', { method: 'POST' });
            const portalData = (await portalRes.json()) as { ok: boolean; url?: string };
            if (portalRes.ok && portalData.ok && portalData.url) {
              window.location.href = portalData.url;
              return;
            }
          } catch {
            // fall through to the message below
          }
        }
        setError(ERROR_COPY[code] ?? `Something went wrong (${code}). Please try again.`);
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={loading || !isLoaded}
        onClick={onClick}
        className="inline-flex h-11 w-full items-center justify-center border border-foreground bg-foreground text-[0.875rem] font-medium text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Redirecting to Stripe…' : label}
      </button>
      {error && (
        <p className="text-[0.8125rem] text-[--color-destructive]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
