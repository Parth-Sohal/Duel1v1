/** One-off: create a throwaway user + session token (for UI tests). */
import 'dotenv/config';
import postgres from 'postgres';

const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 1, connect_timeout: 10, ssl: /neon\.tech|sslmode=/.test(url) ? 'require' : false });

const EMAIL = 'arena-ui-avatar@example.com';
await sql`insert into users (email, display_name) values (${EMAIL}, 'UI Tester 2') on conflict (email) do nothing`;
const rows = await sql`select id from users where email = ${EMAIL}`;
const userId = rows[0].id as string;

const { createDb } = await import('../src/db/index.js');
const { createSession } = await import('../src/services/sessions.js');
const { env } = await import('../src/config/env.js');
const { db, pool } = createDb(env.databaseUrl);
const { token } = await createSession(db, userId);
await pool.end();

console.log(JSON.stringify({ userId, token }));
await sql.end();
