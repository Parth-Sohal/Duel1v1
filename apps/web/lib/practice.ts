import 'server-only';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@coding-arena/shared';

/**
 * Practice-mode data access for the web app (docs/features/F04-practice-mode.md).
 * Same pattern as lib/session.ts: server-side fetch to the game server with the
 * player's forwarded cookie. The browser never calls the game server directly
 * for page data, and hidden tests never reach this layer at all (the API strips
 * them before responding).
 */

export type ChallengeListItem = {
  slug: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  solved: boolean;
  attempts: number;
};

export type VisibleTest = { args: unknown[]; expected: string };

export type ChallengeDetail = {
  slug: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  version: number;
  statement: string;
  entryFunctions: { javascript: string; python: string };
  starterCode: { javascript: string; python: string };
  timeLimitMs: number;
  memoryLimitMb: number;
  visibleTests: VisibleTest[];
};

async function apiFetch(path: string): Promise<{ ok: boolean; status: number; data: unknown }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return { ok: false, status: 401, data: null };

  const origin = process.env.API_ORIGIN ?? 'http://localhost:4000';
  const res = await fetch(`${origin}${path}`, {
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return { ok: false, status: res.status, data: null };
  return { ok: true, status: res.status, data: await res.json() };
}

/** The practice list; null when the server is unreachable (page shows an error state). */
export async function getChallengeList(): Promise<ChallengeListItem[] | null> {
  const res = await apiFetch('/api/challenges');
  if (!res.ok) return null;
  return (res.data as { challenges?: ChallengeListItem[] }).challenges ?? [];
}

/** One challenge's current version (VISIBLE tests only); null = unknown/unpublished. */
export async function getChallengeDetail(slug: string): Promise<ChallengeDetail | null> {
  const res = await apiFetch(`/api/challenges/${encodeURIComponent(slug)}`);
  if (!res.ok) return null;
  return (res.data as { challenge?: ChallengeDetail }).challenge ?? null;
}
