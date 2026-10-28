/** One-off: show updated_at for a user (F02 PATCH persistence check). */
import 'dotenv/config';
import postgres from 'postgres';

const id = process.argv[2];
if (!id) throw new Error('usage: f02-check-user.ts <userId>');
const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 1, connect_timeout: 10, ssl: /neon\.tech|sslmode=/.test(url) ? 'require' : false });
const rows = await sql`select display_name, updated_at, created_at from users where id = ${id}`;
console.log(rows[0]);
await sql.end();
