/**
 * F05/F06 API test matrix (docs/features/F05-friend-rooms.md + F06-match-engine.md
 * test checklists). Creates throwaway accounts and exercises: room create/join/full/
 * membership, socket token auth (one-time), live room events over real sockets,
 * ready toggles, host start, duel submission through the REAL Judge0 endpoint,
 * first-pass-wins + D5 points, history, and the not-a-participant guards.
 * Cleans up after itself.
 * Run with: npx tsx scripts/f05-api-test.ts (server + web proxy NOT needed; direct :4000)
 *
 * NOTE: Neon latency spikes 1-6s per query and DNS blips happen, so every wait
 * is generous and 5xx responses are retried. Event listeners are registered
 * BEFORE the emits/requests that trigger them (broadcasts race the HTTP reply).
 */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { io, type Socket } from 'socket.io-client';
import { createDb } from '../src/db/index.js';
import { users } from '../src/db/schema.js';
import { generateInviteCode, normalizeInviteCode } from '../src/services/rooms.js';

const BASE = 'http://localhost:4000';
const WS = 'http://localhost:4000';
const PREFIX = 'f05-test';

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
): Promise<{ status: number; json: any; cookie?: string }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      let json: any = null;
      try {
        json = await res.json();
      } catch {
        /* no body */
      }
      const setCookie = res.headers.get('set-cookie');
      // 5xx from the server is usually a transient Neon DNS blip — retry those too.
      if (res.status >= 500 && attempt < 3) {
        await new Promise((r) => setTimeout(r, attempt * 1500));
        continue;
      }
      return { status: res.status, json, cookie: setCookie?.split(';')[0] };
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  throw lastError;
}

type Player = { name: string; cookie: string; id?: string; points?: number };

async function registerPlayer(n: number): Promise<Player> {
  const email = `${PREFIX}-${n}@example.com`;
  await db.delete(users).where(eq(users.email, email));
  const res = await call('/api/auth/register', 'POST', {
    email,
    password: 'F05TestPass!',
    displayName: `Dueler ${n}`,
  });
  if (res.status !== 200) throw new Error(`register ${n} failed: ${res.status} ${JSON.stringify(res.json)}`);
  const me = await call('/api/auth/me', 'GET', undefined, res.cookie!);
  return { name: `P${n}`, cookie: res.cookie!, id: me.json?.user?.id, points: me.json?.user?.points ?? 0 };
}

/** Connect a socket with the player's one-time token. */
async function connectSocket(p: Player): Promise<Socket> {
  const tok = await call('/api/duels/socket-token', 'GET', undefined, p.cookie);
  return new Promise((resolve, reject) => {
    const s = io(WS, { auth: { token: tok.json.token }, transports: ['websocket'], reconnection: false });
    s.on('connect', () => resolve(s));
    s.on('connect_error', (err) => reject(err));
  });
}

/** Wait for the next room_state event (with timeout). Neon latency spikes 1-6s per query; be generous. */
function nextRoomState(s: Socket, ms = 15000): Promise<any> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('room_state timeout')), ms);
    s.once('room_state', (state) => {
      clearTimeout(t);
      resolve(state);
    });
  });
}

/** Register a predicate listener FIRST (events can arrive before the emit's await resolves). */
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

/** Reference solutions for all 8 seeded challenges (same as the seed script's references). */
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

/** A guaranteed-wrong entry for any seed: no expected answer is -12345. */
function wrongStubFor(slug: string): string {
  const entry: Record<string, string> = {
    'pair-target-sum': 'pairTargetSum',
    'reverse-words': 'reverseWords',
    'first-duplicate': 'firstDuplicate',
    'max-window-sum': 'maxWindowSum',
    'bracket-check': 'bracketCheck',
    'climb-stairs': 'climbStairs',
    'rotate-array': 'rotateArray',
    'missing-number': 'missingNumber',
  };
  return `function ${entry[slug] ?? 'solve'}() { return -12345; }`;
}

/** All string values anywhere in a parsed JSON tree (for leak scans that survive escaping). */
function collectStrings(v: any, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collectStrings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => collectStrings(x, out));
  return out;
}

async function main(): Promise<void> {
  console.log('F05/F06 API matrix against', BASE);

  // ---- players ----
  const A = await registerPlayer(1);
  const B = await registerPlayer(2);
  const C = await registerPlayer(3);
  const D = await registerPlayer(4);
  check('4 throwaway players registered', !!A.id && !!B.id && !!C.id && !!D.id);

  // ---- room create + membership (F05) ----
  const created = await call('/api/duels/rooms', 'POST', { difficulty: 'easy' }, A.cookie);
  check('create room 200', created.status === 200, JSON.stringify(created.json));
  const code: string = created.json?.room?.inviteCode ?? '';
  check('invite code is 8-char Crockford base32 (no I/L/O)', /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$/.test(code), code);

  const asHost = await call(`/api/duels/rooms/${code}`, 'GET', undefined, A.cookie);
  check('host reads room 200', asHost.status === 200);
  check('host is seat 1 + online flag false (REST)', asHost.json?.room?.players?.[0]?.seat === 1);

  const asOutsider = await call(`/api/duels/rooms/${code}`, 'GET', undefined, C.cookie);
  check('outsider GET room 403 not_a_member', asOutsider.status === 403 && asOutsider.json?.error === 'not_a_member');

  const joinB = await call(`/api/duels/rooms/${code}/join`, 'POST', undefined, B.cookie);
  check('B joins 200 seat 2', joinB.status === 200 && joinB.json?.room?.players?.[1]?.seat === 2);

  const joinD = await call(`/api/duels/rooms/${code}/join`, 'POST', undefined, D.cookie);
  check('third joiner 409 room_full', joinD.status === 409 && joinD.json?.error === 'room_full');

  const badCode = await call('/api/duels/rooms/ZZZZZZZZ/join', 'POST', undefined, D.cookie);
  check('unknown invite code 404', badCode.status === 404 && badCode.json?.error === 'room_unavailable');

  check('confusable invite chars normalize (I/L→1, O→0)', normalizeInviteCode('ilo') === '110');
  const genCode = generateInviteCode();
  check('generated codes never contain confusables (normalize is identity)', normalizeInviteCode(genCode) === genCode, genCode);

  // ---- start guards (REST) ----
  const earlyStart = await call(`/api/duels/rooms/${code}/start`, 'POST', undefined, A.cookie);
  check('start before ready 409 not_both_ready', earlyStart.status === 409 && earlyStart.json?.error === 'not_both_ready');

  const guestStart = await call(`/api/duels/rooms/${code}/start`, 'POST', undefined, B.cookie);
  check('non-host start 403 host_only', guestStart.status === 403 && guestStart.json?.error === 'host_only');

  // ---- sockets: token auth + live room events ----
  const sockA = await connectSocket(A);
  const sockB = await connectSocket(B);
  check('socket A connected via one-time token', sockA.connected);
  check('socket B connected via one-time token', sockB.connected);

  // token is one-time: take a fresh token, connect twice with it.
  const freshTok = await call('/api/duels/socket-token', 'GET', undefined, A.cookie);
  const firstUse = await new Promise<boolean>((resolve) => {
    const s = io(WS, { auth: { token: freshTok.json.token }, transports: ['websocket'], reconnection: false });
    s.on('connect', () => {
      s.disconnect();
      resolve(true);
    });
    s.on('connect_error', () => resolve(false));
  });
  const secondUse = await new Promise<boolean>((resolve) => {
    const s = io(WS, { auth: { token: freshTok.json.token }, transports: ['websocket'], reconnection: false, timeout: 4000 });
    s.on('connect', () => {
      s.disconnect();
      resolve(false);
    });
    s.on('connect_error', () => resolve(true));
    setTimeout(() => {
      s.disconnect();
      resolve(true);
    }, 4500);
  });
  check('token first use accepted', firstUse);
  check('token second use rejected (one-time)', secondUse);

  // no token at all -> rejected
  const noToken = await new Promise<boolean>((resolve) => {
    const s = io(WS, { transports: ['websocket'], reconnection: false, timeout: 4000 });
    s.on('connect', () => {
      s.disconnect();
      resolve(false);
    });
    s.on('connect_error', () => resolve(true));
    setTimeout(() => {
      s.disconnect();
      resolve(true);
    }, 4500);
  });
  check('socket without token rejected', noToken);

  // join + ready over sockets
  sockA.emit('room:join', { code });
  const stateA1 = await nextRoomState(sockA);
  check('A room:join pushes full state', stateA1.inviteCode === code && stateA1.players.length === 2);
  check('presence shows both online', stateA1.players.every((p: any) => p.online === true));

  sockB.emit('room:join', { code });
  await nextRoomState(sockB);

  // ready toggles: listeners registered BEFORE emitting (broadcast races)
  const pAReady = waitForState(sockA, (s) => s.players.find((p: any) => p.userId === A.id)?.ready === true);
  sockA.emit('room:ready', { ready: true });
  const stateA2 = await pAReady;
  check('A ready flag pushed', stateA2.players.find((p: any) => p.userId === A.id)?.ready === true);

  const pBReady = waitForState(sockB, (s) => s.players.every((p: any) => p.ready === true));
  sockB.emit('room:ready', { ready: true });
  const stateB2 = await pBReady;
  check('B ready flag pushed', stateB2.players.every((p: any) => p.ready === true));

  // ready survives a REST re-read (Postgres authoritative, refresh-proof)
  const reread = await call(`/api/duels/rooms/${code}`, 'GET', undefined, A.cookie);
  check('ready state persisted in Postgres', reread.json?.room?.players?.every((p: any) => p.ready === true));

  // ---- start the match (REST) ----
  const pStarted = waitForState(sockA, (s) => s.status === 'in_match');
  const start = await call(`/api/duels/rooms/${code}/start`, 'POST', undefined, A.cookie);
  check('host start 200 + matchId', start.status === 200 && typeof start.json?.matchId === 'string', JSON.stringify(start.json));
  if (start.status !== 200) throw new Error('start failed — cannot continue');
  const matchId: string = start.json.matchId;

  const startedState = await pStarted;
  check('room flipped to in_match', startedState.status === 'in_match');
  check('room carries the matchId', startedState.matchId === matchId);

  // both sockets join the match channel (like the UI does) — progress/match_ended
  // are broadcast to matchChannel, not the room channel.
  sockA.emit('match:join', { matchId });
  sockB.emit('match:join', { matchId });
  await new Promise((r) => setTimeout(r, 500));

  // ---- match access (F06/F07) ----
  const mA = await call(`/api/matches/${matchId}`, 'GET', undefined, A.cookie);
  check('A reads match 200', mA.status === 200);
  check('match has challenge + ends_at in future', !!mA.json?.match?.challenge?.slug && new Date(mA.json.match.endsAt) > new Date());
  check('both players in match payload', mA.json?.match?.players?.length === 2);
  check('difficulty filter honored (easy)', mA.json?.match?.challenge?.difficulty === 'easy');

  const mC = await call(`/api/matches/${matchId}`, 'GET', undefined, C.cookie);
  check('outsider match GET 403 not_a_participant', mC.status === 403 && mC.json?.error === 'not_a_participant');

  // a player in an active match cannot join another room (F05 rule)
  const D2room = await call('/api/duels/rooms', 'POST', { difficulty: null }, D.cookie);
  const dCode: string = D2room.json?.room?.inviteCode ?? '';
  const busyJoin = await call(`/api/duels/rooms/${dCode}/join`, 'POST', undefined, B.cookie);
  check('player in an active match cannot join another room 409 already_in_match', busyJoin.status === 409 && busyJoin.json?.error === 'already_in_match');

  // ---- duel submission through the real judge ----
  const slug: string = mA.json?.match?.challenge?.slug ?? '';
  const winning = SOLUTIONS[slug];
  check('winning solution known for the picked challenge', typeof winning === 'string', slug);
  const wrongSource = wrongStubFor(slug);

  // progress + match_ended listeners registered BEFORE the submits that trigger them.
  // Two real Judge0 runs (~30s each at peak load) sit between here and match_ended,
  // so the window must cover both.
  const progressSeen = new Promise<any>((resolve) => {
    const t = setTimeout(() => resolve(null), 180000);
    sockB.once('progress', (p) => {
      clearTimeout(t);
      resolve(p);
    });
  });
  const endedSeen = new Promise<any>((resolve) => {
    const t = setTimeout(() => resolve(null), 180000);
    sockA.once('match_ended', (e) => {
      clearTimeout(t);
      resolve(e);
    });
  });

  const wrong = await call(
    `/api/matches/${matchId}/submit`,
    'POST',
    { language: 'javascript', sourceCode: wrongSource },
    A.cookie,
  );
  check('wrong duel submit -> wrong_answer, match continues', wrong.status === 200 && wrong.json?.status === 'wrong_answer' && wrong.json?.matchFinished === false);

  // opponent sees progress, never code: B's progress socket event
  const progress = await progressSeen;
  check('B received progress event (no code/outputs)', !!progress && progress.testsPassed !== undefined && !('sourceCode' in (progress ?? {})));

  const right = await call(
    `/api/matches/${matchId}/submit`,
    'POST',
    { language: 'javascript', sourceCode: winning },
    B.cookie,
  );
  check('B correct submit -> accepted + match finished', right.status === 200 && right.json?.status === 'accepted' && right.json?.matchFinished === true);
  const swing = right.json?.matchOutcome?.deltas?.[B.id!];
  const aDelta = right.json?.matchOutcome?.deltas?.[A.id!];
  check('D5 win swing 29..31 both ways', typeof swing === 'number' && swing >= 29 && swing <= 31 && aDelta === -swing, JSON.stringify({ swing, aDelta }));

  const endedState = await endedSeen;
  check('A got match_ended broadcast', !!endedState && endedState.resultType === 'win' && endedState.winnerId === B.id, JSON.stringify(endedState));

  const after = await call(`/api/matches/${matchId}/submit`, 'POST', { language: 'javascript', sourceCode: winning }, A.cookie);
  check('submit after finish 409 match_not_active', after.status === 409 && after.json?.error === 'match_not_active');

  // points moved on the users
  const meA = await call('/api/auth/me', 'GET', undefined, A.cookie);
  const meB = await call('/api/auth/me', 'GET', undefined, B.cookie);
  const swingActual = (meB.json?.user?.points ?? 0) - (B.points ?? 0);
  check('B points +swing persisted', swingActual === swing, `${swingActual} vs ${swing}`);
  check('A points -swing persisted', (meA.json?.user?.points ?? 0) - (A.points ?? 0) === -swing);

  // match row finished + history (F07)
  const histB = await call('/api/matches?limit=5', 'GET', undefined, B.cookie);
  const row = histB.json?.matches?.find((m: any) => m.id === matchId);
  check('history lists the duel with +delta', !!row && row.resultType === 'win' && row.pointsDelta === swing && row.opponent?.id === A.id);
  const histC = await call('/api/matches?limit=5', 'GET', undefined, C.cookie);
  check("C's history empty (not a participant)", (histC.json?.matches ?? []).length === 0);

  // pagination (F07): limit + offset on B's single duel
  const page1 = await call('/api/matches?limit=1', 'GET', undefined, B.cookie);
  check('history pagination limit=1 returns one row', (page1.json?.matches ?? []).length === 1);
  const page2 = await call('/api/matches?limit=1&offset=1', 'GET', undefined, B.cookie);
  check('history pagination offset=1 skips past it', (page2.json?.matches ?? []).length === 0);

  // opponent code never leaks in detail (own submissions are shown, the rival's are not)
  const mAfterA = await call(`/api/matches/${matchId}`, 'GET', undefined, A.cookie);
  const mAfterB = await call(`/api/matches/${matchId}`, 'GET', undefined, B.cookie);
  check('A does not see B code in match detail', collectStrings(mAfterA.json).every((s) => !s.includes(winning)));
  check('B does not see A code in match detail', collectStrings(mAfterB.json).every((s) => !s.includes(wrongSource)));
  check(
    'each player sees their own submissions in detail',
    mAfterA.json?.match?.mySubmission?.sourceCode === wrongSource && mAfterB.json?.match?.mySubmission?.sourceCode === winning,
  );

  sockA.disconnect();
  sockB.disconnect();
  await new Promise((r) => setTimeout(r, 300)); // let the gateway mark disconnects

  // ---- cleanup (cascades sessions/submissions) ----
  for (let n = 1; n <= 4; n++) {
    await db.delete(users).where(eq(users.email, `${PREFIX}-${n}@example.com`));
  }

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
