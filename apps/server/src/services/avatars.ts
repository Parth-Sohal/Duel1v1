import { eq } from 'drizzle-orm';
import { AVATAR_MAX_BYTES } from '@coding-arena/shared';
import type { Database } from '../db/index.js';
import { avatars, users } from '../db/schema.js';
import type { UserPublic } from '@coding-arena/shared';
import { publicUser } from './users.js';

/**
 * Avatar upload + serving (docs/features/F02b-avatar-upload.md). The client
 * resizes to a 256×256 square; the server still re-validates the data URL,
 * the MIME, the magic bytes, and the size — the browser is never trusted.
 */

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Magic-byte signatures so a renamed text file can't pose as an image. */
function hasMagicBytes(mime: string, bytes: Buffer): boolean {
  if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/png') {
    return (
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    );
  }
  if (mime === 'image/webp') {
    return (
      bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
      bytes.subarray(8, 12).toString('latin1') === 'WEBP'
    );
  }
  return false;
}

/** Parse and validate a `data:image/…;base64,…` upload. */
export function parseAvatarDataUrl(
  raw: unknown,
): { ok: true; mime: string; bytes: Buffer } | { ok: false; reason: 'invalid' | 'too_large' } {
  if (typeof raw !== 'string') return { ok: false, reason: 'invalid' };
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(raw);
  if (!match) return { ok: false, reason: 'invalid' };
  const mime = match[1];
  if (!ALLOWED_MIME.has(mime)) return { ok: false, reason: 'invalid' };
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length === 0) return { ok: false, reason: 'invalid' };
  if (bytes.length > AVATAR_MAX_BYTES) return { ok: false, reason: 'too_large' };
  if (!hasMagicBytes(mime, bytes)) return { ok: false, reason: 'invalid' };
  return { ok: true, mime, bytes };
}

/** Upsert the avatar row and point the user's avatar_url at the public URL. */
export async function saveAvatar(
  db: Database,
  userId: string,
  mime: string,
  bytes: Buffer,
): Promise<UserPublic | null> {
  const base64 = bytes.toString('base64');
  const version = Math.floor(Date.now() / 1000);
  const url = `/api/users/${userId}/avatar?v=${version}`;

  const updated = await db.transaction(async (tx) => {
    await tx
      .insert(avatars)
      .values({ userId, mime, data: base64, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: avatars.userId,
        set: { mime, data: base64, updatedAt: new Date() },
      });
    const rows = await tx
      .update(users)
      .set({ avatarUrl: url, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        points: users.points,
        wins: users.wins,
        losses: users.losses,
        draws: users.draws,
        createdAt: users.createdAt,
      });
    return rows[0];
  });
  return updated ? publicUser(updated) : null;
}

/** Remove the avatar row and fall back to the letter block. */
export async function removeAvatar(db: Database, userId: string): Promise<UserPublic | null> {
  const updated = await db.transaction(async (tx) => {
    await tx.delete(avatars).where(eq(avatars.userId, userId));
    const rows = await tx
      .update(users)
      .set({ avatarUrl: null, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        points: users.points,
        wins: users.wins,
        losses: users.losses,
        draws: users.draws,
        createdAt: users.createdAt,
      });
    return rows[0];
  });
  return updated ? publicUser(updated) : null;
}

/** Fetch the stored avatar bytes for serving. Null when none. */
export async function getAvatarBytes(
  db: Database,
  userId: string,
): Promise<{ mime: string; bytes: Buffer } | null> {
  const rows = await db
    .select({ mime: avatars.mime, data: avatars.data })
    .from(avatars)
    .where(eq(avatars.userId, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { mime: row.mime, bytes: Buffer.from(row.data, 'base64') };
}
