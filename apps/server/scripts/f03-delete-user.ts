/** One-off: delete a throwaway account by email (cascades credentials + sessions). */
import 'dotenv/config';
import postgres from 'postgres';

const email = process.argv[2];
if (!email) throw new Error('usage: f03-delete-user.ts <email>');
const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 1, connect_timeout: 10, ssl: /neon\.tech|sslmode=/.test(url) ? 'require' : false });
const r = await sql`delete from users where email = ${email}`;
console.log('deleted rows:', r.count);
await sql.end();
