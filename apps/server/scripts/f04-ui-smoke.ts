/** One-off UI smoke test: registers a throwaway user, then server-renders the practice pages through the web app and checks the HTML. Cleans up after itself. Run with the dev servers up: npx tsx scripts/f04-ui-smoke.ts */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';

const SERVER = 'http://localhost:4000';
const WEB = 'http://localhost:3000';
const EMAIL = 'f04-ui-smoke@example.com';
const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 1, ssl: /neon\.tech|sslmode=/.test(url) ? 'require' : false });

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : ` - ${detail}`}`);
}

// fresh account
await sql`delete from users where email = ${EMAIL}`;
const reg = await fetch(`${SERVER}/api/auth/register`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: 'SmokeTest1!', displayName: 'UI Smoke' }),
});
const setCookie = reg.headers.get('set-cookie') ?? '';
const cookie = setCookie.split(';')[0];
check('register sets session cookie', cookie.startsWith('arena_session='));

async function getPage(path: string): Promise<{ status: number; html: string }> {
  const res = await fetch(`${WEB}${path}`, { headers: { cookie } });
  return { status: res.status, html: await res.text() };
}

// signed-out gate (redirect: manual so fetch reports the 307 itself)
const anon = await fetch(`${WEB}/practice`, { redirect: 'manual' });
check('signed-out /practice redirects to login', anon.status === 307 || anon.status === 302, `got ${anon.status}`);

const list = await getPage('/practice');
check('list renders 200', list.status === 200, `got ${list.status}`);
check('list shows PRACTICE headline', list.html.toLowerCase().includes('practice.'));
check('list shows Pair Target Sum', list.html.includes('Pair Target Sum'));
check('list shows Rotate Array', list.html.includes('Rotate Array'));
check('list shows solved counters', list.html.includes('solved'));
check('nav shows PRACTICE link', list.html.includes('/practice'));
check('no fake data (no LeetCode mention)', !list.html.includes('LeetCode'));

const detail = await getPage('/practice/pair-target-sum');
check('detail renders 200', detail.status === 200);
check('detail shows title', detail.html.includes('Pair Target Sum'));
check('detail shows statement text', detail.html.includes('Exactly one pair of values'));
check('detail shows sample input', detail.html.includes('1 2 3 4'));
check('detail shows frozen expected', detail.html.includes('3 4'));
check('detail shows workbench', detail.html.includes('Workbench'));
check('detail shows starter code', detail.html.includes('readFileSync'));
check('detail has RUN button', detail.html.includes('Run'));
check('detail has SUBMIT button', detail.html.includes('Submit'));
const hiddenLeak = /"hidden"\s*:\s*true/.test(detail.html) || /Hidden test/.test(detail.html);
check('detail leaks NO hidden tests', !hiddenLeak);

const missing = await getPage('/practice/does-not-exist');
check('unknown slug renders designed 404', missing.status === 200 && missing.html.includes('No challenge.'));

// run through the REAL UI path: browser fetches go to /api on the web origin
const run = await fetch(`${WEB}/api/challenges/pair-target-sum/run`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify({
    language: 'javascript',
    sourceCode: `const l=require('fs').readFileSync(0,'utf8').split(/\\r?\\n/);
const n=+l[0];const a=l[1].trim().split(/\\s+/).map(Number);const t=+l[2];
outer: for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){if(a[i]+a[j]===t){console.log(a[i]+' '+a[j]);break outer;}}`,
  }),
});
const runData = (await run.json()) as { status?: string; passed?: number };
check('web-proxy run -> accepted', run.status === 200 && runData.status === 'accepted', JSON.stringify(runData));

// cleanup
await sql`delete from users where email = ${EMAIL}`;
console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
await sql.end();
process.exit(failed === 0 ? 0 : 1);
