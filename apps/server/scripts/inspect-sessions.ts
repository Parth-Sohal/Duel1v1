/**
 * F01 checklist probe: verify that sessions store only a SHA-256 hash
 * (64 hex chars, never the raw Google token) and inspect the user row.
 * Run: npx tsx scripts/inspect-sessions.ts
 */
import 'dotenv/config';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL missing');
const needsSsl = /sslmode=/.test(url) || /neon\.tech/.test(url);
const sql = postgres(url, { max: 1, connect_timeout: 10, ssl: needsSsl ? 'require' : false });

async function main() {
  const users = await sql`
    select id, google_id, display_name, email, points, wins, losses, draws, created_at
      from users order by created_at desc limit 5`;
  console.log('== users ==');
  for (const u of users) {
    console.log({
      id: u.id,
      google_sub: u.google_id,
      display_name: u.display_name,
      email: u.email,
      points: u.points,
      wld: `${u.wins}/${u.losses}/${u.draws}`,
      created: u.created_at,
    });
  }

  const sessions = await sql`
    select s.user_id, length(s.token_hash) as hash_len,
           s.token_hash ~ '^[0-9a-f]{64}$' as is_sha256_hex,
           s.token_hash like 'eyJ%' as looks_like_jwt,
           s.expires_at, (s.expires_at > now()) as not_expired
      from sessions s order by s.created_at desc limit 5`;
  console.log('== sessions ==');
  for (const s of sessions) console.log(s);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
