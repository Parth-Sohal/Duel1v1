import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

/**
 * Single shared Postgres connection (postgres-js over the Neon pooler).
 * `max: 1` keeps local dev polite; Neon's pooler scales in production.
 */
export function createDb(databaseUrl: string) {
  const needsSsl = /sslmode=/.test(databaseUrl) || /neon\.tech/.test(databaseUrl);

  const pool = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: needsSsl ? 'require' : false,
  });

  const db = drizzle(pool, { schema });
  return { db, pool };
}

export type Database = ReturnType<typeof createDb>['db'];
