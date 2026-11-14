import { sql } from 'drizzle-orm';
import {
  LEADERBOARD_TOP_N,
  type LeaderboardEntry,
  type LeaderboardResponse,
  type LeaderboardResult,
} from '@coding-arena/shared';
import type { Database } from '../db/index.js';

/**
 * F09 leaderboard (docs/features/F09-matchmaking-leaderboard.md).
 *
 * Only real finished human duels count: bots are excluded, practice runs never
 * increment win/loss/draw counters, and a player with no finished human match
 * is unranked. The ranking metric is the same `users.points` shown in the
 * header; ties are deterministic (points, wins, name, id).
 */

type RankedRow = {
  rank: number | string;
  id: string;
  display_name: string;
  avatar_url: string | null;
  points: number;
  wins: number;
  losses: number;
  draws: number;
};

type RecentRow = {
  user_id: string;
  winner_id: string | null;
  result_type: string | null;
};

const ELIGIBLE = sql`u.is_bot = false and (u.wins + u.losses + u.draws) > 0`;
const RANK_ORDER = sql`u.points desc, u.wins desc, lower(u.display_name) asc, u.id asc`;

function toEntry(row: RankedRow, lastFive: LeaderboardResult[]): LeaderboardEntry {
  return {
    rank: Number(row.rank),
    userId: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    points: Number(row.points),
    wins: Number(row.wins),
    losses: Number(row.losses),
    draws: Number(row.draws),
    lastFive,
  };
}

function resultFor(userId: string, row: RecentRow): LeaderboardResult {
  if (row.result_type === 'draw') return 'D';
  return row.winner_id === userId ? 'W' : 'L';
}

/** Last five finished HUMAN matches per user, newest first. */
async function lastFiveFor(db: Database, userIds: string[]): Promise<Map<string, LeaderboardResult[]>> {
  const result = new Map<string, LeaderboardResult[]>();
  if (userIds.length === 0) return result;

  const placeholders = sql.join(
    userIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  );
  const rows = await db.execute<RecentRow>(sql`
    select user_id, winner_id, result_type
    from (
      select mp.user_id, m.winner_id, m.result_type,
             row_number() over (
               partition by mp.user_id
               order by m.finished_at desc nulls last, m.id desc
             ) as rn
      from match_players mp
      join matches m on m.id = mp.match_id
      where m.status = 'finished'
        and m.is_bot_match = false
        and mp.user_id in (${placeholders})
    ) recent
    where rn <= 5
    order by user_id, rn
  `);

  for (const row of rows) {
    const list = result.get(row.user_id) ?? [];
    list.push(resultFor(row.user_id, row));
    result.set(row.user_id, list);
  }
  return result;
}

/** Public leaderboard: top N ranked humans + the optional viewer's own row. */
export async function getLeaderboard(db: Database, viewerId: string | null): Promise<LeaderboardResponse> {
  const topRows = await db.execute<RankedRow>(sql`
    with ranked as (
      select u.id, u.display_name, u.avatar_url, u.points, u.wins, u.losses, u.draws,
             row_number() over (order by ${RANK_ORDER}) as rank
      from users u
      where ${ELIGIBLE}
    )
    select * from ranked
    where rank <= ${LEADERBOARD_TOP_N}
    order by rank asc
  `);

  let viewerRow: RankedRow | null = null;
  if (viewerId) {
    const viewerRows = await db.execute<RankedRow>(sql`
      with ranked as (
        select u.id, u.display_name, u.avatar_url, u.points, u.wins, u.losses, u.draws,
               row_number() over (order by ${RANK_ORDER}) as rank
        from users u
        where ${ELIGIBLE}
      )
      select * from ranked
      where ranked.id = ${viewerId}::uuid
    `);
    viewerRow = viewerRows[0] ?? null;
  }

  const totalRows = await db.execute<{ total: number }>(sql`
    select count(*)::int as total
    from users u
    where ${ELIGIBLE}
  `);

  const ids = [...new Set([...topRows.map((r) => r.id), ...(viewerRow ? [viewerRow.id] : [])])];
  const lastFive = await lastFiveFor(db, ids);

  return {
    entries: topRows.map((row) => toEntry(row, lastFive.get(row.id) ?? [])),
    totalPlayers: Number(totalRows[0]?.total ?? 0),
    viewer: viewerRow ? toEntry(viewerRow, lastFive.get(viewerRow.id) ?? []) : null,
  };
}
