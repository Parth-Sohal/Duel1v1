/**
 * Iteration 3 production smoke: the full friend-duel flow against PRODUCTION.
 * REST goes through the Vercel web proxy (same-origin /api), sockets connect
 * DIRECTLY to the Render game server with one-time tokens, and the duel
 * submission runs through the real Judge0 endpoint. Verifies: register, room
 * create/join, socket tokens, live room events, ready flow, host start, first
 * pass wins with the D5 swing, match_ended broadcast, history. Cleans up both
 * throwaway accounts (shared Neon DB) via a local connection.
 * Run: npx tsx scripts/f05-prod-smoke.ts
 */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { io, type Socket } from 'socket.io-client';
import postgres from 'postgres';
import { createDb } from '../src/db/index.js';
import { users } from '../src/db/schema.js';

const WEB = process.env.PROD_WEB ?? 'https://duel1v1.vercel.app';
const WS = process.env.PROD_SERVER ?? 'https://duel1v1.onrender.com';
const EMAILS = ['f05-prod-smoke-1@example.com', 'f05-prod-smoke-2@example.com'];
const PASSWORD = 'ProdSmoke1!';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : ` - ${detail}`}`);
}

const db = createDb(process.env.DATABASE_URL!).db;

async function retryDelays(attempt: number): Promise<void> {
  await new Promise((r) => setTimeout(r, attempt * 2000));
}

/** Web-proxy REST call with retries: network blips + prod 5xx + cold Render. */
async function call(
  path: string,
  method: string,
  body: unknown,
  cookie?: string,
  timeoutMs = 60000,
): Promise<{ status: number; json: any; cookie?: string }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${WEB}${path}`, {
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
      if (res.status >= 500 && attempt < 4) {
        await retryDelays(attempt);
        continue;
      }
      return { status: res.status, json, cookie: (res.headers.get('set-cookie') ?? '').split(';')[0] };
    } catch (err) {
      lastError = err;
      await retryDelays(attempt);
    }
  }
  throw lastError;
}

type Player = { name: string; email: string; cookie: string; id?: string; points?: number };

async function registerOrLogin(n: number): Promise<Player> {
  const email = EMAILS[n - 1];
  // leftover from a prior run? clean it first (local connection, same Neon DB).
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await db.delete(users).where(eq(users.email, email));
      break;
    } catch {
      if (attempt === 5) throw new Error(`cleanup delete failed after 5 attempts (${email})`);
      await retryDelays(attempt);
    }
  }
  const reg = await call('/api/auth/register', 'POST', {
    email,
    password: PASSWORD,
    displayName: `Prod Dueler ${n}`,
  });
  check(`register P${n} 200 (production)`, reg.status === 200, `${reg.status} ${JSON.stringify(reg.json)}`);
  if (reg.status !== 200) throw new Error('register failed — cannot continue');
  const me = await call('/api/auth/me', 'GET', undefined, reg.cookie);
  return { name: `P${n}`, email, cookie: reg.cookie, id: me.json?.user?.id, points: me.json?.user?.points ?? 0 };
}

/** Connect a socket DIRECTLY to the production game server with a one-time token. */
async function connectSocket(p: Player): Promise<Socket> {
  const tok = await call('/api/duels/socket-token', 'GET', undefined, p.cookie);
  check(`P${p.name === 'P1' ? 1 : 2} one-time socket token issued`, tok.status === 200 && typeof tok.json?.token === 'string');
  return new Promise((resolve, reject) => {
    const s = io(WS, { auth: { token: tok.json.token }, transports: ['websocket'], reconnection: false, timeout: 30000 });
    const t = setTimeout(() => reject(new Error('socket connect timeout')), 35000);
    s.on('connect', () => {
      clearTimeout(t);
      resolve(s);
    });
    s.on('connect_error', (err) => {
      clearTimeout(t);
      reject(err);
    });
  });
}

function waitForState(s: Socket, pred: (state: any) => boolean, ms = 30000): Promise<any> {
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

/** Reference solutions for all 8 seeded challenges. */
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
  console.log('F05 prod smoke: web', WEB, '| sockets', WS);

  // ---- players (register through the production web proxy) ----
  const A = await registerOrLogin(1);
  const B = await registerOrLogin(2);
  check('both throwaway players have ids', !!A.id && !!B.id);

  // ---- room create + join (REST via web proxy) ----
  const created = await call('/api/duels/rooms', 'POST', { difficulty: null }, A.cookie);
  check('create room 200 (prod web proxy)', created.status === 200, JSON.stringify(created.json));
  if (created.status !== 200) throw new Error('room create failed — cannot continue');
  const code: string = created.json?.room?.inviteCode ?? '';
  check('invite code is 8-char Crockford base32', /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$/.test(code), code);

  const joinB = await call(`/api/duels/rooms/${code}/join`, 'POST', undefined, B.cookie);
  check('B joins 200 seat 2', joinB.status === 200 && joinB.json?.room?.players?.[1]?.seat === 2, JSON.stringify(joinB.json));

  // ---- sockets directly against the Render server ----
  const sockA = await connectSocket(A);
  const sockB = await connectSocket(B);
  check('A socket connected to prod game server', sockA.connected);
  check('B socket connected to prod game server', sockB.connected);

  const pAOnline = waitForState(sockA, (s) => s.players?.length === 2 && s.players.every((p: any) => p.online === true));
  sockA.emit('room:join', { code });
  const stateA = await pAOnline;
  check('room_state: both seats, both online', stateA.inviteCode === code && stateA.players.length === 2);

  sockB.emit('room:join', { code });
  await waitForState(sockB, (s) => s.players?.length === 2);

  const pAReady = waitForState(sockA, (s) => s.players.find((p: any) => p.userId === A.id)?.ready === true);
  sockA.emit('room:ready', { ready: true });
  const stateA2 = await pAReady;
  check('A ready pushed', stateA2.players.find((p: any) => p.userId === A.id)?.ready === true);

  const pBReady = waitForState(sockB, (s) => s.players.every((p: any) => p.ready === true));
  sockB.emit('room:ready', { ready: true });
  await pBReady;
  check('B ready pushed (both ready)', true);

  // ---- host start: room flips to in_match with the matchId ----
  const pStarted = waitForState(sockA, (s) => s.status === 'in_match');
  const start = await call(`/api/duels/rooms/${code}/start`, 'POST', undefined, A.cookie);
  check('host start 200 + matchId', start.status === 200 && typeof start.json?.matchId === 'string', JSON.stringify(start.json));
  if (start.status !== 200) throw new Error('start failed — cannot continue');
  const matchId: string = start.json.matchId;
  const startedState = await pStarted;
  check('room flipped to in_match with matchId', startedState.status === 'in_match' && startedState.matchId === matchId);

  sockA.emit('match:join', { matchId });
  sockB.emit('match:join', { matchId });
  await new Promise((r) => setTimeout(r, 500));

  // ---- match detail: same challenge, server-owned deadline ----
  const mA = await call(`/api/matches/${matchId}`, 'GET', undefined, A.cookie);
  check('A reads match 200 (prod)', mA.status === 200, JSON.stringify(mA.json));
  const slug: string = mA.json?.match?.challenge?.slug ?? '';
  check('match has a known challenge + future ends_at', typeof SOLUTIONS[slug] === 'string' && new Date(mA.json.match.endsAt) > new Date(), slug);
  check('both players in match payload', mA.json?.match?.players?.length === 2);

  const winning = SOLUTIONS[slug];
  const endedSeen = new Promise<any>((resolve) => {
    const t = setTimeout(() => resolve(null), 180000);
    sockB.once('match_ended', (e) => {
      clearTimeout(t);
      resolve(e);
    });
  });

  // ---- one real judged duel submit through production ----
  const right = await call(
    `/api/matches/${matchId}/submit`,
    'POST',
    { language: 'javascript', sourceCode: winning },
    A.cookie,
    180000,
  );
  check(
    'correct submit -> accepted + match finished (real Judge0)',
    right.status === 200 && right.json?.status === 'accepted' && right.json?.matchFinished === true,
    `${right.status} ${JSON.stringify(right.json)}`,
  );
  const swing = right.json?.matchOutcome?.deltas?.[A.id!];
  const bDelta = right.json?.matchOutcome?.deltas?.[B.id!];
  check('D5 win swing 29..31 mirrored', typeof swing === 'number' && swing >= 29 && swing <= 31 && bDelta === -swing, JSON.stringify({ swing, bDelta }));

  const ended = await endedSeen;
  check('B got match_ended broadcast', !!ended && ended.resultType === 'win' && ended.winnerId === A.id, JSON.stringify(ended));

  // ---- points persisted + history ----
  const meA = await call('/api/auth/me', 'GET', undefined, A.cookie);
  const meB = await call('/api/auth/me', 'GET', undefined, B.cookie);
  check('A points +swing persisted', (meA.json?.user?.points ?? 0) - (A.points ?? 0) === swing);
  check('B points -swing persisted', (meB.json?.user?.points ?? 0) - (B.points ?? 0) === -swing);

  const hist = await call('/api/matches?limit=5', 'GET', undefined, B.cookie);
  const row = hist.json?.matches?.find((m: any) => m.id === matchId);
  check('history lists the duel with -delta for the loser', !!row && row.resultType === 'win' && row.pointsDelta === -swing && row.opponent?.id === A.id, JSON.stringify(row));

  sockA.disconnect();
  sockB.disconnect();

  // ---- cleanup both throwaway accounts (cascades sessions/submissions) ----
  let deleted = 0;
  for (const email of EMAILS) {
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const del = await db.delete(users).where(eq(users.email, email));
        deleted += del.count;
        break;
      } catch {
        if (attempt === 5) throw new Error(`cleanup delete failed after 5 attempts (${email})`);
        await retryDelays(attempt);
      }
    }
  }
  check('throwaway accounts deleted', deleted === 2, `deleted ${deleted}/2`);

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
