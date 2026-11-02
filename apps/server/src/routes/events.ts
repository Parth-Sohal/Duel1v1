import type { FastifyInstance } from 'fastify';
import { requireAuth } from './auth.js';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { users } from '../db/schema.js';
import { eventCounts, duelsPlayed } from '../services/events.js';
import { env } from '../config/env.js';

type EventDeps = {
  db: Database;
};

/**
 * F10 analytics endpoints (docs/features/F10-hardening.md). Counts are
 * owner-only; the landing-page counter is public but deliberately coarse
 * (a single total — no per-user or per-IP anything).
 */
export async function eventRoutes(app: FastifyInstance, opts: EventDeps): Promise<void> {
  const { db } = opts;
  const auth = { preHandler: requireAuth(db) };

  /** GET /events/counts — owner dashboard: counts per event type. */
  app.get('/events/counts', auth, async (request, reply) => {
    const email = (await db.select({ email: users.email }).from(users).where(eq(users.id, request.user!.id)).limit(1))[0]?.email ?? '';
    if (!email || !env.ownerEmails.includes(email.toLowerCase())) {
      return reply.code(403).send({ error: 'owner_only' });
    }
    return { counts: await eventCounts(db) };
  });

  /** GET /stats/public — the landing-page "duels played" counter. */
  app.get('/stats/public', async () => {
    return { duelsPlayed: await duelsPlayed(db) };
  });
}
