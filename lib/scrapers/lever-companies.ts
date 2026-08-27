// Lever public board slugs. Each appears at jobs.lever.co/{slug}.
//
// Audited 2026-08-27: 14 of the original 15 slugs were dead. Lever has lost
// most of this market — the companies that were here went to Greenhouse
// (Airtable, Coursera, Klaviyo, Mixpanel, Pendo, Attentive, Twitch), to Ashby,
// or to in-house systems (Netflix, Shopify, Yelp). The scraper stays because
// it costs one HTTP request per slug and degrades to zero jobs on its own,
// but don't expect this list to grow.
export const LEVER_COMPANIES: { slug: string; name: string }[] = [
  { slug: 'palantir', name: 'Palantir' },
];
