import 'server-only';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@coding-arena/shared';
import type { UserPublic } from '@coding-arena/shared';

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
