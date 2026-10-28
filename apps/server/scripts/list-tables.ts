/** One-off: list public tables (verify migrations applied). */
import 'dotenv/config';
import postgres from 'postgres';

const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 1, connect_timeout: 10, ssl: /neon\.tech|sslmode=/.test(url) ? 'require' : false });
const r = await sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`;
console.log(r.map((t) => t.table_name).join(', '));
await sql.end();
