/**
 * "Today" in America/New_York as a YYYY-MM-DD string. The daily digest is
 * keyed by date (no time), and the cron runs at 13:00 UTC (= 8am ET DST /
 * 9am EST), so the user-facing "today" is the ET date.
 */
export function todayInET(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Pretty-prints a YYYY-MM-DD date string (or a Date) as e.g. "May 24".
 */
export function formatShortDate(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input + 'T12:00:00Z') : input;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
  }).format(d);
}

export function formatLongDate(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input + 'T12:00:00Z') : input;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  }).format(d);
}
