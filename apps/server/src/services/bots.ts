import { and, eq, isNotNull, lte, sql } from 'drizzle-orm';
import {
  BOT_FAIL_MAX_MS,
  BOT_FAIL_MIN_MS,
  BOT_NAME,
  BOT_SOLVE_MAX_MS,
  BOT_SOLVE_MIN_MS,
  BOT_SOLVE_PROBABILITY,
} from '@coding-arena/shared';
import type { Database } from '../db/index.js';
import { matches, matchPlayers, rooms, users } from '../db/schema.js';
import { createRoom, setReady, type RoomRow } from './rooms.js';
import { finishMatch, startMatch, type AppliedOutcome } from './matches.js';
import { activeMatchFor, getRoomById } from './rooms.js';

/**
 * F08 KERN BOT (docs/features/F08-kern-bot.md). The bot is a real user row
 * seated in a real room; the duel runs through the exact same engine as a
 * human match (startMatch, sweeper, conditional first-pass-wins). Per D6 the
 * bot's duels move no points and count no stats.
 *
 * The bot's brain is decided ONCE at match start and stored on the match row
 * (bot_will_solve, bot_solve_at) — the sweeper executes it, so a server
 * restart can never lose the bot's move. The bot never submits through the
 * judge and never stores a submission row: its "solve" is the match finishing
 * with KERN as the winner (D6-zero deltas), its "fail" is one progress event.
 */

let botUserId: string | null = null; // single game server (decision 2): cache once per process

/** Idempotent: the single KERN user row (is_bot, no email — cannot sign in). */
export async function ensureBotUser(db: Database): Promise<string> {
  if (botUserId) return botUserId;
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.isBot, true)).limit(1);
  if (existing) {
    botUserId = existing.id;
    return botUserId;
  }
  // Two processes can race the select above; the partial unique index
  // (users_is_bot_single) makes only one insert stick — the loser re-reads.
  await db.insert(users).values({ displayName: BOT_NAME, isBot: true }).onConflictDoNothing();
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.isBot, true)).limit(1);
  if (!row) throw new Error('bot user missing after insert');
  botUserId = row.id;
  return botUserId;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export type CreateBotMatchResult =
  | { ok: true; matchId: string; botId: string }
  | { ok: false; error: 'already_in_match' | 'challenge_unavailable' | 'room_not_live' | 'not_both_ready' };

/**
 * One call = a full friend-duel setup with KERN in seat 2: room created, KERN
 * joined + ready, then the ordinary startMatch (repeat rule picks the
 * challenge, swing locked, ends_at set). Finally the bot's plan is rolled and
 * written onto the match row.
 */
export async function createBotMatch(
  db: Database,
  userId: string,
  difficulty: 'easy' | 'medium' | 'hard' | null,
): Promise<CreateBotMatchResult> {
  // Check the human's guard BEFORE creating the room (no orphan rooms).
  const blocker = await activeMatchFor(db, userId);
  if (blocker) return { ok: false, error: 'already_in_match' };
  const botId = await ensureBotUser(db);
  const room: RoomRow = await createRoom(db, userId, difficulty);
  const joined = await db
    .update(rooms)
    .set({ guestId: botId, status: 'full' })
    .where(and(eq(rooms.id, room.id), sql`${rooms.guestId} IS NULL`))
    .returning({ id: rooms.id });
  if (joined.length === 0) return { ok: false, error: 'room_not_live' };
  const full: RoomRow = { ...room, guestId: botId, status: 'full' };
  // Both seats ready — the launcher is a one-click start, no lobby stop.
  await setReady(db, full, userId, true);
  await setReady(db, full, botId, true);

  // Re-read: startMatch's bothReady check reads readyState off the row, and
  // the row we hold predates the two ready merges above.
  const fresh = await getRoomById(db, room.id);
  const started = await startMatch(db, (fresh as RoomRow) ?? full);
  if (!started.ok) return { ok: false, error: started.error };
  const matchId = (started as { ok: true; matchId: string }).matchId;

  // Roll the brain: solve probability by difficulty, human-like delay. A
  // "fail" plan still acts once (a wrong-attempt progress event) in 2–4 min.
  const key = difficulty ?? 'medium';
  const willSolve = Math.random() < BOT_SOLVE_PROBABILITY[key];
  const [min, max] = willSolve ? [BOT_SOLVE_MIN_MS, BOT_SOLVE_MAX_MS] : [BOT_FAIL_MIN_MS, BOT_FAIL_MAX_MS];
  await db
    .update(matches)
    .set({ isBotMatch: true, botWillSolve: willSolve, botSolveAt: new Date(Date.now() + randomInt(min, max)) })
    .where(eq(matches.id, matchId));
  return { ok: true, matchId, botId };
}

/**
 * Sweeper duty (runs on boot + every few seconds): execute due bot plans.
 * - will_solve=true → KERN wins (conditional update; a player's first accepted
 *   submit may have finished the match already — the tick then finds nothing).
 * - will_solve=false → one "wrong attempt" progress event, then the plan is
 *   cleared (bot_solve_at = NULL) so it never repeats.
 * Returns the outcomes applied so the caller broadcasts match_ended, plus the
 * failing-plan matches so the caller can broadcast their progress events.
 */
export async function runBotTick(
  db: Database,
  botId: string,
): Promise<{ applied: AppliedOutcome[]; failing: string[] }> {
  const now = new Date();
  const due = await db
    .select({ matchId: matches.id, userId: matchPlayers.userId })
    .from(matches)
    .innerJoin(matchPlayers, eq(matchPlayers.matchId, matches.id))
    .where(
      and(
        eq(matches.status, 'active'),
        eq(matches.isBotMatch, true),
        eq(matches.botWillSolve, true),
        isNotNull(matches.botSolveAt),
        lte(matches.botSolveAt, now),
      ),
    );

  const applied: AppliedOutcome[] = [];
  for (const matchId of new Set(due.map((d) => d.matchId))) {
    const seats = due.filter((d) => d.matchId === matchId);
    const human = seats.find((s) => s.userId !== botId)?.userId;
    if (!human) continue; // plan must name exactly one human player
    const result = await finishMatch(db, matchId, { kind: 'win', winnerId: botId, loserId: human });
    if (result) applied.push(result);
    await closeBotRoom(db, matchId);
  }

  // Failing plans: one visible wrong attempt, then clear the schedule.
  const failing = await db
    .select({ id: matches.id })
    .from(matches)
    .where(and(eq(matches.status, 'active'), eq(matches.isBotMatch, true), eq(matches.botWillSolve, false), isNotNull(matches.botSolveAt), lte(matches.botSolveAt, now)));
  const failingIds: string[] = [];
  for (const m of failing) {
    await db.update(matches).set({ botSolveAt: null }).where(eq(matches.id, m.id));
    await closeBotRoom(db, m.id);
    failingIds.push(m.id);
  }
  return { applied, failing: failingIds };
}

/** Close the bot room once its match is over (no orphaned joinable rooms). */
async function closeBotRoom(db: Database, matchId: string): Promise<void> {
  const [m] = await db.select({ roomId: matches.roomId }).from(matches).where(eq(matches.id, matchId));
  if (m?.roomId) await db.update(rooms).set({ status: 'closed' }).where(eq(rooms.id, m.roomId));
}
