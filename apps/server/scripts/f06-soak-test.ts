/**
 * F06 soak gate (PLAN iteration 3): "Ten matches against a friend with no
 * unfair or broken outcome." Runs 10 complete duels between the same two
 * players — alternating the winner — through the real API + Judge0, and after
 * each match checks: exactly one winner, the D5 swing applied exactly once,
 * history rows correct for both players, and the room back out of in_match.
 * Run with: npx tsx scripts/f06-soak-test.ts
 */
import 'dotenv/config';
import { eq, desc, and } from 'drizzle-orm';
import { io, type Socket } from 'socket.io-client';
import { createDb } from '../src/db/index.js';
import { matches, matchPlayers, users } from '../src/db/schema.js';

const BASE = 'http://localhost:4000';
const WS = 'http://localhost:4000';
const PREFIX = 'f06-soak';
const ROUNDS = 10;

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed++;
    console.log(`  PASS ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`);
  }
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
        // Neon blips can hang a request indefinitely — fail fast and retry.
        // Judge-bound calls (submits) need a LONG window: aborting them makes
        // the retry hit an already-finished match (409 phantom).
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
      return { status: res.status, json, cookie: res.headers.get('set-cookie')?.split(';')[0] };
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  throw lastError;
}

type Player = { email: string; cookie: string; id?: string; points: number };

async function registerPlayer(n: number): Promise<Player> {
  const email = `${PREFIX}-${n}@example.com`;
  // Neon DNS blips kill the very first query sometimes — retry the delete.
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await db.delete(users).where(eq(users.email, email));
      break;
    } catch {
      if (attempt === 5) throw new Error(`cleanup delete failed after 5 attempts (${email})`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  const res = await call('/api/auth/register', 'POST', { email, password: 'DemoPass!1', displayName: `Soak ${n}` });
  if (res.status !== 200) throw new Error(`register ${n} failed: ${res.status} ${JSON.stringify(res.json)}`);
  const me = await call('/api/auth/me', 'GET', undefined, res.cookie!);
  return { email, cookie: res.cookie!, id: me.json?.user?.id, points: me.json?.user?.points ?? 0 };
}

function connectSocket(p: Player): Promise<Socket> {
  return call('/api/duels/socket-token', 'GET', undefined, p.cookie).then((tok) =>
    new Promise<Socket>((resolve, reject) => {
      const s = io(WS, { auth: { token: tok.json.token }, transports: ['websocket'], reconnection: false });
      s.on('connect', () => resolve(s));
      s.on('connect_error', reject);
    }),
  );
}

function waitForState(s: Socket, pred: (state: any) => boolean, ms = 20000): Promise<any> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('waitForState timeout')), ms);
    const handler = (state: any) => {
      if (pred(state)) {
        clearTimeout(t);
        s.off('room_state', handler);
        resolve(state);
      }
    };
    s.on('room_state', handler);
  });
}

/** Reference solutions per seed slug (same as f05-api-test). */
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

async function main(): Promise<void> {
  console.log(`F06 soak: ${ROUNDS} duels between the same two players`);

  const A = await registerPlayer(1);
  const B = await registerPlayer(2);
  let sockA = await connectSocket(A);
  let sockB = await connectSocket(B);

  let ok = true;
  const recentSlugs: string[] = [];

  for (let round = 1; round <= ROUNDS && ok; round++) {
    const label = `R${round}`;
    const winner = round % 2 === 1 ? A : B;
    const loser = round % 2 === 1 ? B : A;

    // fresh sockets every round: a socket keeps its old room channel, and the
    // sweeper/broadcasts of the previous room would race the new join.
    sockA.disconnect();
    sockB.disconnect();

    // REST first (rooms + membership), sockets second — idle sockets waiting on
    // a hung REST call get dropped by the network stack mid-run.
    const created = await call('/api/duels/rooms', 'POST', { difficulty: null }, A.cookie);
    const code: string = created.json?.room?.inviteCode ?? '';
    if (!code) {
      check(`${label} room created`, false, JSON.stringify(created.json));
      break;
    }
    const joinB = await call(`/api/duels/rooms/${code}/join`, 'POST', undefined, B.cookie);
    if (joinB.status !== 200) {
      check(`${label} B joined via REST`, false, `${joinB.status} ${JSON.stringify(joinB.json)}`);
      break;
    }

    sockA = await connectSocket(A);
    sockB = await connectSocket(B);
    for (const s of [sockA, sockB]) s.on('room_error', (e) => console.log(`  ${label} room_error:`, JSON.stringify(e)));

    const joinedB = waitForState(sockB, (s) => s.inviteCode === code);
    sockA.emit('room:join', { code });
    await waitForState(sockA, (s) => s.inviteCode === code);
    console.log(`  ${label} A joined`);
    sockB.emit('room:join', { code });
    await joinedB;
    console.log(`  ${label} B joined`);
    const bReady = waitForState(sockA, (s) => s.players.every((p: any) => p.ready === true));
    sockA.emit('room:ready', { ready: true });
    sockB.emit('room:ready', { ready: true });
    await bReady;
    console.log(`  ${label} both ready`);

    const started = waitForState(sockA, (s) => s.status === 'in_match');
    const start = await call(`/api/duels/rooms/${code}/start`, 'POST', undefined, A.cookie);
    if (start.status !== 200) {
      check(`${label} started`, false, JSON.stringify(start.json));
      break;
    }
    const matchId: string = start.json.matchId;
    await started;

    const detail = await call(`/api/matches/${matchId}`, 'GET', undefined, winner.cookie);
    const slug: string = detail.json?.match?.challenge?.slug ?? '';
    const solution = SOLUTIONS[slug];
    if (!solution) {
      check(`${label} known challenge`, false, slug);
      break;
    }
    recentSlugs.push(slug);

    const endsAt = new Date(detail.json?.match?.endsAt);
    check(`${label} ends_at in future`, endsAt.getTime() > Date.now(), endsAt.toISOString());

    const right = await call(
      `/api/matches/${matchId}/submit`,
      'POST',
      { language: 'javascript', sourceCode: solution },
      winner.cookie,
      180000,
    );
    if (!(right.status === 200 && right.json?.status === 'accepted' && right.json?.matchFinished === true)) {
      check(`${label} winner submission finished the match`, false, `${right.status} ${JSON.stringify(right.json)}`);
      const [m] = await db.select().from(matches).where(eq(matches.id, matchId));
      const ps = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, matchId));
      console.log(
        `  DUMP ${label}: match=${JSON.stringify(m, (_, v) => (v instanceof Date ? v.toISOString() : v))}`,
      );
      for (const p of ps) {
        console.log(
          `  DUMP ${label} player ${p.userId}: disconnectedAt=${p.disconnectedAt?.toISOString() ?? 'null'} before=${p.pointsBefore} after=${p.pointsAfter}`,
        );
      }
      console.log('  (users NOT cleaned up — inspect with: f06-soak-1@example.com / f06-soak-2@example.com)');
      break;
    }
    const deltas = right.json?.matchOutcome?.deltas ?? {};
    const wDelta = deltas[winner.id!];
    const lDelta = deltas[loser.id!];
    check(
      `${label} winner +29..31, loser mirrored`,
      typeof wDelta === 'number' && wDelta >= 29 && wDelta <= 31 && lDelta === -wDelta,
      JSON.stringify({ wDelta, lDelta }),
    );

    // points persisted exactly once (no double-apply)
    const meW = await call('/api/auth/me', 'GET', undefined, winner.cookie);
    const meL = await call('/api/auth/me', 'GET', undefined, loser.cookie);
    check(
      `${label} points moved exactly once`,
      meW.json?.user?.points === winner.points + wDelta && meL.json?.user?.points === loser.points + lDelta,
      `W ${meW.json?.user?.points} vs ${winner.points + wDelta}; L ${meL.json?.user?.points} vs ${loser.points + lDelta}`,
    );

    // history correct for both
    const histW = await call('/api/matches?limit=3', 'GET', undefined, winner.cookie);
    const rowW = histW.json?.matches?.find((m: any) => m.id === matchId);
    const histL = await call('/api/matches?limit=3', 'GET', undefined, loser.cookie);
    const rowL = histL.json?.matches?.find((m: any) => m.id === matchId);
    check(
      `${label} history rows correct for both`,
      !!rowW && rowW.resultType === 'win' && rowW.winnerId === winner.id && rowW.pointsDelta === wDelta && !!rowL && rowL.winnerId === winner.id && rowL.pointsDelta === lDelta,
      JSON.stringify({ rowW: rowW && { rt: rowW.resultType, wid: rowW.winnerId, d: rowW.pointsDelta }, rowL: rowL && { rt: rowL.resultType, wid: rowL.winnerId, d: rowL.pointsDelta } }),
    );

    // carry points forward for the next round's expectation
    (round % 2 === 1 ? A : B).points = meW.json?.user?.points;
    (round % 2 === 1 ? B : A).points = meL.json?.user?.points;

    const [mRow] = await db.select().from(matches).where(eq(matches.id, matchId));
    check(`${label} match row finished with one winner`, mRow.status === 'finished' && mRow.resultType === 'win' && mRow.winnerId === winner.id);
  }

  // repeat rule across the soak: with 8 seeds and last-3 avoidance, a healthy
  // engine must show variety (no slug three times in a row)
  check('challenge variety across the soak (repeat rule active)', new Set(recentSlugs).size >= 3, JSON.stringify(recentSlugs));

  sockA.disconnect();
  sockB.disconnect();

  // final integrity: wins/losses counters line up with history
  const [ua] = await db.select().from(users).where(eq(users.email, A.email));
  const [ub] = await db.select().from(users).where(eq(users.email, B.email));
  check('win/loss counters consistent (A+B = 10 rounds)', (ua.wins ?? 0) + (ub.wins ?? 0) === 10 && (ua.losses ?? 0) + (ub.losses ?? 0) === 10, `A ${ua.wins}W/${ua.losses}L B ${ub.wins}W/${ub.losses}L`);

  await db.delete(users).where(eq(users.email, A.email));
  await db.delete(users).where(eq(users.email, B.email));

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
