'use client';

import { useEffect, useState } from 'react';

/**
 * Renders a human-readable countdown to the next cron run.
 * Cron: 13:00 UTC weekdays. That's 8am ET in DST, 9am EST in winter.
 *
 * We do the math in UTC and accept the +/- 1h drift across DST changes —
 * not worth wiring a tz library for v1.
 */
function nextCronUtc(now: Date): Date {
  const next = new Date(now);
  next.setUTCHours(13, 0, 0, 0);
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  // Skip Sat (6) and Sun (0).
  while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

function formatGap(ms: number): string {
  if (ms <= 0) return 'any moment now';
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / (24 * 60));
  const hours = Math.floor((totalMin % (24 * 60)) / 60);
  const mins = totalMin % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  parts.push(`${mins}m`);
  return parts.join(' ');
}

export function NextDigestCountdown() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (!now) return <span className="opacity-60">…</span>;
  const target = nextCronUtc(now);
  return <span>{formatGap(target.getTime() - now.getTime())}</span>;
}
