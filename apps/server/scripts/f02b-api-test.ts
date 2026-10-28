/**
 * F02b API test matrix (run while the dev server is up).
 * Uploads/serves/removes a throwaway avatar on a throwaway session,
 * then cleans up. Run: npx tsx scripts/f02b-api-test.ts
 */
import 'dotenv/config';
import postgres from 'postgres';

const BASE = 'http://localhost:4000';
const TEST_EMAIL = 'arena-avatar-test@example.com';
const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 1, connect_timeout: 10, ssl: /neon\.tech|sslmode=/.test(url) ? 'require' : false });

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = ''): void {
  if (cond) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}  ${detail}`);
  }
}

// 1×1 real PNG (valid magic bytes)
const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
// fake PNG: data: prefix says png, bytes say "hello" — must be rejected
const FAKE_PNG = `data:image/png;base64,${Buffer.from('hello world, not an image at all').toString('base64')}`;
// oversize: PNG magic + 200KB of zeros
const BIG_PNG = `data:image/png;base64,${Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(200_000)]).toString('base64')}`;

async function createSession(): Promise<{ cookie: string; userId: string }> {
  await sql`insert into users (email, display_name) values (${TEST_EMAIL}, 'Avatar Tester') on conflict (email) do nothing`;
  const rows = await sql`select id from users where email = ${TEST_EMAIL}`;
  const userId = rows[0].id as string;
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: 'whatever' }),
  });
  // no password account — mint the session directly instead
  void res;
  const { createDb } = await import('../src/db/index.js');
  const { createSession } = await import('../src/services/sessions.js');
  const { env } = await import('../src/config/env.js');
  const { db, pool } = createDb(env.databaseUrl);
  const { token } = await createSession(db, userId);
  await pool.end();
  return { cookie: `arena_session=${token}`, userId };
}

async function main() {
  const { cookie, userId } = await createSession();
  const H = { cookie, 'content-type': 'application/json' };

  // 1) valid upload
  let res = await fetch(`${BASE}/api/me/avatar`, { method: 'PUT', headers: H, body: JSON.stringify({ dataUrl: PNG_1PX }) });
  const j1 = await res.json().catch(() => null);
  check('upload 200', res.status === 200, `got ${res.status}`);
  const url1: string = j1?.user?.avatarUrl ?? '';
  check('avatar_url is versioned local path', url1.startsWith(`/api/users/${userId}/avatar?v=`), url1);

  // 2) serving
  res = await fetch(`${BASE}${url1}`);
  check('avatar served 200', res.status === 200, `got ${res.status}`);
  check('served content-type image/png', res.headers.get('content-type') === 'image/png');
  const bytes = Buffer.from(await res.arrayBuffer());
  check('served bytes are the PNG', bytes[0] === 0x89 && bytes[1] === 0x50 && bytes.length > 0);

  // 3) re-upload → new version (cache-bust)
  res = await fetch(`${BASE}/api/me/avatar`, { method: 'PUT', headers: H, body: JSON.stringify({ dataUrl: PNG_1PX }) });
  const j3 = await res.json().catch(() => null);
  const url3: string = j3?.user?.avatarUrl ?? '';
  check('re-upload bumps version', url3 !== url1 && url3.startsWith(`/api/users/${userId}/avatar?v=`));

  // 4) fake PNG (bad magic) → 400
  res = await fetch(`${BASE}/api/me/avatar`, { method: 'PUT', headers: H, body: JSON.stringify({ dataUrl: FAKE_PNG }) });
  check('renamed non-image 400', res.status === 400, `got ${res.status}`);

  // 5) oversize → 413
  res = await fetch(`${BASE}/api/me/avatar`, { method: 'PUT', headers: H, body: JSON.stringify({ dataUrl: BIG_PNG }) });
  check('oversize 413', res.status === 413, `got ${res.status}`);

  // 6) no auth → 401
  res = await fetch(`${BASE}/api/me/avatar`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dataUrl: PNG_1PX }) });
  check('upload without session 401', res.status === 401);

  // 7) unknown id avatar → 404
  res = await fetch(`${BASE}/api/users/00000000-0000-0000-0000-000000000000/avatar`);
  check('unknown id avatar 404', res.status === 404);

  // 8) public profile exposes the uploaded URL, still no private fields
  res = await fetch(`${BASE}/api/users/${userId}`, { headers: { cookie } });
  const pub = await res.json().catch(() => null);
  check('public profile carries avatarUrl', pub?.user?.avatarUrl === url3);
  check('public profile has no email', pub?.user && !('email' in pub.user));

  // 9) remove (no content-type — there is no body; Fastify would try to parse one)
  res = await fetch(`${BASE}/api/me/avatar`, { method: 'DELETE', headers: { cookie } });
  const j9 = await res.json().catch(() => null);
  check('remove 200, avatarUrl null', res.status === 200 && j9?.user?.avatarUrl === null);
  res = await fetch(`${BASE}${url3}`);
  check('removed avatar no longer served', res.status === 404);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;

  // cleanup
  await sql`delete from users where email = ${TEST_EMAIL}`;
  console.log('cleanup: test account deleted');
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql`delete from users where email = ${TEST_EMAIL}`;
  await sql.end();
  process.exit(1);
});
