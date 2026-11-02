import { sql } from 'drizzle-orm';
import type { EventType } from '@coding-arena/shared';
import type { Database } from '../db/index.js';
import { events } from '../db/schema.js';

/**
 * F10 basic analytics (docs/features/F10-hardening.md). Append-only product
 * events, written server-side — no third-party trackers, no PII beyond ids.
 * Events never break the request path: a failed insert logs a warning and
 * moves on (analytics is best-effort, gameplay is authoritative).
 */

type EventInput = {
  type: EventType;
  userId?: string | null;
  matchId?: string | null;
  meta?: Record<string, unknown>;
};

export async function recordEvent(db: Database, input: EventInput): Promise<void> {
  try {
    await db.insert(events).values({
      type: input.type,
      userId: input.userId ?? null,
      matchId: input.matchId ?? null,
      meta: input.meta ?? {},
    });
  } catch {
    // Analytics must never break gameplay — swallow + let pino's request logs carry context.
  }
}

/** Counts per event type, for the owner-only dashboard endpoint. */
export async function eventCounts(db: Database): Promise<Record<string, number>> {
  const rows = await db
    .select({ type: events.type, count: sql<number>`count(*)::int` })
    .from(events)
    .groupBy(events.type);
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.type] = r.count;
  return counts;
}

/** The landing-page counter: total duels started (friend + bot). */
export async function duelsPlayed(db: Database): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .where(sql`${events.type} = 'match_started'`);
  return row?.count ?? 0;
}
