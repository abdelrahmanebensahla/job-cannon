import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';

import * as schema from './schema';

type Db = NeonHttpDatabase<typeof schema>;

declare global {
  // Reuse the client across HMR + module reloads in dev.
  // eslint-disable-next-line no-var
  var __drizzle__: Db | undefined;
}

function createClient(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

// Lazy proxy: instantiation deferred until the first property access. This
// keeps `next build` happy when env vars are absent (e.g. CI lint passes) and
// only blows up at request time if DATABASE_URL is genuinely missing.
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const real = (globalThis.__drizzle__ ??= createClient());
    const value = Reflect.get(real, prop, receiver);
    return typeof value === 'function' ? value.bind(real) : value;
  },
});

export { schema };
