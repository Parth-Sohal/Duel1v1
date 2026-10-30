import type { FastifyInstance } from 'fastify';
import { requireAuth } from './auth.js';
import type { Database } from '../db/index.js';
import {
  activeMatchFor,
  bothReady,
  createRoom,
  findLiveRoomByCode,
  getRoomByCode,
  joinRoom,
  leaveRoom,
  normalizeInviteCode,
  roomState,
} from '../services/rooms.js';
import { startMatch } from '../services/matches.js';
import { issueSocketToken } from '../services/gateway.js';

/**
 * F05 friend-room REST routes (docs/features/F05-friend-rooms.md), all
 * cookie-authed. Live updates flow over the socket gateway; these endpoints
 * create/join/read rooms and hand out one-time socket tokens.
 */

type DuelDeps = {
  db: Database;
};

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export async function duelRoutes(app: FastifyInstance, opts: DuelDeps): Promise<void> {
  const { db } = opts;
  const auth = { preHandler: requireAuth(db) };

  /** POST /duels/rooms — create a room (host is seat 1). */
  app.post('/duels/rooms', auth, async (request, reply) => {
    const body = (request.body ?? {}) as { difficulty?: unknown };
    const difficulty =
      typeof body.difficulty === 'string' && (DIFFICULTIES as readonly string[]).includes(body.difficulty)
        ? (body.difficulty as (typeof DIFFICULTIES)[number])
        : null;
    const blocker = await activeMatchFor(db, request.user!.id);
    if (blocker) {
      return reply.code(409).send({ error: 'already_in_match' });
    }
    const room = await createRoom(db, request.user!.id, difficulty);
    return { room: await roomState(db, room) };
  });

  /** POST /duels/rooms/:code/join — take seat 2 (atomic). */
  app.post('/duels/rooms/:code/join', auth, async (request, reply) => {
    const raw = (request.params as { code: string }).code;
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > 16) {
      return reply.code(404).send({ error: 'room_unavailable' });
    }
    const room = await findLiveRoomByCode(db, normalizeInviteCode(raw));
    if (!room) {
      return reply.code(404).send({ error: 'room_unavailable' });
    }
    if (room.hostId === request.user!.id || room.guestId === request.user!.id) {
      return reply.code(200).send({ room: await roomState(db, room) }); // already seated
    }
    if (await activeMatchFor(db, request.user!.id)) {
      return reply.code(409).send({ error: 'already_in_match' });
    }
    const result = await joinRoom(db, room, request.user!.id);
    if (result === 'full') {
      return reply.code(409).send({ error: 'room_full' });
    }
    const fresh = await getRoomByCode(db, room.inviteCode);
    return reply.code(200).send({ room: await roomState(db, fresh ?? room) });
  });

  /** GET /duels/rooms/:code — members-only room state (poll fallback + SSR restore). */
  app.get('/duels/rooms/:code', auth, async (request, reply) => {
    const raw = (request.params as { code: string }).code;
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > 16) {
      return reply.code(404).send({ error: 'room_unavailable' });
    }
    const room = await getRoomByCode(db, normalizeInviteCode(raw));
    if (!room) {
      return reply.code(404).send({ error: 'room_unavailable' });
    }
    if (room.hostId !== request.user!.id && room.guestId !== request.user!.id) {
      return reply.code(403).send({ error: 'not_a_member' });
    }
    return { room: await roomState(db, room) };
  });

  /** POST /duels/rooms/:code/leave — seat 2 leaves; the host leaving closes the room. */
  app.post('/duels/rooms/:code/leave', auth, async (request, reply) => {
    const raw = (request.params as { code: string }).code;
    const room = await getRoomByCode(db, normalizeInviteCode(raw ?? ''));
    if (!room) {
      return reply.code(404).send({ error: 'room_unavailable' });
    }
    if (room.hostId !== request.user!.id && room.guestId !== request.user!.id) {
      return reply.code(403).send({ error: 'not_a_member' });
    }
    if (room.status === 'in_match') {
      return reply.code(409).send({ error: 'match_in_progress' });
    }
    await leaveRoom(db, room, request.user!.id);
    return { ok: true };
  });

  /** GET /duels/socket-token — one-time socket auth token (see F05 spec). */
  app.get('/duels/socket-token', auth, async (request) => {
    return issueSocketToken(request.user!.id);
  });

  /** POST /duels/rooms/:code/start — host only; both ready → creates the match (F06). */
  app.post('/duels/rooms/:code/start', auth, async (request, reply) => {
    const room = await getRoomByCode(db, normalizeInviteCode((request.params as { code: string }).code ?? ''));
    if (!room || room.status === 'closed' || room.expiresAt < new Date()) {
      return reply.code(404).send({ error: 'room_unavailable' });
    }
    if (room.hostId !== request.user!.id) {
      return reply.code(403).send({ error: 'host_only' });
    }
    if (room.status !== 'full' || room.guestId === null || !bothReady(room)) {
      return reply.code(409).send({ error: 'not_both_ready' });
    }
    const result = await startMatch(db, room);
    if (!result.ok) {
      const code = result.error === 'challenge_unavailable' ? 503 : 409;
      return reply.code(code).send({ error: result.error });
    }
    app.gateway.broadcastMatchStarted(room.id, result.matchId);
    await app.gateway.broadcastRoomState(room.id);
    app.log.info({ matchId: result.matchId, roomId: room.id }, 'match started (REST)');
    return { matchId: result.matchId };
  });
}
