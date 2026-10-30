import { and, desc, eq, inArray, isNull, notInArray, sql, type SQL } from 'drizzle-orm';
import {
  DRAW_PENALTY,
  FORFEIT_GRACE_MS,
  FORFEIT_PENALTY,
  FORFEIT_REWARD,
  MATCH_DURATION_MS,
  REPEAT_AVOID_LAST_N,
  WIN_SWING_MAX,
  WIN_SWING_MIN,
} from '@coding-arena/shared';
import type { Database } from '../db/index.js';
import { challengeVersions, challenges, matchPlayers, matches, rooms, submissions, users } from '../db/schema.js';
import { activeMatchFor, bothReady, type RoomRow } from './rooms.js';

/**
 * Match engine (docs/features/F06-match-engine.md). The server owns the
 * outcome: first accepted submission wins via a conditional update
 * (WHERE status = 'active'), so near-simultaneous passes produce exactly
 * one winner. Points move per decision D5 (owner-revised 2026-10-30): winners
 * take the full swing; losers/draws/forfeits are floored at 0 points.
 */

export type MatchRow = typeof matches.$inferSelect;
export type Difficulty = 'easy' | 'medium' | 'hard';

/** D5: each match's swing is randomized once at start; winner gains it, loser loses it. */
export function randomSwing(): number {
  return WIN_SWING_MIN + crypto.getRandomValues(new Uint32Array(1))[0] % (WIN_SWING_MAX - WIN_SWING_MIN + 1);
}

/**
 * Challenge selection with the F6 repeat rule: prefer published challenges
 * NEITHER player solved (accepted submit) in their last REPEAT_AVOID_LAST_N
 * matches. Fallbacks: exclude only the most recent match's challenge per
 * player, then any published challenge. Random among eligible.
 */
export async function pickChallenge(
  db: Database,
  playerIds: string[],
  difficulty: Difficulty | null,
): Promise<{ versionId: string } | null> {
  const filters = [eq(challenges.isPublished, true)];
  if (difficulty) filters.push(eq(challenges.difficulty, difficulty));

  const base = (extra: SQL[]) =>
    db
      .select({ versionId: challengeVersions.id })
      .from(challengeVersions)
      .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
      .where(and(...filters, eq(challengeVersions.version, challenges.currentVersion), ...extra));

  // Challenges solved recently (accepted submit) in either player's last N matches.
  const recentMatchIds = await db
    .select({ id: matches.id })
    .from(matches)
    .innerJoin(matchPlayers, and(eq(matchPlayers.matchId, matches.id), inArray(matchPlayers.userId, playerIds)))
    .where(eq(matches.status, 'finished'))
    .orderBy(desc(matches.finishedAt))
    .limit(playerIds.length * REPEAT_AVOID_LAST_N * 2);

  let solvedChallengeIds: string[] = [];
  if (recentMatchIds.length > 0) {
    const solved = await db
      .selectDistinct({ challengeId: submissions.challengeId })
      .from(submissions)
      .where(
        and(
          inArray(submissions.matchId, recentMatchIds.map((m) => m.id)),
          inArray(submissions.userId, playerIds),
          eq(submissions.status, 'accepted'),
        ),
      );
    solvedChallengeIds = solved.map((s) => s.challengeId);
  }

  // Pass 1: avoid everything recently solved by either player.
  if (solvedChallengeIds.length > 0) {
    const eligible = await base([notInArray(challenges.id, solvedChallengeIds)]).limit(20);
    if (eligible.length > 0) return eligible[crypto.getRandomValues(new Uint32Array(1))[0] % eligible.length];
  }
  // Pass 2: avoid only each player's single most recent match's challenge.
  const lastChallengeIds: string[] = [];
  for (const pid of playerIds) {
    const last = await db
      .select({ challengeId: challenges.id })
      .from(matches)
      .innerJoin(matchPlayers, and(eq(matchPlayers.matchId, matches.id), eq(matchPlayers.userId, pid)))
      .innerJoin(challengeVersions, eq(challengeVersions.id, matches.challengeVersionId))
      .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
      .where(and(eq(matches.status, 'finished'), eq(matchPlayers.userId, pid)))
      .orderBy(desc(matches.finishedAt))
      .limit(1);
    lastChallengeIds.push(...last.map((l) => l.challengeId));
  }
  const unique = [...new Set(lastChallengeIds)];
  if (unique.length > 0) {
    const eligible = await base([notInArray(challenges.id, unique)]).limit(20);
    if (eligible.length > 0) return eligible[crypto.getRandomValues(new Uint32Array(1))[0] % eligible.length];
  }

  // Final fallback: any published challenge.
  const any = await base([]).limit(20);
  if (any.length === 0) return null;
  return any[crypto.getRandomValues(new Uint32Array(1))[0] % any.length];
}

export type StartMatchResult =
  | { ok: true; matchId: string }
  | { ok: false; error: 'not_both_ready' | 'challenge_unavailable' | 'already_in_match' | 'room_not_live' };

/**
 * Start a match from a room (host action): one transaction — pick the
 * challenge, insert the match (active, swing locked, deadline set), record
 * both players' points_before, flip the room in_match.
 */
export async function startMatch(db: Database, room: RoomRow): Promise<StartMatchResult> {
  if (room.status !== 'full' || room.guestId === null) return { ok: false, error: 'room_not_live' };
  if (!bothReady(room)) return { ok: false, error: 'not_both_ready' };

  const blocker = await activeMatchFor(db, room.hostId);
  if (blocker) return { ok: false, error: 'already_in_match' };
  // The single-match rule is for HUMANS: KERN is stateless and seats many
  // concurrent bot matches (one per lone player).
  const [guest] = await db.select({ isBot: users.isBot }).from(users).where(eq(users.id, room.guestId));
  if (!guest?.isBot && (await activeMatchFor(db, room.guestId))) return { ok: false, error: 'already_in_match' };

  const playerIds = [room.hostId, room.guestId];
  const picked = await pickChallenge(db, playerIds, room.difficulty);
  if (!picked) return { ok: false, error: 'challenge_unavailable' };

  const before = await db.select({ id: users.id, points: users.points }).from(users).where(inArray(users.id, playerIds));
  const pointsOf = (id: string) => before.find((b) => b.id === id)?.points ?? 0;

  const matchId = await db.transaction(async (tx) => {
    const [match] = await tx
      .insert(matches)
      .values({
        roomId: room.id,
        challengeVersionId: picked.versionId,
        status: 'active',
        swingPoints: randomSwing(),
        startedAt: new Date(),
        endsAt: new Date(Date.now() + MATCH_DURATION_MS),
      })
      .returning({ id: matches.id });
    await tx.insert(matchPlayers).values([
      { matchId: match.id, userId: room.hostId, seat: 1, pointsBefore: pointsOf(room.hostId) },
      { matchId: match.id, userId: room.guestId!, seat: 2, pointsBefore: pointsOf(room.guestId!) },
    ]);
    await tx.update(rooms).set({ status: 'in_match' }).where(eq(rooms.id, room.id));
    return match.id;
  });

  return { ok: true, matchId };
}

export type Outcome =
  | { kind: 'win'; winnerId: string; loserId: string }
  | { kind: 'draw' }
  | { kind: 'forfeit'; winnerId: string; loserId: string };

/**
 * Finish an active match: the conditional update guarantees exactly one
 * finisher under near-simultaneous submissions. Points (D5) move in the same
 * transaction as the finish; deltas are written to match_players.points_after.
 * Returns the outcome actually applied — or null if someone else finished it.
 */
export async function finishMatch(
  db: Database,
  matchId: string,
  outcome: Outcome,
): Promise<AppliedOutcome | null> {
  const now = new Date();

  return db.transaction(async (tx) => {
    // Conditional update: only one caller's WHERE status='active' can match.
    const finished = await tx
      .update(matches)
      .set({
        status: 'finished',
        resultType: outcome.kind === 'draw' ? 'draw' : outcome.kind,
        winnerId: outcome.kind === 'draw' ? null : outcome.winnerId,
        finishedAt: now,
      })
      .where(and(eq(matches.id, matchId), eq(matches.status, 'active')))
      .returning({ id: matches.id, swingPoints: matches.swingPoints, roomId: matches.roomId, isBotMatch: matches.isBotMatch });
    if (finished.length === 0) return null; // already finished by the other path
    const match = finished[0];
    // D6 (owner-confirmed): KERN BOT duels move no points and count no stats.
    const isBot = match.isBotMatch;

    const players = await tx.select().from(matchPlayers).where(eq(matchPlayers.matchId, matchId));
    const rawDeltaOf = (userId: string): number => {
      if (isBot) return 0; // D6
      if (outcome.kind === 'draw') return -DRAW_PENALTY;
      return outcome.winnerId === userId ? (outcome.kind === 'forfeit' ? FORFEIT_REWARD : match.swingPoints ?? WIN_SWING_MIN) : (outcome.kind === 'forfeit' ? -FORFEIT_PENALTY : -(match.swingPoints ?? WIN_SWING_MIN));
    };

    // Floor rule (owner decision, 2026-10-30 — revises D5's "no floor"): a
    // player never drops below 0 points. Losers/draws/forfeits pay only what
    // they have; winners always take the full swing/reward. A player is in at
    // most one active match, so points_before is their live balance here.
    const deltas: Record<string, number> = {};
    for (const p of players) {
      const raw = rawDeltaOf(p.userId);
      const effective = raw < 0 ? -Math.min(-raw, Math.max(p.pointsBefore, 0)) : raw;
      deltas[p.userId] = effective;
      await tx
        .update(users)
        .set({
          points: sql`${users.points} + ${effective}`,
          wins: !isBot && outcome.kind !== 'draw' && outcome.winnerId === p.userId ? sql`${users.wins} + 1` : sql`${users.wins}`,
          losses: !isBot && outcome.kind !== 'draw' && outcome.winnerId !== p.userId ? sql`${users.losses} + 1` : sql`${users.losses}`,
          draws: !isBot && outcome.kind === 'draw' ? sql`${users.draws} + 1` : sql`${users.draws}`,
          updatedAt: now,
        })
        .where(eq(users.id, p.userId));
      await tx
        .update(matchPlayers)
        .set({ pointsAfter: p.pointsBefore + effective })
        .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.userId, p.userId)));
    }

    return { outcome, match, deltas };
  });
}

export type AppliedOutcome = {
  outcome: Outcome;
  match: { id: string; swingPoints: number | null; roomId: string | null; isBotMatch?: boolean };
  /** The deltas actually applied (floored at 0 for poor players; all 0 for bot matches per D6). */
  deltas: Record<string, number>;
};

/** Full match row + players for routes. */
export async function getMatchWithPlayers(db: Database, matchId: string): Promise<{
  match: MatchRow;
  players: Array<{ userId: string; seat: number; pointsBefore: number; pointsAfter: number | null; disconnectedAt: Date | null; displayName: string; avatarUrl: string | null; points: number }>;
} | null> {
  const rows = await db
    .select({ match: matches, player: matchPlayers, user: users })
    .from(matches)
    .innerJoin(matchPlayers, eq(matchPlayers.matchId, matches.id))
    .innerJoin(users, eq(users.id, matchPlayers.userId))
    .where(eq(matches.id, matchId));
  if (rows.length === 0) return null;
  return {
    match: rows[0].match,
    players: rows.map((r) => ({
      userId: r.player.userId,
      seat: r.player.seat,
      pointsBefore: r.player.pointsBefore,
      pointsAfter: r.player.pointsAfter,
      disconnectedAt: r.player.disconnectedAt,
      displayName: r.user.displayName,
      avatarUrl: r.user.avatarUrl,
      points: r.user.points,
    })),
  };
}

/**
 * Sweeper pass — run on boot + every few seconds (restart safety):
 * 1. Exactly one player disconnected past the grace period → forfeit
 *    (stayer +FORFEIT_REWARD, leaver −FORFEIT_PENALTY). Both disconnected →
 *    wait for a return; the deadline decides.
 * 2. Deadline passed with no winner → draw (both −DRAW_PENALTY).
 * Returns the outcomes actually applied (finished by THIS pass) so the
 * gateway can broadcast; already-finished matches are skipped by the
 * conditional update inside finishMatch.
 */
export async function sweepMatches(db: Database): Promise<AppliedOutcome[]> {
  const now = new Date();
  const graceBefore = new Date(now.getTime() - FORFEIT_GRACE_MS);

  const rows = await db
    .select({ match: matches, player: matchPlayers })
    .from(matches)
    .innerJoin(matchPlayers, eq(matchPlayers.matchId, matches.id))
    .where(and(eq(matches.status, 'active'), isNull(matches.finishedAt)))
    .limit(200);

  const byMatch = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byMatch.get(r.match.id) ?? [];
    list.push(r);
    byMatch.set(r.match.id, list);
  }

  const applied: AppliedOutcome[] = [];
  for (const [matchId, list] of byMatch) {
    const { match } = list[0];
    const leavers = list.filter((r) => r.player.disconnectedAt !== null && r.player.disconnectedAt < graceBefore);
    let outcome: Outcome | null = null;
    if (list.length === 2 && leavers.length === 1) {
      const loserId = leavers[0].player.userId;
      const winner = list.find((r) => r.player.userId !== loserId);
      if (winner) outcome = { kind: 'forfeit', winnerId: winner.player.userId, loserId };
    } else if (match.endsAt !== null && match.endsAt < now) {
      outcome = { kind: 'draw' };
    }
    if (!outcome) continue;
    const res = await finishMatch(db, matchId, outcome);
    if (res) applied.push(res);
  }
  return applied;
}
