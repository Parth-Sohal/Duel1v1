import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { sessions, users } from '../db/schema.js';
import { SESSION_TTL_MS } from '@coding-arena/shared';
import type { UserPublic } from '@coding-arena/shared';

/**
 * Server-side sessions (docs/features/F01-google-login.md):
 * - the raw token is shown to the browser once (cookie) and never stored;
 * - only its SHA-256 hash goes into `sessions.token_hash`;
 * - resolving a session checks the hash and the expiry in SQL.
 */

/** SHA-256 of a session token — this, never the token, is what we store. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** New opaque session token: 32 random bytes, URL-safe. */
export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Create a session row for a user; returns the raw token (goes in the cookie). */
export async function createSession(
  db: Database,
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt };
}

/** Resolve a session token to its user, or null when unknown/expired. */
export async function resolveSession(
  db: Database,
  token: string,
): Promise<{ user: UserPublic; sessionId: string } | null> {
  const tokenHash = hashToken(token);
  const rows = await db
    .select({
      sessionId: sessions.id,
      id: users.id,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      points: users.points,
      wins: users.wins,
      losses: users.losses,
      draws: users.draws,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    sessionId: row.sessionId,
    user: {
      id: row.id,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      points: row.points,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
    },
  };
}

/** Delete one session by raw token (logout). */
export async function deleteSession(db: Database, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}
