import { eq } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { users } from '../db/schema.js';
import { DISPLAY_NAME_MAX, DISPLAY_NAME_MIN } from '@coding-arena/shared';
import type { UserPublic } from '@coding-arena/shared';

/** Columns a public user mapping needs (never email, never google_id). */
const PUBLIC_COLUMNS = {
  id: users.id,
  displayName: users.displayName,
  avatarUrl: users.avatarUrl,
  points: users.points,
  wins: users.wins,
  losses: users.losses,
  draws: users.draws,
  createdAt: users.createdAt,
};

/** Map a users row to the public shape. email/google_id never leave the server. */
export function publicUser(row: {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  createdAt: Date;
}): UserPublic {
  return {
    id: row.id,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    points: row.points,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Validate a display name for PATCH /me. Returns the trimmed name, or null
 * when it violates the 2–30 rule. Google's `name` is only clamped at signup;
 * an explicit edit must satisfy the rule exactly (F02 spec).
 */
export function validateDisplayName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim();
  if (name.length < DISPLAY_NAME_MIN || name.length > DISPLAY_NAME_MAX) return null;
  return name;
}

/** Update a user's display name. Returns the updated public user, or null. */
export async function updateDisplayName(
  db: Database,
  userId: string,
  displayName: string,
): Promise<UserPublic | null> {
  const updated = await db
    .update(users)
    .set({ displayName, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning(PUBLIC_COLUMNS);
  const row = updated[0];
  return row ? publicUser(row) : null;
}

/** Fetch one user's public profile by id. Null when unknown. */
export async function getPublicUserById(db: Database, userId: string): Promise<UserPublic | null> {
  const rows = await db.select(PUBLIC_COLUMNS).from(users).where(eq(users.id, userId)).limit(1);
  const row = rows[0];
  return row ? publicUser(row) : null;
}
