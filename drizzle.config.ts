import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Mirror Next.js's env loading order: .env.local wins over .env.
config({ path: '.env.local' });
config({ path: '.env' });

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Add it to .env.local before running drizzle-kit.',
  );
}

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
