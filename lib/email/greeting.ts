/**
 * Best-effort "first name" from an email address — used only for the email
 * greeting, never for anything authoritative. Storage-free: no extra DB
 * column, no Clerk roundtrip in the cron loop.
 *
 * Heuristic: take the local part, strip trailing digits, split on dots/
 * underscores/plus signs, title-case the first non-empty token.
 */
export function firstNameFromEmail(email: string, fallback = 'there'): string {
  if (!email || !email.includes('@')) return fallback;
  const local = email.split('@')[0]?.trim();
  if (!local) return fallback;
  const cleaned = local.replace(/\d+$/g, '');
  const first = cleaned
    .split(/[._+-]/)
    .map(s => s.trim())
    .filter(Boolean)[0];
  if (!first) return fallback;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}
