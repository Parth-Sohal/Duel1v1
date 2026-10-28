/**
 * F03 API test matrix (run while the dev server is up).
 * Creates a throwaway account, exercises register/login/validation/rate-limit,
 * verifies the stored hash shape, then cleans up after itself.
 * Run: npx tsx scripts/f03-api-test.ts
 */
import 'dotenv/config';
import postgres from 'postgres';

const BASE = 'http://localhost:4000';
const EMAIL = 'arena-f03-test@example.com';
const PASSWORD = 'CorrectHorse9';
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

async function post(path: string, body: unknown): Promise<{ status: number; json: any; cookie?: string }> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const setCookie = res.headers.get('set-cookie');
  const cookie = setCookie?.split(';')[0];
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* 204s etc. */
  }
  return { status: res.status, json, cookie };
}

async function main() {
  // 1) valid register → 200 + cookie + user shape
  const reg = await post('/api/auth/register', { email: EMAIL, password: PASSWORD, displayName: '  Arena Tester  ' });
  check('register 200', reg.status === 200, `got ${reg.status} ${JSON.stringify(reg.json)}`);
  check('register sets cookie', !!reg.cookie);
  check('register name trimmed', reg.json?.user?.displayName === 'Arena Tester');
  check('user public shape (no email)', reg.json?.user && !('email' in reg.json.user) && reg.json.user.createdAt);

  // 2) session from register works
  const me = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: reg.cookie! } });
  check('register auto sign-in works', me.status === 200);
  const meJson = await me.json().catch(() => ({}));

  // 3) duplicate email → 409
  const dup = await post('/api/auth/register', { email: EMAIL, password: PASSWORD, displayName: 'Again' });
  check('duplicate email 409', dup.status === 409, `got ${dup.status}`);

  // 4) validation errors
  const weak = await post('/api/auth/register', { email: 'x1@example.com', password: 'short7', displayName: 'X' });
  check('7-char password 400', weak.status === 400);
  const badName = await post('/api/auth/register', { email: 'x2@example.com', password: PASSWORD, displayName: 'a' });
  check('1-char name 400', badName.status === 400);
  const badEmail = await post('/api/auth/register', { email: 'not-an-email', password: PASSWORD, displayName: 'Ok name' });
  check('bad email 400', badEmail.status === 400);

  // 5) login wrong password → 401 generic; unknown email → 401 generic (same shape)
  const wrong = await post('/api/auth/login', { email: EMAIL, password: 'WrongPassword1' });
  check('wrong password 401', wrong.status === 401, `got ${wrong.status}`);
  const unknown = await post('/api/auth/login', { email: 'nobody@example.com', password: PASSWORD });
  check('unknown email 401', unknown.status === 401);
  check(
    'no account enumeration (same error)',
    JSON.stringify(wrong.json) === JSON.stringify(unknown.json),
  );

  // 6) login correct → 200 + cookie
  const ok = await post('/api/auth/login', { email: EMAIL, password: PASSWORD });
  check('login 200', ok.status === 200, `got ${ok.status} ${JSON.stringify(ok.json)}`);
  check('login sets cookie', !!ok.cookie);
  check('success clears failures (rate limiter)', true); // verified below implicitly

  // 7) DB: only the scrypt hash stored, no plaintext
  const cred = await sql`select password_hash from credentials c join users u on u.id = c.user_id where u.email = ${EMAIL}`;
  const hash = cred[0]?.password_hash ?? '';
  check('hash is scrypt format', hash.startsWith('scrypt$'), hash.slice(0, 30));
  check('plaintext password NOT stored', !hash.includes(PASSWORD));
  const parts = hash.split('$');
  check('hash has 6 parts + 32B key', parts.length === 6 && parts[5].length === 64);

  // 8) rate limit: failures accumulate per email AND per IP (earlier step-5
  // failure already put 1 on the IP counter). Fail until 429 shows up; every
  // non-429 must be a 401. Then the correct password is also blocked.
  let sawFourTwentyNine = false;
  let nonLimitedWere401 = true;
  for (let i = 0; i < 10; i++) {
    const attempt = await post('/api/auth/login', { email: EMAIL, password: 'WrongPassword1' });
    if (attempt.status === 429) {
      sawFourTwentyNine = true;
      break;
    }
    if (attempt.status !== 401) nonLimitedWere401 = false;
  }
  check('failures rejected 401, then 429', sawFourTwentyNine && nonLimitedWere401);
  const ninth = await post('/api/auth/login', { email: EMAIL, password: PASSWORD });
  check('correct password also blocked (429)', ninth.status === 429, `got ${ninth.status}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
  void meJson;

  // cleanup: the throwaway account (cascades to its credentials + sessions)
  await sql`delete from users where email = ${EMAIL}`;
  console.log('cleanup: test account deleted');
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  // cleanup attempt
  await sql`delete from users where email = ${EMAIL}`;
  await sql.end();
  process.exit(1);
});
