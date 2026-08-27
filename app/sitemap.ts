import type { MetadataRoute } from 'next';

import { appUrl } from '@/lib/app-url';

// Only the public, indexable surface. Everything else is auth-gated.
const ROUTES = ['', '/pricing', '/privacy', '/terms'] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map(path => ({
    url: appUrl(path || '/'),
    lastModified,
    changeFrequency: path === '' ? ('daily' as const) : ('monthly' as const),
    priority: path === '' ? 1 : 0.6,
  }));
}
