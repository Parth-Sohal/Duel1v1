import 'server-only';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@coding-arena/shared';
import type { ChallengeDetail, VisibleTest } from './practice';

/**
 * F09 daily data access (docs/features/F09-daily-challenge.md). Same pattern
 * as lib/practice.ts, but the daily is VIEWABLE signed-out: the cookie is
 * forwarded only when present, and the API never 401s this route.
 */

export type StreakDay = { day: string; state: 'done' | 'missed' | 'none' };

export type DailyPayload = {
  day: string;
  challenge: null | (Omit<ChallengeDetail, 'memoryLimitMb' | 'version'> & { visibleTests: VisibleTest[] });
  you: { attempts: number; solved: boolean } | null;
  streaks: { current: number; max: number; days: StreakDay[] } | null;
};

/** Today's challenge for everyone; null data = server unreachable. */
export async function getDaily(): Promise<DailyPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const origin = process.env.API_ORIGIN ?? 'http://localhost:4000';
  try {
    const res = await fetch(`${origin}/api/daily`, {
      headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {},
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as DailyPayload;
  } catch {
    return null;
  }
}
