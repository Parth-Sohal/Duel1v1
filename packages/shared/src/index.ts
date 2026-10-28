// Constants and shared types used by apps/web and apps/server.
// Nothing here may import from either app.

export const APP_NAME = 'Coding Arena';

export const MATCH_DURATION_MS = 10 * 60 * 1000; // 10 minutes, server-owned
export const FORFEIT_GRACE_MS = 30 * 1000; // disconnect grace period
export const MAX_CODE_LENGTH = 50_000; // characters per submission

/** Base paths of the two apps, resolved through their env/config. */
export const DEFAULT_WEB_PORT = 3000;
export const DEFAULT_SERVER_PORT = 4000;

/** Session cookie name; also used by the Socket.IO handshake (F04). */
export const SESSION_COOKIE = 'arena_session';

/** Session lifetime: 30 days, server-owned. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Display-name limits (docs/features/F02-profile.md): validated server-side. */
export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 30;

/**
 * Public user shape. Everything the browser is ever told about a user.
 * No email, no google_id — those never leave the server.
 */
export type UserPublic = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  /** ISO timestamp of account creation (public — shown as "joined"). */
  createdAt: string;
};
