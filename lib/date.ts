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
 * Parse the date input into a Date. Accepts:
 *   - A Date instance (returned as-is).
 *   - A YYYY-MM-DD date-only string — anchored at 12:00 UTC so the ET
 *     formatter never rolls back to the previous day for timezones west
 *     of UTC.
 *   - A full ISO 8601 string (e.g. from new Date().toISOString()) — parsed
 *     directly; SubscriptionView fields like `endsAt` and `renewsAt` come
 *     through this path. Without the length check, the legacy
 *     `input + 'T12:00:00Z'` would corrupt an ISO string and throw
 *     "Invalid time value" at format time.
 */
function toDate(input: string | Date): Date {
  if (typeof input !== 'string') return input;
  return new Date(input.length === 10 ? input + 'T12:00:00Z' : input);
}

/**
 * Pretty-prints a YYYY-MM-DD date string, ISO string, or Date as e.g. "May 24".
 */
export function formatShortDate(input: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
  }).format(toDate(input));
}

export function formatLongDate(input: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  }).format(toDate(input));
}
