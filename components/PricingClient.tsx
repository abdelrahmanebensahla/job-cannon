'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

import { Button } from '@/components/ui/button';

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
  no_session_url: 'Stripe did not return a checkout URL.',
  stripe_checkout_failed: 'Stripe rejected the request. Please retry.',
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
    <div className="space-y-2">
      <Button size="lg" className="w-full" disabled={loading || !isLoaded} onClick={onClick}>
        {loading ? 'Redirecting to Stripe…' : label}
      </Button>
      {error && (
        <p className="text-sm text-rose-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
