/**
 * F02 API test harness (run while the dev server is up):
 * 1. mints a real session token for the given user id (server-side service),
 * 2. prints it so the shell can use it as a cookie,
 * 3. (mode=cleanup) deletes the session row again.
 * Run: npx tsx scripts/f02-session.ts <userId> [cleanup <token>]
 */
import 'dotenv/config';
import { createDb } from '../src/db/index.js';
import { createSession, deleteSession } from '../src/services/sessions.js';
import { env } from '../src/config/env.js';

const [, , userId, mode, token] = process.argv;
if (!userId) throw new Error('usage: f02-session.ts <userId> [cleanup <token>]');
const { db, pool } = createDb(env.databaseUrl);

if (mode === 'cleanup') {
  if (!token) throw new Error('cleanup needs the token');
  await deleteSession(db, token);
  console.log('session deleted');
} else {
  const { token: t, expiresAt } = await createSession(db, userId);
  console.log(t);
  console.error(`session created, expires ${expiresAt.toISOString()}`);
}
await pool.end();
