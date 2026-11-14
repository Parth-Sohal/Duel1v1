import 'server-only';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@coding-arena/shared';
import type { LeaderboardResponse, UserPublic } from '@coding-arena/shared';

/**
 * Server-side session lookup. The cookie lives on the web origin (the game
 * server sets it through the /api proxy), so we can read it here and ask the
 * game server who it belongs to. The browser is never trusted on its own.
 */
export async function getCurrentUser(): Promise<UserPublic | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const origin = process.env.API_ORIGIN ?? 'http://localhost:4000';
  const res = await fetch(`${origin}/api/auth/me`, {
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { user?: UserPublic };
  return data.user ?? null;
}

/**
 * Server-side lookup of another player's public profile (F02). Rendered on
 * the server with a forwarded cookie so a refresh always shows current data.
 * Returns null for unknown ids (the page then renders a designed 404).
 */
export async function getPublicUser(id: string): Promise<UserPublic | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const origin = process.env.API_ORIGIN ?? 'http://localhost:4000';
  const res = await fetch(`${origin}/api/users/${encodeURIComponent(id)}`, {
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { user?: UserPublic };
  return data.user ?? null;
}

/**
 * F09 leaderboard feed, server-rendered. Works signed out; when a session
 * cookie exists it is forwarded so the API can add the viewer's own rank.
 * Returns null on a network/API failure — the page shows a designed retry.
 */
export async function getLeaderboard(): Promise<LeaderboardResponse | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const origin = process.env.API_ORIGIN ?? 'http://localhost:4000';

  try {
    const res = await fetch(`${origin}/api/leaderboard`, {
      headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : undefined,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as LeaderboardResponse;
  } catch {
    return null;
  }
}
