'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';

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
      <Button size="lg" disabled={loading} onClick={onClick}>
        {loading ? 'Opening portal…' : 'Manage billing in Stripe'}
      </Button>
      {error && (
        <p className="text-sm text-rose-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
