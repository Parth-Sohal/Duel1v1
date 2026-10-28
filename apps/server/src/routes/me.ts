import type { FastifyInstance } from 'fastify';
import { requireAuth } from './auth.js';
import type { Database } from '../db/index.js';
import { getPublicUserById, updateDisplayName, validateDisplayName } from '../services/users.js';

type MeDeps = {
  db: Database;
};

/** UUID check before querying — a malformed id is simply "unknown" (404). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * F02 profile routes (docs/features/F02-profile.md). All cookie-authed;
 * public data only — email and google_id never leave the server.
 */
export async function meRoutes(app: FastifyInstance, opts: MeDeps): Promise<void> {
  const { db } = opts;
  const auth = { preHandler: requireAuth(db) };

  /** GET /me — own profile (same public shape as /auth/me). */
  app.get('/me', auth, async (request) => {
    return { user: request.user };
  });

  /**
   * PATCH /me — edit the display name. Body: { displayName }. The client
   * field is a convenience, not the guard: validation is server-side
   * (trim, 2–30 chars after trim), the DB CHECK is the last line of defense.
   */
  app.patch('/me', auth, async (request, reply) => {
    const body = (request.body ?? {}) as { displayName?: unknown };
    const name = validateDisplayName(body.displayName);
    if (!name) {
      return reply.code(400).send({
        error: 'invalid_display_name',
        message: 'Display name must be 2–30 characters (spaces around it are trimmed).',
      });
    }

    const user = await updateDisplayName(db, request.user!.id, name);
    if (!user) {
      return reply.code(404).send({ error: 'user_not_found' });
    }
    app.log.info({ userId: user.id }, 'display name updated');
    return { user };
  });

  /** GET /users/:id — another player's public profile; 404 when unknown. */
  app.get('/users/:id', auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!UUID_RE.test(id)) {
      return reply.code(404).send({ error: 'user_not_found' });
    }
    const user = await getPublicUserById(db, id);
    if (!user) {
      return reply.code(404).send({ error: 'user_not_found' });
    }
    return { user };
  });
}
