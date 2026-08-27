// Ashby public board slugs. Each appears at jobs.ashbyhq.com/{slug}.
// Verified live on 2026-08-27 — every slug here returned postings when added.
export const ASHBY_COMPANIES: { slug: string; name: string }[] = [
  // Migrated off the Greenhouse slugs this repo used to ask for.
  { slug: 'openai', name: 'OpenAI' },
  { slug: 'notion', name: 'Notion' },
  { slug: 'supabase', name: 'Supabase' },
  { slug: 'linear', name: 'Linear' },
  { slug: 'ramp', name: 'Ramp' },
  { slug: 'plaid', name: 'Plaid' },
  { slug: 'zapier', name: 'Zapier' },
  { slug: 'snowflake', name: 'Snowflake' },
  { slug: 'perplexity', name: 'Perplexity' },

  // AI / infra companies actually hiring at startup scale.
  { slug: 'cursor', name: 'Cursor' },
  { slug: 'harvey', name: 'Harvey' },
  { slug: 'sierra', name: 'Sierra' },
  { slug: 'elevenlabs', name: 'ElevenLabs' },
  { slug: 'langchain', name: 'LangChain' },
  { slug: 'fireworks', name: 'Fireworks AI' },
  { slug: 'replit', name: 'Replit' },
  { slug: 'modal', name: 'Modal' },
  { slug: 'render', name: 'Render' },
  { slug: 'railway', name: 'Railway' },
  { slug: 'airbyte', name: 'Airbyte' },
  { slug: 'resend', name: 'Resend' },
  // NOTE: `neon` on Ashby is a games-payments company, not Neon the Postgres
  // database. Don't add it back under that name without re-checking the board.
  { slug: 'temporal', name: 'Temporal' },
  { slug: 'sentry', name: 'Sentry' },
  { slug: 'vanta', name: 'Vanta' },
  { slug: 'drata', name: 'Drata' },
  { slug: 'persona', name: 'Persona' },
  { slug: 'ashby', name: 'Ashby' },
];
