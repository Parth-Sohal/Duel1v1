'use client';

import { io, type Socket } from 'socket.io-client';

/**
 * Game-server socket connection (docs/features/F05-friend-rooms.md).
 * The session cookie cannot cross origins in production (web on Vercel,
 * game server on Render), so the browser first fetches a one-time,
 * short-lived token from the cookie-authed REST API (same-origin via the
 * web proxy) and then connects DIRECTLY to the game server with it.
 */

export const GAME_WS_URL = process.env.NEXT_PUBLIC_GAME_WS_URL ?? 'http://localhost:4000';

/** Fetch a fresh one-time socket token and open an authenticated connection. */
export async function connectGameSocket(): Promise<Socket> {
  const res = await fetch('/api/duels/socket-token');
  if (!res.ok) throw new Error('socket_token_failed');
  const { token } = (await res.json()) as { token: string };
  return io(GAME_WS_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
  });
}

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

/** REST fetch of the room state (SSR-safe restore + poll fallback). */
export async function fetchRoomState(code: string): Promise<{ room: RoomState } | null> {
  const res = await fetch(`/api/duels/rooms/${encodeURIComponent(code)}`);
  if (!res.ok) return null;
  return (await res.json()) as { room: RoomState };
}
