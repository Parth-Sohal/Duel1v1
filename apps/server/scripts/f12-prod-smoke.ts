/**
 * F12 production smoke (docs/features/F12-more-languages.md): after a deploy,
 * confirm the live server serves the four-language versions and can judge both
 * static languages end to end.
 *
 * It registers a throwaway account on production, checks the live challenge
 * detail for Java/C++ signatures and starter code, submits the Java reference
 * through the web proxy (all 5 tests must pass), runs the C++ reference on the
 * visible samples, verifies hidden results stay sealed, then deletes the
 * account and every submission that cascaded from it.
 *
 * Run from apps/server: npx tsx scripts/f12-prod-smoke.ts
 * Requires the local DATABASE_URL (same production DB) for cleanup.
 */
import 'dotenv/config';
import postgres from 'postgres';
import { CHALLENGES } from './seed-data.js';

const SERVER = process.env.PROD_SERVER ?? 'https://duel1v1.onrender.com';
const WEB = process.env.PROD_WEB ?? 'https://duel1v1.vercel.app';
const EMAIL = 'f12-prod-smoke@example.com';
const PASSWORD = 'F12Smoke1!';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : ` - ${detail}`}`);
}

async function call(url: string, init: RequestInit): Promise<{ status: number; text: string; json: any; cookie: string }> {
  // Local network blips have killed smoke runs before; retry transport errors only.
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, init);
      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* html */
      }
      return { status: res.status, text, json, cookie: (res.headers.get('set-cookie') ?? '').split(';')[0] };
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
  throw lastErr;
}

console.log('F12 production smoke against', WEB);

const pre = await call(`${SERVER}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
let cookie = pre.cookie;
if (pre.status !== 200) {
  const reg = await call(`${SERVER}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, displayName: 'F12 Smoke' }),
  });
  check('register 200 (production server)', reg.status === 200, `got ${reg.status}`);
  cookie = reg.cookie;
} else {
  check('login 200 (account from prior run)', true);
}
check('session cookie set', cookie.startsWith('arena_session='));

const detail = await call(`${WEB}/api/challenges/pair-target-sum`, { headers: { cookie } });
const c = detail.json?.challenge;
check('detail 200', detail.status === 200, `${detail.status} ${detail.text.slice(0, 120)}`);
check('published version is v2+', typeof c?.version === 'number' && c.version >= 2, String(c?.version));
check(
  'java typed signature served',
  c?.entryFunctions?.java?.name === 'pairTargetSum' && Array.isArray(c?.entryFunctions?.java?.params),
);
check(
  'cpp typed signature served',
  c?.entryFunctions?.cpp?.name === 'pairTargetSum' && Array.isArray(c?.entryFunctions?.cpp?.params),
);
check('java starter served', typeof c?.starterCode?.java === 'string' && c.starterCode.java.includes('class Solution'));
check('cpp starter served', typeof c?.starterCode?.cpp === 'string' && c.starterCode.cpp.includes('vector<long long>'));

const seed = CHALLENGES.find((x) => x.slug === 'pair-target-sum')!;

// The API takes the player's function only; the server composes the harness.
const java = await call(`${WEB}/api/challenges/pair-target-sum/submit`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify({ language: 'java', sourceCode: seed.reference.java }),
});
check(
  'production java submit -> accepted 5/5',
  java.status === 200 && java.json?.status === 'accepted' && java.json?.passed === 5 && java.json?.total === 5,
  JSON.stringify({ status: java.json?.status, passed: java.json?.passed, total: java.json?.total, err: java.json?.message }),
);
check(
  'hidden results sealed',
  (java.json?.results ?? []).every((r: any) => !r.hidden || (!('args' in r) && !('expected' in r))),
);

const cpp = await call(`${WEB}/api/challenges/pair-target-sum/run`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify({ language: 'cpp', sourceCode: seed.reference.cpp }),
});
check(
  'production cpp run -> all visible accepted',
  cpp.status === 200 && cpp.json?.status === 'accepted' && cpp.json?.passed === cpp.json?.total,
  JSON.stringify({ status: cpp.json?.status, passed: cpp.json?.passed, total: cpp.json?.total, err: cpp.json?.message }),
);

// Delete the throwaway account (cascades sessions + submissions).
const sql = postgres(process.env.DATABASE_URL!, {
  max: 1,
  ssl: /neon\.tech|sslmode=/.test(process.env.DATABASE_URL!) ? 'require' : false,
});
const del = await sql`delete from users where email = ${EMAIL}`;
check('throwaway account deleted', del.count === 1);
await sql.end();

console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
