import { createHash } from 'node:crypto';
import { lt, sql } from 'drizzle-orm';

import { db } from '@/db';
import { rateLimits } from '@/db/schema';
import { todayInET } from '@/lib/date';

/**
 * Spend guard for the unauthenticated free preview.
 *
 * `/api/match` costs real money on every call — one extraction plus a ranking
 * prompt carrying ~50 job descriptions — and it takes no auth by design. Two
 * fixed daily windows bound the damage:
 *
 *   - per-IP, so one script can't run the endpoint in a loop
 *   - global, as a circuit breaker on total daily spend
 *
 * Both counters live in one tiny table and are incremented by a single upsert,
 * because Neon's HTTP driver has no multi-statement transactions. The window
 * is encoded in the key (`...:<ET date>`), so there is no reset path to get
 * wrong: tomorrow is simply a different row.
 *
 * IP addresses are never stored. The key holds a salted SHA-256 truncated to
 * 32 hex chars, which is enough to count against and useless to work back from.
 */

export const DEFAULT_LIMIT_PER_IP = 5;
export const DEFAULT_LIMIT_GLOBAL = 100;

export type RateLimitDecision =
  | { allowed: true; ipCount: number; globalCount: number }
  | { allowed: false; reason: 'per_ip' | 'global'; ipCount: number; globalCount: number }
  // The limiter is a guard, not the product. If the counter write fails we let
  // the request through rather than taking the whole preview down with the DB.
  | { allowed: true; degraded: true };

function limitFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Best-effort client IP. On Vercel, `x-vercel-forwarded-for` is set by the
 * platform and can't be spoofed by the caller; the other two are fallbacks for
 * local dev and self-hosting, where the first entry of `x-forwarded-for` is
 * the origin client.
 */
export function clientIpFrom(headers: Headers): string | null {
  const vercel = headers.get('x-vercel-forwarded-for');
  if (vercel) return vercel.split(',')[0]!.trim();
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return headers.get('x-real-ip')?.trim() || null;
}

function salt(): string {
  const explicit = process.env.RATE_LIMIT_SALT;
  if (explicit) return explicit;
  // CRON_SECRET is already a deployment-stable secret. Reusing it as a hash
  // salt keeps the limiter working with no extra configuration; it's never
  // exposed, since only the digest is stored.
  const derived = process.env.CRON_SECRET;
  if (derived) return derived;
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      'rate-limit: neither RATE_LIMIT_SALT nor CRON_SECRET is set — IP hashes are unsalted.',
    );
  }
  return 'job-cannon-unsalted';
}

export function hashIp(ip: string): string {
  return createHash('sha256').update(`${salt()}:${ip}`).digest('hex').slice(0, 32);
}

/**
 * Increments both counters and reports whether this request may proceed.
 * Call it *after* cheap input validation and *before* any Claude call — a
 * malformed upload shouldn't burn someone's quota, but a valid one must be
 * counted whether or not the ranking later succeeds.
 */
export async function consumeMatchQuota(headers: Headers): Promise<RateLimitDecision> {
  const perIp = limitFromEnv('MATCH_DAILY_LIMIT_PER_IP', DEFAULT_LIMIT_PER_IP);
  const global = limitFromEnv('MATCH_DAILY_LIMIT_GLOBAL', DEFAULT_LIMIT_GLOBAL);

  const day = todayInET();
  const ip = clientIpFrom(headers);
  // No resolvable IP (unusual — direct origin hit) still counts globally; it
  // just shares one bucket rather than escaping the limiter entirely.
  const ipKey = `match:ip:${ip ? hashIp(ip) : 'unknown'}:${day}`;
  const globalKey = `match:global:${day}`;

  // Keep rows a day past their window so the sweep has something to find and
  // a clock skew near midnight can't delete a live counter.
  const expiresAt = new Date(Date.now() + 2 * 86_400_000);

  try {
    const rows = await db
      .insert(rateLimits)
      .values([
        { key: ipKey, count: 1, expiresAt },
        { key: globalKey, count: 1, expiresAt },
      ])
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: { count: sql`${rateLimits.count} + 1` },
      })
      .returning({ key: rateLimits.key, count: rateLimits.count });

    const ipCount = rows.find(r => r.key === ipKey)?.count ?? 0;
    const globalCount = rows.find(r => r.key === globalKey)?.count ?? 0;

    if (globalCount > global) return { allowed: false, reason: 'global', ipCount, globalCount };
    if (ipCount > perIp) return { allowed: false, reason: 'per_ip', ipCount, globalCount };
    return { allowed: true, ipCount, globalCount };
  } catch (e) {
    console.error('rate-limit: counter write failed, allowing request:', e);
    return { allowed: true, degraded: true };
  }
}

/** Sweeps counters whose window has long passed. Called from the daily cron. */
export async function pruneExpiredRateLimits(now: Date = new Date()): Promise<number> {
  const deleted = await db
    .delete(rateLimits)
    .where(lt(rateLimits.expiresAt, now))
    .returning({ key: rateLimits.key });
  return deleted.length;
}
