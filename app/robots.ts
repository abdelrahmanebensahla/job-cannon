import type { MetadataRoute } from 'next';

import { appUrl } from '@/lib/app-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Nothing behind auth is useful to a crawler, and /api costs money to
        // hit. /dev is a component gallery that 404s in production anyway.
        disallow: ['/api/', '/dashboard/', '/onboarding', '/dev/'],
      },
    ],
    sitemap: appUrl('/sitemap.xml'),
  };
}
