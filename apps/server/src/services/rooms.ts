import { and, eq, gt, lt, ne, or, isNull, sql } from 'drizzle-orm';
import { ROOM_TTL_MS } from '@coding-arena/shared';
import type { Database } from '../db/index.js';
import { matches, matchPlayers, rooms, users } from '../db/schema.js';

/**
 * Friend-room data access (docs/features/F05-friend-rooms.md).
 * Postgres is authoritative — sockets only push. Membership: host is seat 1,
 * `guest_id` (once set) is seat 2. Ready toggles persist in ready_state jsonb
 * so a page refresh restores the full room state.
 */

const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32 - I/L/O/U excluded
const CODE_LENGTH = 8;

/** 8-char Crockford base32 invite code (crypto-random). */
export function generateInviteCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = '';
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return code;
}

/** Case-insensitive normalize: uppercased, confusable letters mapped in (I/L→1, O→0). */
export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[IL]/g, '1').replace(/O/g, '0');
}

export type RoomRow = typeof rooms.$inferSelect;

export type RoomPlayer = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  points: number;
  isHost: boolean;
  seat: 1 | 2;
  ready: boolean;
  online: boolean;
};

export type RoomState = {
  id: string;
  inviteCode: string;
  status: string;
  difficulty: string | null;
  expiresAt: string;
  players: RoomPlayer[];
  matchId: string | null;
};

/** Online flags are injected by the gateway (socket presence, in-memory). */
export type PresenceLookup = (userId: string) => boolean;

/** Build the full public room state (players + ready + status). */
export async function roomState(db: Database, room: RoomRow, online: PresenceLookup = () => false): Promise<RoomState> {
  const seatIds = [room.hostId, room.guestId].filter((v): v is string => v !== null);
  const playerRows = seatIds.length
    ? await db.select().from(users).where(or(...seatIds.map((id) => eq(users.id, id))))
    : [];
  const players: RoomPlayer[] = seatIds.map((id, i) => {
    const u = playerRows.find((p) => p.id === id);
    const map = (room.readyState ?? {}) as Record<string, unknown>;
    return {
      userId: id,
      displayName: u?.displayName ?? 'UNKNOWN',
      avatarUrl: u?.avatarUrl ?? null,
      points: u?.points ?? 0,
      isHost: i === 0,
      seat: i === 0 ? 1 : 2,
      ready: map[id] === true,
      online: online(id),
    };
  });
  // The room's live match, if started from this room.
  const m = await db
    .select({ id: matches.id })
    .from(matches)
    .where(and(eq(matches.roomId, room.id), ne(matches.status, 'finished')))
    .limit(1);
  return {
    id: room.id,
    inviteCode: room.inviteCode,
    status: room.status,
    difficulty: room.difficulty,
    expiresAt: room.expiresAt.toISOString(),
    players,
    matchId: m[0]?.id ?? null,
  };
}

/** Live (not closed, not expired) room by invite code. */
export async function findLiveRoomByCode(db: Database, code: string): Promise<RoomRow | null> {
  const rows = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.inviteCode, code), ne(rooms.status, 'closed'), gt(rooms.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

export async function getRoomByCode(db: Database, code: string): Promise<RoomRow | null> {
  const rows = await db.select().from(rooms).where(eq(rooms.inviteCode, code)).limit(1);
  return rows[0] ?? null;
}

export async function getRoomById(db: Database, id: string): Promise<RoomRow | null> {
  const rows = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Create a room; retries on the (unlikely) invite-code collision. */
export async function createRoom(
  db: Database,
  hostId: string,
  difficulty: 'easy' | 'medium' | 'hard' | null,
): Promise<RoomRow> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [room] = await db
        .insert(rooms)
        .values({
          inviteCode: generateInviteCode(),
          hostId,
          difficulty,
          expiresAt: new Date(Date.now() + ROOM_TTL_MS),
          status: 'open',
        })
        .returning();
      return room;
    } catch (err) {
      lastErr = err; // unique invite_code — retry with a fresh code
    }
  }
  throw lastErr;
}

/** Atomic join: fills seat 2 only if the seat is still empty. Returns 'joined' | 'full'. */
export async function joinRoom(db: Database, room: RoomRow, userId: string): Promise<'joined' | 'full'> {
  const updated = await db
    .update(rooms)
    .set({ guestId: userId, status: 'full' })
    .where(and(eq(rooms.id, room.id), isNull(rooms.guestId)))
    .returning({ id: rooms.id });
  return updated.length === 1 ? 'joined' : 'full';
}

/** Leave: seat 2 clears; the host leaving closes the room. */
export async function leaveRoom(db: Database, room: RoomRow, userId: string): Promise<'left' | 'closed'> {
  if (room.hostId === userId) {
    await db.update(rooms).set({ status: 'closed' }).where(eq(rooms.id, room.id));
    return 'closed';
  }
  if (room.guestId === userId) {
    const map: Record<string, unknown> = { ...(room.readyState ?? {}) };
    delete map[userId];
    await db.update(rooms).set({ guestId: null, status: 'open', readyState: map }).where(eq(rooms.id, room.id));
    return 'left';
  }
  return 'left';
}

/** Toggle the persisted ready bit for one member. */
export async function setReady(db: Database, room: RoomRow, userId: string, ready: boolean): Promise<void> {
  // Atomic jsonb merge: a read-modify-write here loses one player's flag when
  // both seats toggle at nearly the same moment (soak test caught exactly that).
  await db
    .update(rooms)
    .set(
      ready
        ? { readyState: sql`coalesce(${rooms.readyState}, '{}'::jsonb) || jsonb_build_object(${userId}::text, to_jsonb(true))` }
        : { readyState: sql`coalesce(${rooms.readyState}, '{}'::jsonb) - ${userId}::text` },
    )
    .where(eq(rooms.id, room.id));
}

/** Both seats present and ready → host may start. */
export function bothReady(room: RoomRow): boolean {
  if (room.guestId === null) return false;
  const map = (room.readyState ?? {}) as Record<string, unknown>;
  return map[room.hostId] === true && map[room.guestId] === true;
}

/** Mark the room in-match (after the match row exists). */
export async function setRoomInMatch(db: Database, roomId: string): Promise<void> {
  await db.update(rooms).set({ status: 'in_match' }).where(eq(rooms.id, roomId));
}

/** Close expired rooms (sweeper). Returns how many were closed. */
export async function closeExpiredRooms(db: Database): Promise<number> {
  const closed = await db
    .update(rooms)
    .set({ status: 'closed' })
    .where(and(ne(rooms.status, 'closed'), ne(rooms.status, 'in_match'), lt(rooms.expiresAt, new Date())))
    .returning({ id: rooms.id });
  return closed.length;
}

/** The player's active (unfinished) match, if any — blocks joining new rooms. */
export async function activeMatchFor(db: Database, userId: string): Promise<{ id: string } | null> {
  const rows = await db
    .select({ id: matches.id })
    .from(matches)
    .innerJoin(matchPlayers, and(eq(matchPlayers.matchId, matches.id), eq(matchPlayers.userId, userId)))
    .where(and(ne(matches.status, 'finished'), isNull(matches.finishedAt)))
    .limit(1);
  return rows[0] ?? null;
}
