import {
  MATCHMAKING_ENTRY_TTL_MS,
  MATCHMAKING_MATCHED_TTL_MS,
  MATCHMAKING_STALE_MS,
  type DuelDifficulty,
  type MatchmakingStatus,
} from '@coding-arena/shared';
import type { Database } from '../db/index.js';
import { activeMatchFor } from './rooms.js';
import { createQuickMatch, type Difficulty } from './matches.js';
import { recordEvent } from './events.js';

/**
 * F09 random matchmaking (docs/features/F09-matchmaking-leaderboard.md).
 *
 * The queue itself is process memory behind `MatchmakingQueue`: a single game
 * server, no new table, no Redis (decision recorded in the spec). Postgres is
 * still authoritative for the match that pairing creates. The pairing pass is
 * serialized by Node's event loop, so one entry can never be consumed twice.
 *
 * Heartbeat: every status GET refreshes `lastSeenAt`. A closed tab is pruned
 * after `MATCHMAKING_STALE_MS`, and a single search is capped at
 * `MATCHMAKING_ENTRY_TTL_MS` so abandoned entries cannot camp forever.
 */

export type QueueEntry = {
  userId: string;
  difficulty: DuelDifficulty | null;
  enqueuedAt: number;
  lastSeenAt: number;
};

type MatchedEntry = {
  matchId: string;
  matchedAt: number;
};

export interface MatchmakingQueue {
  /** Add or refresh this user's entry. One entry per user, always. */
  enqueue(userId: string, difficulty: DuelDifficulty | null, now: number): MatchmakingStatus;
  /** Heartbeat + current status. Expired entries become idle. */
  status(userId: string, now: number): MatchmakingStatus;
  /** Remove a waiting or matched result. Idempotent. */
  cancel(userId: string): boolean;
  /** Oldest waiting entry + oldest compatible partner; reserves both. */
  takePair(now: number): [QueueEntry, QueueEntry] | null;
  /** Put a reserved entry back after a transient pairing failure. */
  restore(entry: QueueEntry): void;
  /** Retain the pairing result for both players (recoverable for 5 min). */
  markMatched(a: QueueEntry, b: QueueEntry, matchId: string, now: number): void;
  /** Drop one user's entry/result. */
  drop(userId: string): void;
  /** Real waiting entries, excluding the caller. */
  waitingCount(excludeUserId: string | null, now: number): number;
  /** Remove stale waiters and expired matched results. */
  prune(now: number): void;
  /** Test/diagnostic view. */
  size(): { waiting: number; pairing: number; matched: number };
}

/** ANY pairs with everyone; two concrete difficulties must match exactly. */
export function difficultiesCompatible(a: DuelDifficulty | null, b: DuelDifficulty | null): boolean {
  return a === null || b === null || a === b;
}

/** The match uses the concrete preference when one side chose ANY. */
export function resolveDifficulty(
  a: DuelDifficulty | null,
  b: DuelDifficulty | null,
): Difficulty | null {
  return a ?? b;
}

export class InMemoryMatchmakingQueue implements MatchmakingQueue {
  private readonly waiting = new Map<string, QueueEntry>();
  /** Reserved by the pairing pass while the DB match is being created. */
  private readonly pairing = new Map<string, QueueEntry>();
  private readonly matched = new Map<string, MatchedEntry>();

  enqueue(userId: string, difficulty: DuelDifficulty | null, now: number): MatchmakingStatus {
    this.prune(now);
    this.matched.delete(userId); // a new search supersedes an old pairing result
    this.pairing.delete(userId); // stale reservation from a crashed attempt

    const existing = this.waiting.get(userId);
    if (existing) {
      existing.difficulty = difficulty;
      existing.lastSeenAt = now;
      return this.searchingStatus(existing, now);
    }

    const entry: QueueEntry = { userId, difficulty, enqueuedAt: now, lastSeenAt: now };
    this.waiting.set(userId, entry);
    return this.searchingStatus(entry, now);
  }

  status(userId: string, now: number): MatchmakingStatus {
    const matched = this.matched.get(userId);
    if (matched) {
      if (now - matched.matchedAt > MATCHMAKING_MATCHED_TTL_MS) {
        this.matched.delete(userId);
        return { status: 'idle' };
      }
      return { status: 'matched', matchId: matched.matchId, matchedAt: new Date(matched.matchedAt).toISOString() };
    }

    // Pairing is in flight: keep reporting `searching` instead of a misleading
    // `idle` while the match insert runs. This window can be seconds long on a
    // slow database, and the UI treats idle as "search ended".
    const reserved = this.pairing.get(userId);
    if (reserved) {
      return {
        status: 'searching',
        since: new Date(reserved.enqueuedAt).toISOString(),
        difficulty: reserved.difficulty,
        waiting: this.waitingCount(userId, now),
      };
    }

    const entry = this.waiting.get(userId);
    if (!entry) return { status: 'idle' };
    if (this.isExpired(entry, now) || now - entry.lastSeenAt > MATCHMAKING_STALE_MS) {
      this.waiting.delete(userId);
      return { status: 'idle' };
    }
    entry.lastSeenAt = now;
    return this.searchingStatus(entry, now);
  }

  cancel(userId: string): boolean {
    const hadMatched = this.matched.delete(userId);
    const hadPairing = this.pairing.delete(userId);
    const hadWaiting = this.waiting.delete(userId);
    return hadMatched || hadPairing || hadWaiting;
  }

  takePair(now: number): [QueueEntry, QueueEntry] | null {
    this.prune(now);
    const entries = [...this.waiting.values()].sort(
      (a, b) => a.enqueuedAt - b.enqueuedAt || a.userId.localeCompare(b.userId),
    );

    for (let i = 0; i < entries.length; i++) {
      const a = entries[i];
      for (let j = i + 1; j < entries.length; j++) {
        const b = entries[j];
        if (a.userId === b.userId) continue; // defensive: the map already makes this impossible
        if (!difficultiesCompatible(a.difficulty, b.difficulty)) continue;
        this.waiting.delete(a.userId);
        this.waiting.delete(b.userId);
        this.pairing.set(a.userId, a);
        this.pairing.set(b.userId, b);
        return [a, b];
      }
    }
    return null;
  }

  restore(entry: QueueEntry): void {
    if (this.matched.has(entry.userId)) return;
    this.pairing.delete(entry.userId);
    if (this.waiting.has(entry.userId)) return;
    this.waiting.set(entry.userId, entry);
  }

  markMatched(a: QueueEntry, b: QueueEntry, matchId: string, now: number): void {
    this.waiting.delete(a.userId);
    this.waiting.delete(b.userId);
    this.pairing.delete(a.userId);
    this.pairing.delete(b.userId);
    const result: MatchedEntry = { matchId, matchedAt: now };
    this.matched.set(a.userId, result);
    this.matched.set(b.userId, result);
  }

  drop(userId: string): void {
    this.waiting.delete(userId);
    this.pairing.delete(userId);
    this.matched.delete(userId);
  }

  waitingCount(excludeUserId: string | null, now: number): number {
    this.prune(now);
    let count = 0;
    for (const id of this.waiting.keys()) if (id !== excludeUserId) count++;
    return count;
  }

  prune(now: number): void {
    for (const [id, entry] of this.waiting) {
      if (this.isExpired(entry, now) || now - entry.lastSeenAt > MATCHMAKING_STALE_MS) {
        this.waiting.delete(id);
      }
    }
    for (const [id, result] of this.matched) {
      if (now - result.matchedAt > MATCHMAKING_MATCHED_TTL_MS) this.matched.delete(id);
    }
    // Reservations are intentionally not pruned: the pairing pass owns them
    // until createQuickMatch resolves (success, restore, or drop).
  }

  size(): { waiting: number; pairing: number; matched: number } {
    return { waiting: this.waiting.size, pairing: this.pairing.size, matched: this.matched.size };
  }

  private isExpired(entry: QueueEntry, now: number): boolean {
    return now - entry.enqueuedAt > MATCHMAKING_ENTRY_TTL_MS;
  }

  private searchingStatus(entry: QueueEntry, now: number): MatchmakingStatus {
    return {
      status: 'searching',
      since: new Date(entry.enqueuedAt).toISOString(),
      difficulty: entry.difficulty,
      waiting: this.waitingCount(entry.userId, now),
    };
  }
}

/** Single process-wide queue. `index.ts` runs the pairing pass on a timer. */
export const matchmakingQueue = new InMemoryMatchmakingQueue();

export type PairingResult = { matchId: string; players: [string, string] };

/**
 * One pairing pass: prune, take the oldest compatible pair, re-check the
 * one-live-duel guard, then create a real match. Up to 10 pairs per pass so a
 * busy queue drains without blocking the event loop for long.
 */
export async function runMatchmakingTick(db: Database): Promise<PairingResult[]> {
  const created: PairingResult[] = [];
  matchmakingQueue.prune(Date.now());

  for (let i = 0; i < 10; i++) {
    const pair = matchmakingQueue.takePair(Date.now());
    if (!pair) break;

    const [a, b] = pair;
    // Drop only the blocked player; put the healthy one back in line.
    if (await activeMatchFor(db, a.userId)) {
      matchmakingQueue.restore(b);
      continue;
    }
    if (await activeMatchFor(db, b.userId)) {
      matchmakingQueue.restore(a);
      continue;
    }

    try {
      const result = await createQuickMatch(db, a.userId, b.userId, resolveDifficulty(a.difficulty, b.difficulty));
      if (result.ok) {
        matchmakingQueue.markMatched(a, b, result.matchId, Date.now());
        created.push({ matchId: result.matchId, players: [a.userId, b.userId] });
        await recordEvent(db, {
          type: 'match_started',
          userId: a.userId,
          matchId: result.matchId,
          meta: { matchType: 'quick' },
        });
        continue;
      }

      if (result.error === 'challenge_unavailable') {
        // Transient (e.g. only repeat-rule challenges remain): keep both and
        // retry on the next pass rather than dumping them back to idle.
        matchmakingQueue.restore(a);
        matchmakingQueue.restore(b);
        break;
      }

      // A race closed one of the guards between the checks above: keep the
      // player who is still free, drop the one who is now in a duel.
      if (!(await activeMatchFor(db, a.userId))) matchmakingQueue.restore(a);
      if (!(await activeMatchFor(db, b.userId))) matchmakingQueue.restore(b);
    } catch (err) {
      matchmakingQueue.restore(a);
      matchmakingQueue.restore(b);
      throw err;
    }
  }

  return created;
}
