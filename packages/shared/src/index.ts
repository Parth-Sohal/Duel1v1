// Constants and shared types used by apps/web and apps/server.
// Nothing here may import from either app.

export const APP_NAME = 'Coding Arena';

export const MATCH_DURATION_MS = 10 * 60 * 1000; // 10 minutes, server-owned
export const FORFEIT_GRACE_MS = 30 * 1000; // disconnect grace period
export const MAX_CODE_LENGTH = 50_000; // characters per submission

/**
 * Duel point rules (decision D5, owner-confirmed 2026-10-29; floor revised by
 * the owner 2026-10-30): win swing randomized +29..+31 (loser pays the same,
 * floored at 0 — nobody goes negative), draw both -10, forfeit stayer +10 /
 * leaver -10; a "no title yet" display just shows the number.
 */
export const WIN_SWING_MIN = 29; // each match's swing is randomized in [MIN, MAX]
export const WIN_SWING_MAX = 31; // winner gains it, loser loses the same amount
export const DRAW_PENALTY = 10; // both players lose this on a draw
export const FORFEIT_REWARD = 10; // the player who stays gains this
export const FORFEIT_PENALTY = 10; // the player who left/forfeited loses this (less than a loss)
/** Room invites expire after this long without a match starting. */
export const ROOM_TTL_MS = 60 * 60 * 1000;
/** Live match socket auth tokens: one-time, short-lived (works cross-origin in production). */
export const SOCKET_TOKEN_TTL_MS = 60 * 1000;
/** F6 repeat rule: avoid challenges either player solved in their last N matches. */
export const REPEAT_AVOID_LAST_N = 3;

/** F08 KERN BOT: probability the bot solves before the clock, by difficulty. */
export const BOT_NAME = 'KERN';
export const BOT_SOLVE_PROBABILITY = { easy: 0.35, medium: 0.5, hard: 0.65 } as const;
/** Human-like pace: the bot acts somewhere in this window after the match starts. */
export const BOT_SOLVE_MIN_MS = 90_000; // earliest KERN ever passes
export const BOT_SOLVE_MAX_MS = 7 * 60_000; // never inside the last 3 minutes
/** When the bot's roll says "fail", it still submits one wrong answer here. */
export const BOT_FAIL_MIN_MS = 2 * 60_000;
export const BOT_FAIL_MAX_MS = 4 * 60_000;

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
