/**
 * F10 launch-hardening test matrix (docs/features/F10-hardening.md).
 * Exercises the real server + shared Neon DB: the five new rate limits
 * (register / room ops / bot duels / socket tokens / feedback), the events
 * pipeline (signup, daily_view, submit, match_started → owner counts), the
 * owner-only feedback + counts endpoints, the landing/legal pages signed-out,
 * and the secrets-in-git audit. Requires a FRESHLY RESTARTED local server
 * (the limiters are in-memory — a long-running server already part-way into
 * a window would 429 the setup instead of the probe). OWNER_EMAILS must
 * include f10-owner@example.com (see apps/server/.env locally).
 * Run: npx tsx scripts/f10-hardening-test.ts (local server on :4000, web on :3000)
 */
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { eq, inArray } from 'drizzle-orm';
import { FEEDBACK_MAX_CHARS, FEEDBACK_MAX_PER_WINDOW } from '@coding-arena/shared';
import { createDb } from '../src/db/index.js';
import { events, matches, users } from '../src/db/schema.js';

const BASE = 'http://localhost:4000';
const WEB = 'http://localhost:3000';
const PREFIX = 'f10-hard';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : ` - ${detail}`}`);
}

const db = createDb(process.env.DATABASE_URL!).db;

async function call(
  path: string,
  method: string,
  body: unknown,
  cookie?: string,
  timeoutMs = 30000,
): Promise<{ status: number; json: any; cookie?: string }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      let json: any = null;
      try {
        json = await res.json();
      } catch {
        /* no body */
      }
      if (res.status >= 500 && attempt < 3) {
        await new Promise((r) => setTimeout(r, attempt * 1500));
        continue;
      }
      return { status: res.status, json, cookie: (res.headers.get('set-cookie') ?? '').split(';')[0] };
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  throw lastError;
}

/** Registers a throwaway account (does NOT count against the checked limits —
 * budget: this gate performs exactly 3 registrations, the 4th IS the 429 test). */
async function registerPlayer(n: number, displayName: string): Promise<{ email: string; cookie: string; id?: string }> {
  const email = `${PREFIX}-${n}@example.com`;
  await db.delete(users).where(eq(users.email, email));
  const res = await call('/api/auth/register', 'POST', { email, password: 'F10HardeningPass!', displayName });
  if (res.status !== 200) throw new Error(`register ${n} failed: ${res.status} ${JSON.stringify(res.json)}`);
  const me = await call('/api/auth/me', 'GET', undefined, res.cookie!);
  return { email, cookie: res.cookie!, ...me.json?.user };
}

/** A known-correct practice solution (same sources the F09 matrix uses). */
const SOLUTION: Record<string, string> = {
  'pair-target-sum': `function pairTargetSum(nums, target) { for (let i = 0; i < nums.length; i++) { for (let j = i + 1; j < nums.length; j++) { if (nums[i] + nums[j] === target) return [nums[i], nums[j]]; } } return null; }`,
  'reverse-words': `function reverseWords(lines) { return lines.map((line) => line.trim().split(/\\\\s+/).filter(Boolean).reverse().join(' ')); }`,
  'first-duplicate': `function firstDuplicate(nums) { const seen = new Set(); for (const v of nums) { if (seen.has(v)) return v; seen.add(v); } return -1; }`,
  'max-window-sum': `function maxWindowSum(nums, k) { let sum = 0; for (let i = 0; i < k; i++) sum += nums[i]; let best = sum; for (let i = k; i < nums.length; i++) { sum += nums[i] - nums[i - k]; if (sum > best) best = sum; } return best; }`,
  'bracket-check': `function bracketCheck(s) { const pairs = { ')': '(', ']': '[', '}': '{' }; const st = []; for (const ch of s) { if (ch === '(' || ch === '[' || ch === '{') st.push(ch); else if (ch === ')' || ch === ']' || ch === '}') { if (st.pop() !== pairs[ch]) return false; } } return st.length === 0; }`,
  'climb-stairs': `function climbStairs(n) { const M = 1000000007; let a = 1, b = 1; for (let i = 2; i <= n; i++) { const c = (a + b) % M; a = b; b = c; } return b; }`,
  'rotate-array': `function rotateArray(nums, k) { const n = nums.length; const r = k % n; return nums.slice(n - r).concat(nums.slice(0, n - r)); }`,
  'missing-number': `function missingNumber(n, nums) { const total = (n * (n + 1)) / 2; return total - nums.reduce((x, y) => x + y); }`,
};

async function main(): Promise<void> {
  console.log('F10 hardening matrix against', BASE);

  // ---- Case 1: register rate limit (3 per IP per hour) — the 4th IS the probe ----
  const A = await registerPlayer('owner', 'Hardening Owner'); // OWNER_EMAILS includes this email
  const B = await registerPlayer(2, 'Hardening Rival');
  const C = await registerPlayer(3, 'Hardening Third');
  const overflow = await call('/api/auth/register', 'POST', {
    email: `${PREFIX}-4@example.com`,
    password: 'F10HardeningPass!',
    displayName: 'Should Not Exist',
  });
  check('register rate limit: 4th signup from one IP → 429', overflow.status === 429, `got ${overflow.status}`);
  const noGhost = await db.select({ id: users.id }).from(users).where(eq(users.email, `${PREFIX}-4@example.com`)).limit(1);
  check('429 signup created no account row', noGhost.length === 0);

  // ---- Case 2: events pipeline (signup already flowed for A/B/C) ----
  const counts0 = await call('/api/events/counts', 'GET', undefined, A.cookie);
  check('owner reads /events/counts', counts0.status === 200 && typeof counts0.json?.counts === 'object', JSON.stringify(counts0.json));
  const signups0 = Number(counts0.json?.counts?.signup ?? 0);
  check('signup events recorded (3 registrations)', signups0 >= 3, String(signups0));
  const forbiddenB = await call('/api/events/counts', 'GET', undefined, B.cookie);
  check('non-owner gets 403 on /events/counts', forbiddenB.status === 403, `got ${forbiddenB.status}`);
  const anonCounts = await call('/api/events/counts', 'GET', undefined);
  check('signed-out gets 401 on /events/counts', anonCounts.status === 401, `got ${anonCounts.status}`);

  // ---- Case 3: socket-token limit (6 per user per minute) ----
  // Concurrent burst: all requests land inside one window regardless of DB
  // latency (sequential slow calls could legitimately slide out of it).
  const tokenRes = await Promise.all(
    Array.from({ length: 7 }, () => call('/api/duels/socket-token', 'GET', undefined, B.cookie)),
  );
  const token429s = tokenRes.filter((t) => t.status === 429).length;
  const token200s = tokenRes.filter((t) => t.status === 200).length;
  check('socket-token limit: burst of 7 → 6 allowed + exactly one 429', token200s === 6 && token429s === 1, JSON.stringify(tokenRes.map((t) => t.status)));

  // ---- Case 4: room-ops limit (10 per user per minute) ----
  const roomRes = await Promise.all(
    Array.from({ length: 12 }, () => call('/api/duels/rooms', 'POST', { difficulty: null }, B.cookie)),
  );
  const room200s = roomRes.filter((r) => r.status === 200).length;
  const room429s = roomRes.filter((r) => r.status === 429).length;
  const roomOther = roomRes.filter((r) => r.status !== 200 && r.status !== 429).length;
  check('room-ops limit: burst of 12 → 10 created + 2 rejected', room200s === 10 && room429s === 2 && roomOther === 0, JSON.stringify(roomRes.map((r) => r.status)));

  // ---- Case 5: practice submit → submit event + submissionId log (real Judge0) ----
  const daily = await call('/api/daily', 'GET', undefined, A.cookie);
  check('daily_view event source works for the owner account', daily.status === 200);
  const dailyB = await call('/api/daily', 'GET', undefined, B.cookie);
  check('daily_view event source works for the rival account', dailyB.status === 200);

  const practice = await call('/api/challenges', 'GET', undefined, A.cookie);
  const slugs: string[] = (practice.json?.challenges ?? practice.json ?? []).map((c: any) => c.slug ?? c).filter((s: any) => typeof s === 'string');
  const slug = slugs.find((s) => SOLUTION[s]) ?? slugs[0];
  const solution = SOLUTION[slug];
  check('practice pool exposes a slug with a known solution', !!solution, slug);
  const sub = await call(`/api/challenges/${slug}/submit`, 'POST', { language: 'javascript', sourceCode: solution }, A.cookie, 180000);
  check('practice submit still judges end-to-end (regression)', sub.status === 200, JSON.stringify({ status: sub.status, body: sub.json?.status }));

  // ---- Case 6: bot-duel limit (3 per user per minute) + match_started event ----
  const botStatuses: number[] = [];
  let botMatchId: string | null = null;
  for (let i = 1; i <= 4; i++) {
    const r = await call('/api/duels/bot', 'POST', { difficulty: null }, A.cookie);
    botStatuses.push(r.status);
    if (r.status === 200 && typeof r.json?.matchId === 'string') botMatchId = r.json.matchId;
    if (r.status === 429) break;
  }
  check('bot-duel limit: 4th /duels/bot call → 429', botStatuses[botStatuses.length - 1] === 429 && botStatuses.length === 4, JSON.stringify(botStatuses));
  check('first bot call actually started a duel (200)', botStatuses[0] === 200 && !!botMatchId, JSON.stringify(botStatuses));

  const counts1 = await call('/api/events/counts', 'GET', undefined, A.cookie);
  const counts = counts1.json?.counts ?? {};
  check('daily_view events recorded', Number(counts.daily_view ?? 0) >= 2, JSON.stringify(counts));
  check('submit event recorded (practice submit)', Number(counts.submit ?? 0) >= 1, JSON.stringify(counts));
  check('match_started event recorded (bot duel)', Number(counts.match_started ?? 0) >= 1, JSON.stringify(counts));
  const stats = await call('/api/stats/public', 'GET', undefined);
  check('public stats: real duels-played counter (number, no fake data)', stats.status === 200 && typeof stats.json?.duelsPlayed === 'number' && stats.json.duelsPlayed >= 1, JSON.stringify(stats.json));

  // ---- Case 7: feedback (validation free of the budget + 3 accepted per 10 min) ----
  const empty = await call('/api/feedback', 'POST', { message: '   ' }, B.cookie);
  check('empty feedback → 400', empty.status === 400, `got ${empty.status}`);
  const tooLong = await call('/api/feedback', 'POST', { message: 'x'.repeat(FEEDBACK_MAX_CHARS + 1) }, B.cookie);
  check(`feedback over ${FEEDBACK_MAX_CHARS} chars → 400`, tooLong.status === 400, `got ${tooLong.status}`);
  // Rejected drafts must NOT burn the limit: 3 valid notes still go through…
  const fbNotes = [
    'F10 gate: the practice floor is great.',
    'F10 gate: KERN plays a fair human pace.',
    'F10 gate: the daily streak bar is motivating.',
  ];
  const fbResults = [];
  for (const note of fbNotes) {
    fbResults.push((await call('/api/feedback', 'POST', { message: note }, B.cookie)).status);
  }
  check('three valid feedback notes saved (drafts did not burn the budget)', fbResults.every((s) => s === 200), JSON.stringify(fbResults));
  // …and the 4th accepted-note attempt is past the window max → 429.
  const fb429 = await call('/api/feedback', 'POST', { message: 'F10 gate: one note too many.' }, B.cookie);
  check(`feedback limit (${FEEDBACK_MAX_PER_WINDOW} accepted per 10 min) → 429`, fb429.status === 429, `got ${fb429.status}`);
  const fbList = await call('/api/feedback', 'GET', undefined, A.cookie);
  check('owner reads /feedback with saved notes', fbList.status === 200 && (fbList.json?.feedback ?? []).length >= 3, JSON.stringify(fbList.status));
  const fbRival = await call('/api/feedback', 'GET', undefined, B.cookie);
  check('non-owner gets 403 on /feedback list', fbRival.status === 403, `got ${fbRival.status}`);

  // ---- Case 8: web pages signed-out ----
  for (const [name, path] of [['landing', '/'], ['terms', '/terms'], ['privacy', '/privacy']] as const) {
    let pageOk = false;
    for (let attempt = 1; attempt <= 8 && !pageOk; attempt++) {
      try {
        const page = await fetch(`${WEB}${path}`, { signal: AbortSignal.timeout(30000) });
        pageOk = page.status === 200;
      } catch {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    check(`web ${name} renders 200 signed-out`, pageOk);
  }
  check('signed-out landing shows the real counter endpoint (0 or real plays)', (await call('/api/stats/public', 'GET', undefined)).status === 200);

  // ---- Case 9: secrets audit ----
  let gitignoreOk = false;
  try {
    execSync('git check-ignore apps/server/.env apps/web/.env.local', { cwd: 'C:/DUel1v1s', stdio: 'pipe' });
    gitignoreOk = true;
  } catch {
    gitignoreOk = false;
  }
  check('.env files are git-ignored (no secrets in git)', gitignoreOk);
  let trackedOk = true;
  try {
    const tracked = execSync('git ls-files -- "*\\.env*"', { cwd: 'C:/DUel1v1s', stdio: 'pipe' }).toString().trim();
    trackedOk = tracked.split('\n').every((f) => f === '' || f.endsWith('.env.example'));
  } catch {
    trackedOk = false;
  }
  check('only .env.example files are tracked', trackedOk);

  // ---- cleanup: exact rows this gate created, FK-safe order ----
  // 1. Events written for the throwaway users (covers their signup / daily_view
  //    / submit / feedback / match_started events — analytics never keeps
  //    fake-data residue from a test run).
  const ids = [A.id, B.id, C.id].filter((x): x is string => typeof x === 'string');
  if (ids.length > 0) {
    await db.delete(events).where(inArray(events.userId, ids));
  }
  // 2. A's bot duel match (matchPlayers cascade with it; KERN's user row is
  //    real app data and stays).
  if (botMatchId) {
    await db.delete(matches).where(eq(matches.id, botMatchId));
  }
  // 3. B's rooms and all throwaway accounts (rooms + feedback + submissions
  //    + sessions cascade away with their owners).
  for (const email of [A.email, B.email, C.email]) {
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await db.delete(users).where(eq(users.email, email));
        break;
      } catch {
        if (attempt === 5) throw new Error(`cleanup delete failed after 5 attempts (${email})`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
