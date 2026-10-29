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

/** Password policy (docs/features/F03-email-login.md): length over composition rules. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;

/** Rate limit: 8 failed logins per 15 minutes, per email and per IP. */
export const LOGIN_MAX_ATTEMPTS = 8;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** Avatars (docs/features/F02b-avatar-upload.md): client resizes to a 256px square. */
export const AVATAR_SIZE_PX = 256;
/** Hard cap on decoded bytes the server accepts (~150 KB). */
export const AVATAR_MAX_BYTES = 150_000;
/** Cache-busting param key appended to the served avatar URL. */
export const AVATAR_URL_PATH = '/avatar';

/** Code-execution languages at launch (decision D3). Judge0 language ids: 93 = Node.js 18.15.0, 100 = Python 3.12.5. */
export const LANGUAGES = ['javascript', 'python'] as const;
export type Language = (typeof LANGUAGES)[number];
export const JUDGE0_LANGUAGE_IDS: Record<Language, number> = { javascript: 93, python: 100 };

/** Practice mode (docs/features/F04-practice-mode.md). */
/** Base CPU limit per language run; Python gets the multiplier below.
 * 5 s (not the contest-standard 2 s): the free shared judge box can inflate
 * measured CPU time under load, and a false "time limit" is worse than a slow
 * honest verdict. Real solutions run in well under 1 s. */
export const RUN_TIME_LIMIT_MS = 5000;
export const RUN_TIME_MULTIPLIER_PY = 1.5;
/** Uniform memory cap the server passes to the judge. */
export const RUN_MEMORY_LIMIT_MB = 256;
/** Per-user submission rate limit (Run + Submit combined). */
export const JUDGE_MAX_PER_WINDOW = 20;
export const JUDGE_WINDOW_MS = 5 * 60 * 1000;
/** Visible sample tests shown in the editor pane. */
export const MAX_VISIBLE_TESTS = 3;
/** Suffixes for the shared test-case jsonb shape: { input, expected, hidden }. */
export const TEST_JSONB_MAX = 20;

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
