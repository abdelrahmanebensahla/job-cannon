// Greenhouse public board slugs. Each appears at boards.greenhouse.io/{slug}.
//
// Audited 2026-08-27: 13 of the original 30 slugs had gone dead — mostly
// companies that migrated to Ashby (see ashby-companies.ts), a couple that
// simply renamed their board. Every slug below returned postings when the
// list was rebuilt. A company appears on exactly one ATS list; duplicating it
// across two would ingest the same role twice under different ids.
export const GREENHOUSE_COMPANIES: { slug: string; name: string }[] = [
  { slug: 'airbnb', name: 'Airbnb' },
  { slug: 'stripe', name: 'Stripe' },
  { slug: 'anthropic', name: 'Anthropic' },
  { slug: 'vercel', name: 'Vercel' },
  { slug: 'mercury', name: 'Mercury' },
  { slug: 'discord', name: 'Discord' },
  { slug: 'figma', name: 'Figma' },
  { slug: 'brex', name: 'Brex' },
  { slug: 'chime', name: 'Chime' },
  { slug: 'robinhood', name: 'Robinhood' },
  { slug: 'gusto', name: 'Gusto' },
  { slug: 'asana', name: 'Asana' },
  { slug: 'dropbox', name: 'Dropbox' },
  { slug: 'gitlab', name: 'GitLab' },
  { slug: 'datadog', name: 'Datadog' },
  { slug: 'databricks', name: 'Databricks' },
  { slug: 'scaleai', name: 'Scale AI' },

  // Renamed boards — the old `doordash` / `glean` slugs 404 now.
  { slug: 'doordashusa', name: 'DoorDash' },
  { slug: 'gleanwork', name: 'Glean' },

  // Recovered from the dead Lever list — these companies moved to Greenhouse.
  { slug: 'airtable', name: 'Airtable' },
  { slug: 'coursera', name: 'Coursera' },
  { slug: 'attentive', name: 'Attentive' },
  { slug: 'klaviyo', name: 'Klaviyo' },
  { slug: 'pendo', name: 'Pendo' },
  { slug: 'mixpanel', name: 'Mixpanel' },
  { slug: 'twitch', name: 'Twitch' },

  // Added 2026-08-27 to widen infra/dev-tools coverage.
  { slug: 'cloudflare', name: 'Cloudflare' },
  { slug: 'grafanalabs', name: 'Grafana Labs' },
  { slug: 'fivetran', name: 'Fivetran' },
  { slug: 'togetherai', name: 'Together AI' },
  { slug: 'tailscale', name: 'Tailscale' },
  { slug: 'chainguard', name: 'Chainguard' },
  { slug: 'hextechnologies', name: 'Hex' },
  { slug: 'planetscale', name: 'PlanetScale' },
];
