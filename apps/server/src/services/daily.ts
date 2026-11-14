import { and, asc, eq, gte, sql } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { challengeVersions, challenges, dailyChallenges, submissions } from '../db/schema.js';
import { entryFunctionsOf } from './challenges.js';
import type { EntryFunctions } from '@coding-arena/shared';

/**
 * F09 daily challenge (docs/features/F09-daily-challenge.md). Every player
 * gets the SAME published challenge version for a given UTC day. The pick is
 * deterministic — hash(day, salt) into the published pool ordered by slug —
 * and cached in daily_challenges on first request of the day, then
 * authoritative (a restart can never change today's pick). Repeats are
 * avoided while the pool still has fresh entries: challenges picked within
 * the last (pool size − 1) days are excluded, wrapping only when the pool is
 * exhausted.
 */

/** Stable app salt for the day→index hash (override via env if ever needed). */
const DAILY_SALT = process.env.DAILY_SALT ?? 'kern-arena-v1';

/** The UTC day string ('YYYY-MM-DD') for a moment in time. */
export function utcDayOf(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10);
}

/** Deterministic index: FNV-1a over "day:salt", unsigned, mod `mod`. */
export function dailyIndex(day: string, salt: string, mod: number): number {
  let h = 2166136261;
  const s = `${day}:${salt}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % mod;
}

/** The UTC day string n days BEFORE `day` ('' when the math would go negative). */
export function dayBefore(day: string, n: number): string {
  const base = new Date(`${day}T00:00:00.000Z`).getTime();
  if (Number.isNaN(base)) return '';
  return new Date(base - n * 86_400_000).toISOString().slice(0, 10);
}

type PoolEntry = { slug: string; title: string; challengeId: string; versionId: string };

/** The published pool: challenge + current version, ordered by slug (deterministic). */
async function publishedPool(db: Database): Promise<PoolEntry[]> {
  return db
    .select({
      slug: challenges.slug,
      title: challenges.title,
      challengeId: challenges.id,
      versionId: challengeVersions.id,
    })
    .from(challenges)
    .innerJoin(
      challengeVersions,
      and(eq(challengeVersions.challengeId, challenges.id), eq(challengeVersions.version, challenges.currentVersion)),
    )
    .where(eq(challenges.isPublished, true))
    .orderBy(asc(challenges.slug));
}

/** Slugs picked on days in [day-n, day-1] (today's row is not written yet). */
async function recentlyPicked(db: Database, day: string, n: number): Promise<Set<string>> {
  const since = dayBefore(day, n);
  if (!since) return new Set();
  const rows = await db
    .select({ slug: challenges.slug })
    .from(dailyChallenges)
    .innerJoin(challengeVersions, eq(challengeVersions.id, dailyChallenges.challengeVersionId))
    .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
    .where(and(gte(dailyChallenges.day, since), sql`${dailyChallenges.day} < ${day}`));
  return new Set(rows.map((r) => r.slug));
}

/**
 * Today's version id, computing + caching the pick if needed. Returns null
 * when nothing is published. Safe under concurrency: the row insert races
 * are resolved by the primary key — the loser re-reads the winner's pick.
 */
export async function resolveDaily(db: Database, day: string): Promise<{ versionId: string } | null> {
  const [cached] = await db
    .select({ versionId: dailyChallenges.challengeVersionId })
    .from(dailyChallenges)
    .where(eq(dailyChallenges.day, day))
    .limit(1);
  if (cached) return cached;

  const pool = await publishedPool(db);
  if (pool.length === 0) return null;

  const recent = await recentlyPicked(db, day, pool.length - 1);
  const candidates = pool.filter((p) => !recent.has(p.slug));
  const usable = candidates.length > 0 ? candidates : pool; // wrap only when exhausted
  const pick = usable[dailyIndex(day, DAILY_SALT, usable.length)];

  const inserted = await db
    .insert(dailyChallenges)
    .values({ day, challengeVersionId: pick.versionId })
    .onConflictDoNothing()
    .returning({ versionId: dailyChallenges.challengeVersionId });
  if (inserted.length > 0) return { versionId: inserted[0].versionId };

  const [winner] = await db
    .select({ versionId: dailyChallenges.challengeVersionId })
    .from(dailyChallenges)
    .where(eq(dailyChallenges.day, day))
    .limit(1);
  return winner ?? { versionId: pick.versionId };
}

/** The caller's own state for the daily's challenge (attempts + solved). */
async function playerState(db: Database, userId: string, challengeId: string): Promise<{ attempts: number; solved: boolean }> {
  const [row] = await db
    .select({
      attempts: sql<number>`count(*)::int`,
      solved: sql<boolean>`coalesce(bool_or(${submissions.status} = 'accepted'), false)`,
    })
    .from(submissions)
    .where(and(eq(submissions.challengeId, challengeId), eq(submissions.userId, userId), eq(submissions.kind, 'submit')));
  return { attempts: row?.attempts ?? 0, solved: row?.solved ?? false };
}

/** Streak bar states: solved that day, daily existed but unsolved, or no daily at all (pre-launch). */
export type StreakDayState = 'done' | 'missed' | 'none';

export type StreakDay = { day: string; state: StreakDayState };

export type StreakSummary = { current: number; max: number; days: StreakDay[] };

/** How many days the bar shows. */
const STREAK_WINDOW = 14;

/**
 * The player's daily-streak data (owner request, 2026-10-30): a 14-day bar
 * plus current/longest streak. A day counts as DONE when the player has an
 * ACCEPTED submit for the challenge that was the daily that day. The streak
 * survives a not-yet-solved today but breaks on a missed past day. Max scans
 * every daily day since launch (not just the visible window). Null for
 * signed-out visitors — streaks are personal.
 */
export async function dailyStreaks(db: Database, userId: string | null): Promise<StreakSummary | null> {
  if (!userId) return null;
  const today = utcDayOf();

  const dailyDays = await db
    .select({ day: dailyChallenges.day, challengeId: challenges.id })
    .from(dailyChallenges)
    .innerJoin(challengeVersions, eq(challengeVersions.id, dailyChallenges.challengeVersionId))
    .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
    .where(sql`${dailyChallenges.day} <= ${today}`)
    .orderBy(asc(dailyChallenges.day));

  const accepted = new Set(
    (
      await db
        .selectDistinct({ challengeId: submissions.challengeId })
        .from(submissions)
        .where(and(eq(submissions.userId, userId), eq(submissions.kind, 'submit'), eq(submissions.status, 'accepted')))
    ).map((r) => r.challengeId),
  );

  const doneByDay = new Map<string, boolean>();
  for (const row of dailyDays) doneByDay.set(row.day, accepted.has(row.challengeId));

  const days: StreakDay[] = [];
  for (let i = STREAK_WINDOW - 1; i >= 0; i--) {
    const day = dayBefore(today, i);
    if (!day) continue;
    const has = doneByDay.has(day);
    days.push({ day, state: !has ? 'none' : doneByDay.get(day) ? 'done' : 'missed' });
  }

  // Current streak: consecutive done days ending today — a not-yet-solved
  // TODAY does not break it (the day is still open), a missed past day does.
  let current = 0;
  for (let i = 0; ; i++) {
    const d = dayBefore(today, i);
    if (!d) break;
    if (doneByDay.get(d) === true) {
      current++;
      continue;
    }
    if (i === 0) continue; // today is open — keep counting from yesterday
    break;
  }

  // Longest streak over ALL daily days: consecutive calendar days marked done.
  let max = 0;
  let run = 0;
  let prev: string | null = null;
  for (const [day] of doneByDay) {
    if (doneByDay.get(day) === true) {
      run = prev !== null && dayBefore(prev, -1) === day ? run + 1 : 1;
      if (run > max) max = run;
    } else {
      run = 0;
    }
    prev = day;
  }

  return { current, max, days };
}

/**
 * Full payload for GET /api/daily: today's challenge (VISIBLE tests only —
 * the same redaction as practice detail), the caller's state when signed in,
 * and the UTC day. `userId` is null for the signed-out view (viewable, not
 * solvable — solving goes through the authed practice flow).
 */
export async function dailyPayload(
  db: Database,
  userId: string | null,
): Promise<{
  day: string;
  challenge: null | {
    slug: string;
    title: string;
    difficulty: string;
    tags: string[];
    statement: string;
    entryFunctions: EntryFunctions;
    starterCode: Partial<Record<string, string>>;
    timeLimitMs: number;
    visibleTests: Array<{ args: unknown[]; expected: string }>;
  };
  you: { attempts: number; solved: boolean } | null;
  streaks: StreakSummary | null;
}> {
  const day = utcDayOf();
  const resolved = await resolveDaily(db, day);
  if (!resolved) return { day, challenge: null, you: null, streaks: await dailyStreaks(db, userId) };

  const [row] = await db
    .select({ challenge: challenges, version: challengeVersions })
    .from(challengeVersions)
    .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
    .where(eq(challengeVersions.id, resolved.versionId))
    .limit(1);
  if (!row) return { day, challenge: null, you: null, streaks: await dailyStreaks(db, userId) };

  const tests = (row.version.tests as Array<{ args: unknown[]; expected: string; hidden: boolean }>).filter(
    (t) => Array.isArray(t.args) && typeof t.expected === 'string' && !t.hidden,
  );
  const entry = entryFunctionsOf(row.version);

  return {
    day,
    challenge: {
      slug: row.challenge.slug,
      title: row.challenge.title,
      difficulty: row.challenge.difficulty,
      tags: row.challenge.tags,
      statement: row.version.statement,
      entryFunctions: entry,
      starterCode: row.version.starterCode as Record<string, string>,
      timeLimitMs: row.version.timeLimitMs,
      visibleTests: tests.map((t) => ({ args: t.args, expected: t.expected })),
    },
    you: userId ? await playerState(db, userId, row.challenge.id) : null,
    streaks: await dailyStreaks(db, userId),
  };
}
