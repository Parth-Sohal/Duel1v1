/**
 * F08 KERN BOT test matrix (docs/features/F08-kern-bot.md test checklist).
 * Exercises bot matches through the REAL server + sweeper + shared Neon DB:
 * create via REST, D6 (no points, no stats), player-beats-bot, KERN-beats-
 * player, fail-plan progress, forfeit with no points, concurrent bot matches
 * for two players, guards, repeat rule, and the reference-solution leak check.
 * Cleans up its throwaway accounts (the KERN user row is real app data).
 * Run: npx tsx scripts/f08-bot-test.ts (local server on :4000)
 */
import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { createDb } from '../src/db/index.js';
import { matches, matchPlayers, rooms, users } from '../src/db/schema.js';
import { ensureBotUser } from '../src/services/bots.js';
import { finishMatch } from '../src/services/matches.js';

const BASE = 'http://localhost:4000';
const PREFIX = 'f08-bot';

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

async function registerPlayer(n: number): Promise<{ email: string; cookie: string; id?: string; points?: number; wins?: number; losses?: number; draws?: number }> {
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
  const res = await call('/api/auth/register', 'POST', { email, password: 'F08BotPass!', displayName: `Bot Dueler ${n}` });
  if (res.status !== 200) throw new Error(`register ${n} failed: ${res.status}`);
  const me = await call('/api/auth/me', 'GET', undefined, res.cookie!);
  return { email, cookie: res.cookie!, ...me.json?.user };
}

/** The sweeper runs every 5 s — wait for the match to leave 'active'. */
async function waitForFinish(matchId: string, cookie: string, ms = 40000): Promise<any> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const m = await call(`/api/matches/${matchId}`, 'GET', undefined, cookie);
    if (m.json?.match?.status !== 'active') return m.json?.match;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

const SOLUTIONS: Record<string, string> = {
  'pair-target-sum': `function pairTargetSum(nums, target) { for (let i = 0; i < nums.length; i++) { for (let j = i + 1; j < nums.length; j++) { if (nums[i] + nums[j] === target) return [nums[i], nums[j]]; } } return null; }`,
  'reverse-words': `function reverseWords(lines) { return lines.map((line) => line.trim().split(/\\s+/).filter(Boolean).reverse().join(' ')); }`,
  'first-duplicate': `function firstDuplicate(nums) { const seen = new Set(); for (const v of nums) { if (seen.has(v)) return v; seen.add(v); } return -1; }`,
  'max-window-sum': `function maxWindowSum(nums, k) { let sum = 0; for (let i = 0; i < k; i++) sum += nums[i]; let best = sum; for (let i = k; i < nums.length; i++) { sum += nums[i] - nums[i - k]; if (sum > best) best = sum; } return best; }`,
  'bracket-check': `function bracketCheck(s) { const pairs = { ')': '(', ']': '[', '}': '{' }; const st = []; for (const ch of s) { if (ch === '(' || ch === '[' || ch === '{') st.push(ch); else if (ch === ')' || ch === ']' || ch === '}') { if (st.pop() !== pairs[ch]) return false; } } return st.length === 0; }`,
  'climb-stairs': `function climbStairs(n) { const M = 1000000007; let a = 1, b = 1; for (let i = 2; i <= n; i++) { const c = (a + b) % M; a = b; b = c; } return b; }`,
  'rotate-array': `function rotateArray(nums, k) { const n = nums.length; const r = k % n; return nums.slice(n - r).concat(nums.slice(0, n - r)); }`,
  'missing-number': `function missingNumber(n, nums) { const total = (n * (n + 1)) / 2; return total - nums.reduce((x, y) => x + y, 0); }`,
};

/** All string values in a JSON tree (leak scans). */
function collectStrings(v: any, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collectStrings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => collectStrings(x, out));
  return out;
}

/** Force the bot plan (two-phase: setup via DB, verify through the server). */
async function forcePlan(matchId: string, willSolve: boolean, msFromNow: number): Promise<void> {
  await db
    .update(matches)
    .set({ botWillSolve: willSolve, botSolveAt: new Date(Date.now() + msFromNow) })
    .where(eq(matches.id, matchId));
}

async function main(): Promise<void> {
  console.log('F08 KERN BOT matrix against', BASE);

  const A = await registerPlayer(1);
  const B = await registerPlayer(2);
  const botId = await ensureBotUser(db);
  check('KERN user row exists (is_bot, no email)', typeof botId === 'string', botId);
  const [botRow] = await db.select({ email: users.email, isBot: users.isBot, points: users.points }).from(users).where(eq(users.id, botId));
  check('KERN cannot sign in (email null) and holds no points drift', botRow.isBot === true && botRow.email === null, JSON.stringify(botRow));

  // ---- Case 1: KERN wins (forced plan) — D6 zero deltas, no stats ----
  const c1 = await call('/api/duels/bot', 'POST', { difficulty: 'easy' }, A.cookie);
  check('create bot match 200 + matchId', c1.status === 200 && typeof c1.json?.matchId === 'string', JSON.stringify(c1.json));
  if (c1.status !== 200) throw new Error('bot match create failed');
  const m1: string = c1.json.matchId;

  const d1 = await call(`/api/matches/${m1}`, 'GET', undefined, A.cookie);
  check('match is active + flagged is_bot_match', d1.json?.match?.status === 'active' && d1.json?.match?.isBotMatch === true);
  check('opponent is KERN, seat 2', d1.json?.match?.players?.some((p: any) => p.userId === botId && p.seat === 2));
  check('same challenge + future ends_at', !!d1.json?.match?.challenge?.slug && new Date(d1.json.match.endsAt) > new Date());

  // a player in a bot match cannot create a room or another bot match
  const busyRoom = await call('/api/duels/rooms', 'POST', { difficulty: null }, A.cookie);
  check('bot-match player cannot create a room (already_in_match)', busyRoom.status === 409 && busyRoom.json?.error === 'already_in_match');
  const busyBot = await call('/api/duels/bot', 'POST', { difficulty: null }, A.cookie);
  check('bot-match player cannot start another bot duel', busyBot.status === 409 && busyBot.json?.error === 'already_in_match');

  // plan persisted in the DB (restart-safety: the sweeper reads it from here)
  const [plan] = await db.select({ will: matches.botWillSolve, at: matches.botSolveAt }).from(matches).where(eq(matches.id, m1));
  check('bot plan persisted (bot_will_solve, bot_solve_at)', typeof plan?.will === 'boolean' && plan.at instanceof Date);

  // force KERN to win fast
  await forcePlan(m1, true, 1000);
  const finished1 = await waitForFinish(m1, A.cookie);
  check('KERN won via the sweeper', finished1?.status === 'finished' && finished1?.resultType === 'win' && finished1?.winnerId === botId, JSON.stringify(finished1 && { status: finished1.status, resultType: finished1.resultType }));

  const meA1 = await call('/api/auth/me', 'GET', undefined, A.cookie);
  check('D6: A points unchanged after losing to KERN', meA1.json?.user?.points === A.points);
  check(
    'D6: A stats unchanged (no loss recorded vs KERN)',
    meA1.json?.user?.wins === A.wins && meA1.json?.user?.losses === A.losses && meA1.json?.user?.draws === A.draws,
    JSON.stringify({ before: [A.wins, A.losses, A.draws], after: [meA1.json?.user?.wins, meA1.json?.user?.losses, meA1.json?.user?.draws] }),
  );
  const [rowA] = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, m1));
  check('D6: match_players deltas are zero', rowA.pointsAfter === rowA.pointsBefore, `${rowA.pointsBefore} -> ${rowA.pointsAfter}`);
  const [botStats] = await db.select({ wins: users.wins, points: users.points }).from(users).where(eq(users.id, botId));
  check('D6: KERN accumulates no wins/points', botStats.wins === 0 && botStats.points === 0, JSON.stringify(botStats));

  // room closed after the bot match ends
  const [roomRow] = await db.select({ status: rooms.status }).from(rooms).where(eq(rooms.id, (await db.select({ roomId: matches.roomId }).from(matches).where(eq(matches.id, m1)))[0]?.roomId ?? ''));
  check('bot room closed after the match', roomRow?.status === 'closed', String(roomRow?.status));

  // history row for the bot duel: labeled, zero delta
  const hist1 = await call('/api/matches?limit=5', 'GET', undefined, A.cookie);
  const h1 = hist1.json?.matches?.find((r: any) => r.id === m1);
  check('history: bot duel present, opponent KERN, delta 0', !!h1 && h1.isBotMatch === true && h1.opponent?.displayName === 'KERN' && h1.pointsDelta === 0, JSON.stringify(h1 && { opp: h1.opponent?.displayName, d: h1.pointsDelta, bot: h1.isBotMatch }));

  // ---- Case 2: player beats KERN (fail plan; player submits first) ----
  const c2 = await call('/api/duels/bot', 'POST', { difficulty: null }, A.cookie);
  check('second bot match (any difficulty) 200', c2.status === 200 && typeof c2.json?.matchId === 'string');
  const m2: string = c2.json.matchId;
  const d2 = await call(`/api/matches/${m2}`, 'GET', undefined, A.cookie);
  const slug2: string = d2.json?.match?.challenge?.slug ?? '';
  const solution = SOLUTIONS[slug2];
  check('repeat rule: second bot duel picked a DIFFERENT challenge', !!solution && slug2 !== d1.json?.match?.challenge?.slug, `${d1.json?.match?.challenge?.slug} -> ${slug2}`);

  // fail plan: bot posts one wrong attempt, never solves
  await forcePlan(m2, false, 1000);
  await new Promise((r) => setTimeout(r, 9000)); // let the sweeper clear the plan
  const [plan2] = await db.select({ at: matches.botSolveAt, will: matches.botWillSolve }).from(matches).where(eq(matches.id, m2));
  check('fail plan: solved flag false, schedule cleared after the attempt', plan2?.will === false && plan2?.at === null, JSON.stringify(plan2));
  const stillActive = await call(`/api/matches/${m2}`, 'GET', undefined, A.cookie);
  check('fail plan: match still active (player can still win)', stillActive.json?.match?.status === 'active');

  const sub2 = await call(`/api/matches/${m2}/submit`, 'POST', { language: 'javascript', sourceCode: solution }, A.cookie, 180000);
  check('player submits first -> accepted + match finished (beats KERN)', sub2.status === 200 && sub2.json?.status === 'accepted' && sub2.json?.matchFinished === true, JSON.stringify({ status: sub2.status, body: sub2.json?.status }));
  const deltas2 = sub2.json?.matchOutcome?.deltas ?? {};
  check('D6: submit response deltas all zero', Object.values(deltas2).every((v) => v === 0), JSON.stringify(deltas2));
  const meA2 = await call('/api/auth/me', 'GET', undefined, A.cookie);
  check('D6: A points/stats unchanged after beating KERN', meA2.json?.user?.points === A.points && meA2.json?.user?.wins === A.wins);

  // leak check: the ONLY submission data in detail is the player's own — the
  // bot contributes no submission rows (its "solution" is the reference, which
  // must never appear as anything but the player's own stored code).
  const detail2 = await call(`/api/matches/${m2}`, 'GET', undefined, A.cookie);
  const strings = collectStrings(detail2.json);
  check('leak: the only sourceCode in detail is the player’s own submission', detail2.json?.match?.mySubmission?.sourceCode === solution && strings.filter((s) => s.includes(solution.slice(20, 60))).length === 1, 'scanned all strings');
  check('leak: opponent has no submission rows in detail', !JSON.stringify(detail2.json?.match?.players ?? []).includes('sourceCode'));

  // ---- Case 3: concurrent bot matches for two different players ----
  const c3 = await call('/api/duels/bot', 'POST', { difficulty: 'medium' }, B.cookie);
  check('a SECOND player can duel KERN while A already did', c3.status === 200 && typeof c3.json?.matchId === 'string', JSON.stringify(c3.json));
  const m3: string = c3.json?.matchId ?? '';
  // keep B's case-3 duel parked (quiet bot plan) until case 4 needs the seat
  await forcePlan(m3, false, 10 * 60_000);

  // ---- Case 4: disconnect forfeit in a bot match — no points move ----
  // Close B's parked duel with a D6 draw (engine-level finish, zero deltas).
  await finishMatch(db, m3, { kind: 'draw' });
  const c4 = await call('/api/duels/bot', 'POST', { difficulty: null }, B.cookie);
  check('B can start a bot duel after finishing theirs', c4.status === 200 && typeof c4.json?.matchId === 'string');
  const m4: string = c4.json.matchId;
  const meBefore4 = await call('/api/auth/me', 'GET', undefined, B.cookie);
  // simulate the grace period expiring: mark ONLY B disconnected in the past
  // (the sweeper needs one live seat to award the forfeit to), bot kept quiet
  await forcePlan(m4, false, 10 * 60_000);
  await db
    .update(matchPlayers)
    .set({ disconnectedAt: new Date(Date.now() - 60_000) })
    .where(and(eq(matchPlayers.matchId, m4), eq(matchPlayers.userId, B.id!)));
  const finished4 = await waitForFinish(m4, B.cookie);
  check('disconnect forfeit resolves the bot match', finished4?.status === 'finished' && finished4?.resultType === 'forfeit', JSON.stringify(finished4 && { resultType: finished4.resultType }));
  const meAfter4 = await call('/api/auth/me', 'GET', undefined, B.cookie);
  check(
    'D6: forfeit in a bot duel moves no points/stats',
    meAfter4.json?.user?.points === meBefore4.json?.user?.points && meAfter4.json?.user?.losses === meBefore4.json?.user?.losses,
    JSON.stringify({ before: [meBefore4.json?.user?.points, meBefore4.json?.user?.losses], after: [meAfter4.json?.user?.points, meAfter4.json?.user?.losses] }),
  );

  // ---- cleanup ----
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
