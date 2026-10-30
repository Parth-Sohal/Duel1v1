import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Server as SocketIOServer, Socket } from 'socket.io';
import { SOCKET_TOKEN_TTL_MS } from '@coding-arena/shared';
import type { Database } from '../db/index.js';
import { matchPlayers } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { activeMatchFor, bothReady, getRoomById, getRoomByCode, leaveRoom, normalizeInviteCode, roomState, setReady, type RoomRow } from './rooms.js';
import { getMatchWithPlayers, startMatch } from './matches.js';

/**
 * Socket.IO gateway (docs/features/F05-friend-rooms.md). Sockets are ONLY
 * broadcast channels — every state change is read from or written to Postgres.
 * Cross-origin auth: one-time short-lived tokens issued over the cookie-authed
 * REST API (the session cookie itself cannot cross origins in production).
 */

// ---------------------------------------------------------------------------
// One-time socket tokens (module state: single game server, decision 2)
// ---------------------------------------------------------------------------

const socketTokens = new Map<string, { userId: string; expiresAt: number }>();

/** Issue a one-time token for the user (called by the REST route). */
export function issueSocketToken(userId: string): { token: string; expiresInMs: number } {
  const token = randomBytes(32).toString('hex');
  socketTokens.set(token, { userId, expiresAt: Date.now() + SOCKET_TOKEN_TTL_MS });
  // opportunistic cleanup of stale tokens
  for (const [t, v] of socketTokens) if (v.expiresAt < Date.now()) socketTokens.delete(t);
  return { token, expiresInMs: SOCKET_TOKEN_TTL_MS };
}

/** Validate + consume a token. One-time, short-lived, user-bound. */
function consumeSocketToken(token: unknown): string | null {
  if (typeof token !== 'string' || token.length === 0) return null;
  const entry = socketTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) return null;
  socketTokens.delete(token); // one-time
  return entry.userId;
}

// ---------------------------------------------------------------------------
// Presence (module state: which users have a live socket right now)
// ---------------------------------------------------------------------------

const presence = new Map<string, Set<string>>(); // userId -> socket ids

function setOnline(userId: string, socketId: string): void {
  const set = presence.get(userId) ?? new Set<string>();
  set.add(socketId);
  presence.set(userId, set);
}

function setOffline(userId: string, socketId: string): boolean {
  const set = presence.get(userId);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) {
    presence.delete(userId);
    return true; // user fully offline now
  }
  return false;
}

export function isOnline(userId: string): boolean {
  return presence.has(userId);
}

// ---------------------------------------------------------------------------
// Gateway helpers (decorated onto Fastify so REST routes can broadcast)
// ---------------------------------------------------------------------------

export type Gateway = {
  /** Push fresh room state to everyone in the room. */
  broadcastRoomState: (roomId: string) => Promise<void>;
  /** Tell the room a match started. */
  broadcastMatchStarted: (roomId: string, matchId: string) => void;
  /** Push the opponent-visible progress line into the match room (never code/outputs). */
  broadcastProgress: (matchId: string, progress: { userId: string; testsPassed: number; attempts: number }) => void;
  /** Push the finished overlay to both players. */
  broadcastMatchEnded: (matchId: string, payload: { resultType: string; winnerId: string | null; deltas: Record<string, number> }) => Promise<void>;
};

declare module 'fastify' {
  interface FastifyInstance {
    gateway: Gateway;
  }
}

const roomChannel = (roomId: string) => `room:${roomId}`;
const matchChannel = (matchId: string) => `match:${matchId}`;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function setupGateway(io: SocketIOServer, db: Database, app: FastifyInstance): void {
  const log = app.log;

  async function pushRoomState(room: RoomRow): Promise<void> {
    const state = await roomState(db, room, isOnline);
    io.to(roomChannel(room.id)).emit('room_state', state);
  }

  async function pushRoomStateById(roomId: string): Promise<void> {
    const room = await getRoomById(db, roomId);
    if (room) await pushRoomState(room);
  }

  /** Mark a player disconnected in their active match (grace timer starts). */
  async function markDisconnected(userId: string): Promise<void> {
    const active = await activeMatchFor(db, userId);
    if (!active) return;
    await db
      .update(matchPlayers)
      .set({ disconnectedAt: new Date() })
      .where(and(eq(matchPlayers.matchId, active.id), eq(matchPlayers.userId, userId)));
  }

  /** Clear the disconnect mark on rejoin (within the grace period). */
  async function markReconnected(userId: string): Promise<void> {
    const active = await activeMatchFor(db, userId);
    if (!active) return;
    await db
      .update(matchPlayers)
      .set({ disconnectedAt: null })
      .where(and(eq(matchPlayers.matchId, active.id), eq(matchPlayers.userId, userId)));
  }

  // Token auth on the handshake — no token, no socket.
  io.use((socket, next) => {
    const userId = consumeSocketToken(socket.handshake.auth?.token);
    if (!userId) return next(new Error('invalid_socket_token'));
    socket.data.userId = userId;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    setOnline(userId, socket.id);
    log.info({ socketId: socket.id, userId }, 'socket authenticated');

    socket.on('room:join', async (raw: unknown) => {
      try {
        const body = (raw ?? {}) as { code?: unknown };
        const code = typeof body.code === 'string' ? normalizeInviteCode(body.code) : '';
        const target = code ? await getRoomByCode(db, code) : null;
        if (!target || target.status === 'closed' || target.expiresAt < new Date()) {
          socket.emit('room_error', { code: 'room_unavailable' });
          return;
        }
        if (target.hostId !== userId && target.guestId !== userId) {
          socket.emit('room_error', { code: 'not_a_member' });
          return;
        }
        await markReconnected(userId);
        await socket.join(roomChannel(target.id));
        socket.data.roomId = target.id;
        await pushRoomState(target);
      } catch (err) {
        log.error({ err, userId }, 'room:join failed');
        socket.emit('room_error', { code: 'internal_error' });
      }
    });

    socket.on('room:ready', async (raw: unknown) => {
      try {
        const body = (raw ?? {}) as { ready?: unknown };
        const roomId = socket.data.roomId as string | undefined;
        if (!roomId) return socket.emit('room_error', { code: 'not_in_room' });
        const room = await getRoomById(db, roomId);
        if (!room || room.status === 'closed') return;
        if (room.hostId !== userId && room.guestId !== userId) return;
        await setReady(db, room, userId, body.ready === true);
        const fresh = await getRoomById(db, roomId);
        if (fresh) await pushRoomState(fresh);
      } catch (err) {
        log.error({ err, userId }, 'room:ready failed');
      }
    });

    socket.on('room:leave', async () => {
      try {
        const roomId = socket.data.roomId as string | undefined;
        if (!roomId) return;
        const room = await getRoomById(db, roomId);
        if (!room) return;
        if (room.hostId !== userId && room.guestId !== userId) return;
        // Can't leave a live match — that is a forfeit handled by grace/sweeper.
        if (room.status === 'in_match') {
          socket.emit('room_error', { code: 'match_in_progress' });
          return;
        }
        const result = await leaveRoom(db, room, userId);
        await socket.leave(roomChannel(room.id));
        socket.data.roomId = undefined;
        if (result === 'closed') {
          io.to(roomChannel(room.id)).emit('room_closed', { reason: 'host_left' });
          io.in(roomChannel(room.id)).socketsLeave(roomChannel(room.id));
        } else {
          await pushRoomStateById(room.id);
        }
      } catch (err) {
        log.error({ err, userId }, 'room:leave failed');
      }
    });

    socket.on('match:start', async () => {
      try {
        const roomId = socket.data.roomId as string | undefined;
        if (!roomId) return socket.emit('room_error', { code: 'not_in_room' });
        const room = await getRoomById(db, roomId);
        if (!room) return;
        if (room.hostId !== userId) return socket.emit('room_error', { code: 'host_only' });
        if (room.status !== 'full' || !bothReady(room)) {
          return socket.emit('room_error', { code: 'not_both_ready' });
        }
        const result = await startMatch(db, room);
        if (!result.ok) return socket.emit('room_error', { code: result.error });
        io.to(roomChannel(room.id)).emit('match_started', { matchId: result.matchId });
        await pushRoomStateById(room.id);
        log.info({ matchId: result.matchId, roomId: room.id }, 'match started');
      } catch (err) {
        log.error({ err, userId }, 'match:start failed');
        socket.emit('room_error', { code: 'internal_error' });
      }
    });

    socket.on('match:join', async (raw: unknown) => {
      try {
        const body = (raw ?? {}) as { matchId?: unknown };
        const matchId = typeof body.matchId === 'string' ? body.matchId : '';
        const found = await getMatchWithPlayers(db, matchId);
        if (!found || !found.players.some((p) => p.userId === userId)) {
          return socket.emit('room_error', { code: 'not_a_participant' });
        }
        await markReconnected(userId);
        await socket.join(matchChannel(matchId));
        socket.data.matchId = matchId;
      } catch (err) {
        log.error({ err, userId }, 'match:join failed');
      }
    });

    socket.on('disconnect', async () => {
      const fullyOffline = setOffline(userId, socket.id);
      if (!fullyOffline) return;
      log.info({ userId }, 'user fully offline');
      const roomId = socket.data.roomId as string | undefined;
      try {
        if (roomId) await pushRoomStateById(roomId); // presence dot off
        await markDisconnected(userId); // starts the forfeit grace clock
      } catch (err) {
        log.error({ err, userId }, 'disconnect handling failed');
      }
    });
  });

  const gateway: Gateway = {
    broadcastRoomState: pushRoomStateById,
    broadcastMatchStarted: (roomId, matchId) => {
      io.to(roomChannel(roomId)).emit('match_started', { matchId });
    },
    broadcastProgress: (matchId, progress) => {
      io.to(matchChannel(matchId)).emit('progress', progress);
    },
    broadcastMatchEnded: async (matchId, payload) => {
      io.to(matchChannel(matchId)).emit('match_ended', payload);
      // Also refresh the originating room (status flips back out of in_match flow via its own state push)
      const found = await getMatchWithPlayers(db, matchId);
      if (found?.match.roomId) {
        const room = await getRoomById(db, found.match.roomId);
        if (room) {
          await pushRoomState(room);
        }
      }
    },
  };

  app.decorate('gateway', gateway);
}
