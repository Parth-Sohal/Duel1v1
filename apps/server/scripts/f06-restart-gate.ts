/**
 * F06 restart-safety gate (PLAN iteration 3): a match must survive a server
 * restart. Two phases, run around a server restart:
 *   npx tsx scripts/f06-restart-gate.ts setup   # start a live match, backdate its deadline, exit
 *   (restart the server here)
 *   npx tsx scripts/f06-restart-gate.ts verify  # sweeper must have finished it as a draw (−10 both)
 * State is exchanged via a temp JSON file. Cleans up after itself.
 */
import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { io, type Socket } from 'socket.io-client';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'node:fs';
import { createDb } from '../src/db/index.js';
import { matchPlayers, matches, users } from '../src/db/schema.js';

const BASE = 'http://localhost:4000';
const WS = 'http://localhost:4000';
const PREFIX = 'f06-restart';
const STATE_FILE = new URL('./.restart-gate-state.json', import.meta.url).pathname.replace(/^\/([A-Za-z]):/, '$1:');

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

async function call(path: string, method: string, body: unknown, cookie?: string): Promise<{ status: number; json: any; cookie?: string }> {
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

async function registerPlayer(n: number): Promise<{ email: string; cookie: string; id?: string; points: number }> {
  const email = `${PREFIX}-${n}@example.com`;
  await db.delete(users).where(eq(users.email, email));
  const res = await call('/api/auth/register', 'POST', { email, password: 'DemoPass!1', displayName: `Restarter ${n}` });
  if (res.status !== 200) throw new Error(`register ${n} failed: ${res.status} ${JSON.stringify(res.json)}`);
  const me = await call('/api/auth/me', 'GET', undefined, res.cookie!);
  return { email, cookie: res.cookie!, id: me.json?.user?.id, points: me.json?.user?.points ?? 0 };
}

function connectSocket(cookie: string): Promise<Socket> {
  return call('/api/duels/socket-token', 'GET', undefined, cookie).then((tok) =>
    new Promise<Socket>((resolve, reject) => {
      const s = io(WS, { auth: { token: tok.json.token }, transports: ['websocket'], reconnection: false });
      s.on('connect', () => resolve(s));
      s.on('connect_error', reject);
    }),
  );
}

/** Register a room_state predicate listener FIRST (events race the emit), then await it. */
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

async function setup(): Promise<void> {
  console.log('restart-gate SETUP: starting a live match, then backdating its deadline');
  const A = await registerPlayer(1);
  const B = await registerPlayer(2);

  const created = await call('/api/duels/rooms', 'POST', { difficulty: 'easy' }, A.cookie);
  const code: string = created.json?.room?.inviteCode ?? '';
  if (!code) throw new Error(`room create failed: ${JSON.stringify(created.json)}`);

  await call(`/api/duels/rooms/${code}/join`, 'POST', undefined, B.cookie);

  const sockA = await connectSocket(A.cookie);
  const sockB = await connectSocket(B.cookie);
  for (const s of [sockA, sockB]) s.on('room_error', (e) => console.log('  room_error:', JSON.stringify(e)));

  // join (await each state push), then ready (await the ready flags)
  console.log('step: joining sockets');
  const joinedB = waitForState(sockB, () => true);
  sockA.emit('room:join', { code });
  const joinedA = waitForState(sockA, (s) => s.inviteCode === code);
  await joinedA;
  console.log('step: A joined');
  sockB.emit('room:join', { code });
  await joinedB;
  console.log('step: B joined');

  const aReady = waitForState(sockA, (s) => s.players.find((p: any) => p.userId === A.id)?.ready === true);
  sockA.emit('room:ready', { ready: true });
  await aReady;
  console.log('step: A ready');
  const bReady = waitForState(sockA, (s) => s.players.every((p: any) => p.ready === true));
  sockB.emit('room:ready', { ready: true });
  await bReady;
  console.log('step: B ready');

  const start = await call(`/api/duels/rooms/${code}/start`, 'POST', undefined, A.cookie);
  if (start.status !== 200) throw new Error(`start failed: ${start.status} ${JSON.stringify(start.json)}`);
  const matchId: string = start.json.matchId;

  // backdate the deadline so the sweeper must finish it as a draw right after boot
  await db.update(matches).set({ endsAt: new Date(Date.now() - 2000) }).where(eq(matches.id, matchId));

  const [row] = await db.select({ endsAt: matches.endsAt }).from(matches).where(eq(matches.id, matchId));
  if (!row || row.endsAt === null || row.endsAt.getTime() > Date.now()) throw new Error('backdating failed');

  sockA.disconnect();
  sockB.disconnect();

  writeFileSync(STATE_FILE, JSON.stringify({ matchId, a: A, b: B }));
  console.log(`SETUP OK: match ${matchId} is live with a past deadline. Restart the server now.`);
  process.exit(0);
}

async function verify(): Promise<void> {
  console.log('restart-gate VERIFY: the sweeper should have finished the backdated match on boot');
  if (!existsSync(STATE_FILE)) throw new Error('no state file — run setup first');
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as {
    matchId: string;
    a: { email: string; id?: string; points: number };
    b: { email: string; id?: string; points: number };
  };

  // sweeper runs on boot + every 5s; Neon latency can slow the boot pass — poll a bit
  let row: { status: string; resultType: string | null } | undefined;
  for (let i = 0; i < 12; i++) {
    const [r] = await db
      .select({ status: matches.status, resultType: matches.resultType })
      .from(matches)
      .where(eq(matches.id, state.matchId));
    if (r?.status === 'finished') {
      row = r;
      break;
    }
    await new Promise((r2) => setTimeout(r2, 2500));
  }
  check('match finished after restart', row?.status === 'finished', row ? `${row.status}/${row.resultType}` : 'never finished');
  check('result type is draw', row?.resultType === 'draw');

  for (const [name, p] of [['A', state.a], ['B', state.b]] as const) {
    const [me] = await db.select({ points: users.points }).from(users).where(eq(users.email, p.email));
    check(`${name} points −10 (D5 draw)`, me.points === p.points - 10, `${me.points} vs ${p.points - 10}`);
    const [mp] = await db
      .select({ before: matchPlayers.pointsBefore, after: matchPlayers.pointsAfter })
      .from(matchPlayers)
      .where(sql`${matchPlayers.matchId} = ${state.matchId} and ${matchPlayers.userId} = ${p.id}`);
    check(`${name} match_players delta recorded`, mp?.after === mp?.before - 10, JSON.stringify(mp));
  }

  // cleanup
  await db.delete(users).where(eq(users.email, state.a.email));
  await db.delete(users).where(eq(users.email, state.b.email));
  unlinkSync(STATE_FILE);

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

const mode = process.argv[2];
if (mode === 'setup') void setup();
else if (mode === 'verify') void verify();
else {
  console.error('usage: tsx scripts/f06-restart-gate.ts setup|verify');
  process.exit(2);
}
