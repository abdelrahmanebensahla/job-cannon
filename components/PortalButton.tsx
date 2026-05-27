'use client';

import { useState } from 'react';

type PortalResponse = { ok: true; url: string } | { ok: false; error: string };

export function PortalButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/portal', { method: 'POST' });
      const data = (await res.json()) as PortalResponse;
      if (!res.ok || !data.ok) {
        const code = !data.ok ? data.error : 'unknown';
        setError(`Could not open the billing portal (${code}). Please try again.`);
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
      <button
        type="button"
        disabled={loading}
        onClick={onClick}
        className="inline-flex h-10 items-center border border-foreground bg-foreground px-5 text-[0.8125rem] font-medium text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Opening portal…' : 'Manage in Stripe ↗'}
      </button>
      {error && (
        <p className="text-[0.8125rem] text-[--color-destructive]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
