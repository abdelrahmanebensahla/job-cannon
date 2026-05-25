/**
 * Resolves the absolute base URL of this deployment. Used for Stripe
 * success/cancel/return URLs and anywhere else that needs a fully-qualified
 * link (e.g. transactional emails).
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_APP_URL (explicit override — REQUIRED in production
 *      when running behind a custom domain like jobcannon.app, because
 *      VERCEL_PROJECT_PRODUCTION_URL stays as the .vercel.app URL)
 *   2. VERCEL_PROJECT_PRODUCTION_URL (e.g. <project>.vercel.app on prod)
 *   3. VERCEL_URL (e.g. <project>-abc123.vercel.app on previews)
 *   4. http://localhost:3000 (dev fallback)
 */
export function appUrl(path: string = ''): string {
  const base = resolveBase();
  const trimmed = base.replace(/\/$/, '');
  const suffix = path.startsWith('/') || path === '' ? path : `/${path}`;
  return `${trimmed}${suffix}`;
}

function resolveBase(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}
