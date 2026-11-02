import type { FastifyInstance } from 'fastify';
import { requireAuth } from './auth.js';
import { eq } from 'drizzle-orm';
import { FEEDBACK_MAX_CHARS } from '@coding-arena/shared';
import type { Database } from '../db/index.js';
import { users } from '../db/schema.js';
import { allowFeedback } from '../services/rate-limit.js';
import { recordEvent } from '../services/events.js';
import { feedback } from '../db/schema.js';
import { env } from '../config/env.js';

type FeedbackDeps = {
  db: Database;
};

/**
 * F10 feedback (docs/features/F10-hardening.md): signed-in players send short
 * notes; the owner reads them (DB / the owner counts endpoint). Rate-limited
 * per user; length capped server-side.
 */
export async function feedbackRoutes(app: FastifyInstance, opts: FeedbackDeps): Promise<void> {
  const { db } = opts;

  /** POST /feedback — one short note. Validation first: a rejected draft
   * (empty / too long) must not burn the sender's rate-limit budget. */
  app.post('/feedback', { preHandler: requireAuth(db) }, async (request, reply) => {
    const body = (request.body ?? {}) as { message?: unknown };
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (message.length === 0) {
      return reply.code(400).send({ error: 'empty_message', message: 'Write a few words first.' });
    }
    if (message.length > FEEDBACK_MAX_CHARS) {
      return reply.code(400).send({ error: 'too_long', message: `Keep it under ${FEEDBACK_MAX_CHARS} characters.` });
    }
    if (!allowFeedback(request.user!.id)) {
      return reply.code(429).send({ error: 'rate_limited', message: 'Feedback already sent — try again in a few minutes.' });
    }
    const [saved] = await db
      .insert(feedback)
      .values({ userId: request.user!.id, message })
      .returning({ id: feedback.id });
    app.log.info({ userId: request.user!.id, feedbackId: saved.id, chars: message.length }, 'feedback received');
    await recordEvent(db, { type: 'feedback', userId: request.user!.id });
    return { ok: true, id: saved.id };
  });

  /** GET /feedback — the OWNER's reading list (latest 100, with names). */
  app.get('/feedback', { preHandler: requireAuth(db) }, async (request, reply) => {
    const email = (await db.select({ email: users.email }).from(users).where(eq(users.id, request.user!.id)).limit(1))[0]?.email ?? '';
    if (!email || !env.ownerEmails.includes(email.toLowerCase())) {
      return reply.code(403).send({ error: 'owner_only' });
    }
    const rows = await db
      .select({ id: feedback.id, message: feedback.message, from: users.displayName, createdAt: feedback.createdAt })
      .from(feedback)
      .innerJoin(users, eq(users.id, feedback.userId))
      .orderBy(feedback.createdAt)
      .limit(100);
    return { feedback: rows.reverse() };
  });
}
