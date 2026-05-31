'use client';

import { useEffect, useState } from 'react';

import { useIsHydrated } from '@/lib/use-hydrated';

/**
 * Live countdown to the next 13:00 UTC weekday cron run, rendered in big
 * Newsreader display sizing per the locked design system. We accept the
 * ~1h drift across DST changes without pulling in a tz library.
 */
function nextCronUtc(now: Date): Date {
  const next = new Date(now);
  next.setUTCHours(13, 0, 0, 0);
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

function format(ms: number): string {
  if (ms <= 0) return 'any moment now';
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / (24 * 60));
  const hours = Math.floor((totalMin % (24 * 60)) / 60);
  const mins = totalMin % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  parts.push(`${hours}h`);
  parts.push(`${mins}m`);
  return parts.join(' ');
}

export function NextDigestCountdown() {
  const hydrated = useIsHydrated();
  // Lazy init to the client clock; only read once `hydrated`, so the value
  // never reaches the server render and can't cause a hydration mismatch. The
  // interval keeps it fresh — setState lives in the timer callback, not the
  // effect body, so it stays clear of react-hooks/set-state-in-effect.
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (!hydrated) {
    return <span aria-hidden>—</span>;
  }

  const target = nextCronUtc(now);
  return <span>{format(target.getTime() - now.getTime())}</span>;
}
