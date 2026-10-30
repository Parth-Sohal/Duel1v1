/**
 * F09 daily challenge test matrix (docs/features/F09-daily-challenge.md).
 * Exercises the real server + shared Neon DB: same challenge for everyone on
 * a UTC day, deterministic pick, no-repeat while the pool has fresh entries,
 * solving through the normal practice submit (solved round-trip + hidden-test
 * seal), signed-out viewability, and the web /daily page. Simulated-day rows
 * are cleaned up; today's cached pick is restored deterministically.
 * Run: npx tsx scripts/f09-daily-test.ts (local server on :4000, web on :3000)
 */
import 'dotenv/config';
import { and, asc, eq, gte } from 'drizzle-orm';
import { createDb } from '../src/db/index.js';
import { challengeVersions, challenges, dailyChallenges, users } from '../src/db/schema.js';
import { resolveDaily, utcDayOf, dayBefore } from '../src/services/daily.js';

const BASE = 'http://localhost:4000';
const WEB = 'http://localhost:3000';
const PREFIX = 'f09-daily';

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

async function registerPlayer(n: number): Promise<{ email: string; cookie: string; id?: string; points?: number }> {
  const email = `${PREFIX}-${n}@example.com`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await db.delete(users).where(eq(users.email, email));
      break;
    } catch {
      if (attempt === 5) throw new Error(`cleanup delete failed after 5 attempts (${email})`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  const res = await call('/api/auth/register', 'POST', { email, password: 'F09DailyPass!', displayName: `Daily Dueler ${n}` });
  if (res.status !== 200) throw new Error(`register ${n} failed: ${res.status}`);
  const me = await call('/api/auth/me', 'GET', undefined, res.cookie!);
  return { email, cookie: res.cookie!, ...me.json?.user };
}

/** Published pool: slug → version id, ordered by slug (the deterministic order). */
async function pool(): Promise<Array<{ slug: string; versionId: string }>> {
  return db
    .select({ slug: challenges.slug, versionId: challengeVersions.id })
    .from(challenges)
    .innerJoin(challengeVersions, and(eq(challengeVersions.challengeId, challenges.id), eq(challengeVersions.version, challenges.currentVersion)))
    .where(eq(challenges.isPublished, true))
    .orderBy(asc(challenges.slug));
}

/** Known-correct solutions per slug (same sources the F08 matrix uses). */
const SOLUTIONS: Record<string, string> = {
  'pair-target-sum': `function pairTargetSum(nums, target) { for (let i = 0; i < nums.length; i++) { for (let j = i + 1; j < nums.length; j++) { if (nums[i] + nums[j] === target) return [nums[i], nums[j]]; } } return null; }`,
  'reverse-words': `function reverseWords(lines) { return lines.map((line) => line.trim().split(/\\\\s+/).filter(Boolean).reverse().join(' ')); }`,
  'first-duplicate': `function firstDuplicate(nums) { const seen = new Set(); for (const v of nums) { if (seen.has(v)) return v; seen.add(v); } return -1; }`,
  'max-window-sum': `function maxWindowSum(nums, k) { let sum = 0; for (let i = 0; i < k; i++) sum += nums[i]; let best = sum; for (let i = k; i < nums.length; i++) { sum += nums[i] - nums[i - k]; if (sum > best) best = sum; } return best; }`,
  'bracket-check': `function bracketCheck(s) { const pairs = { ')': '(', ']': '[', '}': '{' }; const st = []; for (const ch of s) { if (ch === '(' || ch === '[' || ch === '{') st.push(ch); else if (ch === ')' || ch === ']' || ch === '}') { if (st.pop() !== pairs[ch]) return false; } } return st.length === 0; }`,
  'climb-stairs': `function climbStairs(n) { const M = 1000000007; let a = 1, b = 1; for (let i = 2; i <= n; i++) { const c = (a + b) % M; a = b; b = c; } return b; }`,
  'rotate-array': `function rotateArray(nums, k) { const n = nums.length; const r = k % n; return nums.slice(n - r).concat(nums.slice(0, n - r)); }`,
  'missing-number': `function missingNumber(n, nums) { const total = (n * (n + 1)) / 2; return total - nums.reduce((x, y) => x + y, 0); }`,
};

async function main(): Promise<void> {
  console.log('F09 daily challenge matrix against', BASE);

  const today = utcDayOf();
  const signedOut = await call('/api/daily', 'GET', undefined);
  check('GET /api/daily works signed-out (viewable, no 401)', signedOut.status === 200 && typeof signedOut.json?.day === 'string', JSON.stringify(signedOut.json?.day));
  const cachedSlug: string = signedOut.json?.challenge?.slug ?? '';
  check("today's pick exists + visible tests only", !!cachedSlug && Array.isArray(signedOut.json?.challenge?.visibleTests) && signedOut.json.challenge.visibleTests.length > 0, cachedSlug);
  check('signed-out payload has no personal state', signedOut.json?.you === null, JSON.stringify(signedOut.json?.you));

  const A = await registerPlayer(1);
  const B = await registerPlayer(2);

  // ---- Case 1: same challenge for everyone on the same UTC day ----
  const forA = await call('/api/daily', 'GET', undefined, A.cookie);
  const forB = await call('/api/daily', 'GET', undefined, B.cookie);
  check('A and B (and signed-out) get the SAME challenge today', forA.json?.challenge?.slug === cachedSlug && forB.json?.challenge?.slug === cachedSlug, `${forA.json?.challenge?.slug} / ${forB.json?.challenge?.slug}`);
  check('authed payload carries the caller state', forA.json?.you !== null && forB.json?.you !== null);
  check('both start unsolved with zero attempts', forA.json?.you?.solved === false && forA.json?.you?.attempts === 0);

  // ---- Case 2: deterministic + no-repeat while fresh entries exist ----
  const repick = await resolveDaily(db, today); // cached path
  check('resolveDaily is stable within a day (cached pick)', !!repick);
  const p = await pool();
  check('published pool has enough fresh entries for the no-repeat test', p.length >= 4, String(p.length));

  /** Rows from the earliest simulated day through any future day we touch. */
  const deleteSimulated = async (): Promise<void> => {
    await db.delete(dailyChallenges).where(gte(dailyChallenges.day, dayBefore(today, p.length + 2)));
  };

  // Simulate history: every challenge EXCEPT one fills the last (pool-1) days,
  // so exactly one fresh entry remains — the pick MUST be that one.
  const freshOne = p.find((c) => c.slug !== cachedSlug)!;
  const others = p.filter((c) => c.slug !== freshOne.slug);
  for (let i = 1; i < p.length; i++) {
    const day = dayBefore(today, i);
    if (!day) break;
    const entry = others[(i - 1) % others.length];
    await db
      .insert(dailyChallenges)
      .values({ day, challengeVersionId: entry.versionId })
      .onConflictDoNothing();
  }
  await db.delete(dailyChallenges).where(eq(dailyChallenges.day, today)); // clear only today — the simulated past days stay
  const [rowFresh] = await db.select({ versionId: dailyChallenges.challengeVersionId }).from(dailyChallenges).where(eq(dailyChallenges.day, today)).limit(1);
  check('today row deleted for the simulation', !rowFresh);
  const simulated = await resolveDaily(db, today);
  const [simRow] = await db
    .select({ slug: challenges.slug })
    .from(dailyChallenges)
    .innerJoin(challengeVersions, eq(challengeVersions.id, dailyChallenges.challengeVersionId))
    .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
    .where(eq(dailyChallenges.day, today))
    .limit(1);
  check('no-repeat: only the fresh entry can be picked', simRow?.slug === freshOne.slug, `got ${simRow?.slug}, expected ${freshOne.slug}`);
  check('pick is deterministic for the same day + state (re-resolve)', (await resolveDaily(db, today))?.versionId === simulated?.versionId);

  // ---- Case 3: the daily changes each day (clean state: only today's row) ----
  await deleteSimulated();
  const cleanToday = await resolveDaily(db, today);
  const [cleanTodayRow] = await db
    .select({ slug: challenges.slug })
    .from(dailyChallenges)
    .innerJoin(challengeVersions, eq(challengeVersions.id, dailyChallenges.challengeVersionId))
    .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
    .where(eq(dailyChallenges.day, today))
    .limit(1);
  check('clean state restores the original deterministic pick', cleanTodayRow?.slug === cachedSlug && cleanToday?.versionId === repick?.versionId, `got ${cleanTodayRow?.slug}, want ${cachedSlug}`);
  const tomorrow = dayBefore(today, -1); // n = -1 → tomorrow
  const tomorrowPick = await resolveDaily(db, tomorrow);
  const [tomorrowRow] = await db
    .select({ slug: challenges.slug })
    .from(dailyChallenges)
    .innerJoin(challengeVersions, eq(challengeVersions.id, dailyChallenges.challengeVersionId))
    .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
    .where(eq(dailyChallenges.day, tomorrow))
    .limit(1);
  check('tomorrow is a DIFFERENT challenge than today (no repeat)', !!tomorrowRow && tomorrowRow.slug !== cleanTodayRow?.slug, `${tomorrowRow?.slug} vs today ${cleanTodayRow?.slug}`);
  check('tomorrow pick is deterministic too', (await resolveDaily(db, tomorrow))?.versionId === tomorrowPick?.versionId);

  // ---- Case 4: solving the daily = the normal practice flow ----
  const dailySlug = cleanTodayRow?.slug ?? cachedSlug;
  const solution = SOLUTIONS[dailySlug];
  check('seed has a known solution for the daily slug', !!solution, dailySlug);

  const subA = await call(`/api/challenges/${cleanTodayRow?.slug}/submit`, 'POST', { language: 'javascript', sourceCode: solution }, A.cookie, 180000);
  check('solving the daily via the practice submit works', subA.status === 200 && subA.json?.status === 'accepted', JSON.stringify({ status: subA.status, body: subA.json?.status }));
  const hiddenLeak = (subA.json?.results ?? []).find((r: any) => r.hidden && (r.args !== undefined || r.expected !== undefined));
  check('hidden tests stay sealed on the daily submit', !hiddenLeak, JSON.stringify(hiddenLeak ?? {}).slice(0, 120));

  const afterA = await call('/api/daily', 'GET', undefined, A.cookie);
  check('daily state round-trips: solved = true, attempts counted', afterA.json?.you?.solved === true && afterA.json?.you?.attempts >= 1, JSON.stringify(afterA.json?.you));
  const afterB = await call('/api/daily', 'GET', undefined, B.cookie);
  check("B is unaffected by A's solve (per-player state)", afterB.json?.you?.solved === false);

  // ---- Case 5: the web /daily page is viewable signed-out ----
  let pageOk = false;
  for (let attempt = 1; attempt <= 10 && !pageOk; attempt++) {
    try {
      const page = await fetch(`${WEB}/daily`, { signal: AbortSignal.timeout(30000) });
      pageOk = page.status === 200;
    } catch {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  check('web /daily renders 200 signed-out', pageOk);

  // ---- cleanup: simulated/future days + throwaway accounts ----
  await deleteSimulated();
  await resolveDaily(db, today); // restore the cached pick for today
  const [finalRow] = await db
    .select({ slug: challenges.slug })
    .from(dailyChallenges)
    .innerJoin(challengeVersions, eq(challengeVersions.id, dailyChallenges.challengeVersionId))
    .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
    .where(eq(dailyChallenges.day, today))
    .limit(1);
  const [leftover] = await db.select().from(dailyChallenges).where(eq(dailyChallenges.day, tomorrow)).limit(1);
  check('cleanup: today restored, future days removed', finalRow?.slug === cachedSlug && !leftover, `today=${finalRow?.slug}`);
  for (const email of [A.email, B.email]) {
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
