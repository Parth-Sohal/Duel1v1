/** Iteration 2 production smoke: registers a throwaway account on PRODUCTION, server-renders /practice, runs one real judged submission, verifies the list, then deletes the account. Run: npx tsx scripts/f04-prod-smoke.ts */
const SERVER = process.env.PROD_SERVER ?? 'https://duel1v1.onrender.com';
const WEB = process.env.PROD_WEB ?? 'https://duel1v1.vercel.app';
const EMAIL = 'f04-prod-smoke@example.com';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : ` - ${detail}`}`);
}

async function call(url: string, init: RequestInit): Promise<{ status: number; text: string; json: any; cookie: string }> {
  // local network blips (ECONNRESET) have killed runs; retry them
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

// cleanup any leftovers first, then sign in (re-runs: account already exists -> 409)
const pre = await call(`${SERVER}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: 'ProdSmoke1!' }),
});
console.log('prod smoke against', WEB);

let cookie = pre.cookie;
if (pre.status !== 200) {
  const reg = await call(`${SERVER}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: 'ProdSmoke1!', displayName: 'Prod Smoke' }),
  });
  check('register 200 (production server)', reg.status === 200, `got ${reg.status}`);
  cookie = reg.cookie;
} else {
  check('login 200 (account from prior run)', true);
}
check('session cookie set', cookie.startsWith('arena_session='));

const list = await call(`${WEB}/practice`, { headers: { cookie } });
check('SSR /practice 200', list.status === 200);
check('list shows PRACTICE headline', list.text.toLowerCase().includes('practice.'));
check('list shows all 8 challenges', ['Pair Target Sum', 'Rotate Array', 'Climb Stairs', 'Bracket Check', 'Max Window Sum', 'First Duplicate', 'Reverse Words', 'Missing Number'].every((t) => list.text.toLowerCase().includes(t.toLowerCase())));

const detail = await call(`${WEB}/practice/climb-stairs`, { headers: { cookie } });
check('SSR detail 200', detail.status === 200);
check('detail shows function signature', detail.text.includes('climbStairs'));
check('detail shows frozen expected', detail.text.includes('[2]') || detail.text.includes('1346269'));

// one real judged run through the production web proxy
const run = await call(`${WEB}/api/challenges/climb-stairs/run`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify({
    language: 'python',
    sourceCode: 'def climb_stairs(n):\n    a, b = 1, 1\n    for _ in range(2, n + 1):\n        a, b = b, (a + b) % 1000000007\n    return b',
  }),
});
check('production judged run -> accepted', run.status === 200 && run.json?.status === 'accepted' && run.json?.passed === 2, JSON.stringify(run.json?.status));

// and a submit (saved) — the throwaway account is deleted afterwards
const sub = await call(`${WEB}/api/challenges/climb-stairs/submit`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify({ language: 'javascript', sourceCode: 'function climbStairs(n) { const M = 1000000007; let a = 1, b = 1; for (let i = 2; i <= n; i++) { [a, b] = [b, (a + b) % M]; } return b; }' }),
});
check('production submit -> accepted 5/5', sub.status === 200 && sub.json?.status === 'accepted' && sub.json?.passed === 5 && sub.json?.total === 5, JSON.stringify({ status: sub.json?.status, passed: sub.json?.passed, total: sub.json?.total }));
check('hidden results sealed', (sub.json?.results ?? []).every((r: any) => !r.hidden || (!('args' in r) && !('expected' in r))));

const listAfter = await call(`${WEB}/api/challenges`, { headers: { cookie } });
const cs = (listAfter.json?.challenges ?? []).find((c: any) => c.slug === 'climb-stairs');
check('challenge marked solved in list', cs?.solved === true, JSON.stringify(cs));

// delete the throwaway account (cascades submissions + sessions)
import postgres from 'postgres';
import 'dotenv/config';
const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 1, ssl: /neon\.tech|sslmode=/.test(url) ? 'require' : false });
const del = await sql`delete from users where email = ${EMAIL}`;
check('throwaway account deleted', del.count === 1);
await sql.end();

console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
