import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Iteration 0 schema: enums only (see docs/data-model.md §7).
 * Tables arrive in the migrations of the iterations that need them.
 * Never edit an applied migration; add a new one.
 */

export const difficultyEnum = pgEnum('difficulty', ['easy', 'medium', 'hard']);

export const roomStatusEnum = pgEnum('room_status', ['open', 'full', 'in_match', 'closed']);

export const matchStatusEnum = pgEnum('match_status', ['waiting', 'active', 'finished']);

export const matchResultEnum = pgEnum('match_result', ['win', 'draw', 'forfeit']);

export const submissionKindEnum = pgEnum('submission_kind', ['run', 'submit']);

export const submissionStatusEnum = pgEnum('submission_status', [
  'queued',
  'running',
  'accepted',
  'wrong_answer',
  'time_limit',
  'memory_limit',
  'runtime_error',
  'compile_error',
  'internal_error',
]);

/** Practice-mode languages (decision D3). */
export const languageEnum = pgEnum('language', ['javascript', 'python']);

/** Players (docs/data-model.md §4). email/google_id stay on the server; never public. */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  googleId: text('google_id').unique(), // null for bot users
  email: text('email').unique(),
  displayName: text('display_name').notNull(), // 2..30 chars, enforced by the service layer + CHECK
  avatarUrl: text('avatar_url'),
  points: integer('points').notNull().default(0),
  wins: integer('wins').notNull().default(0),
  losses: integer('losses').notNull().default(0),
  draws: integer('draws').notNull().default(0),
  isBot: boolean('is_bot').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('users_display_name_length', sql`char_length(${t.displayName}) BETWEEN 2 AND 30`),
  check('users_points_non_negative', sql`${t.points} >= 0`),
]);

/** Server-side sessions. Only the SHA-256 hash of the token is stored, never the raw token. */
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('sessions_user_idx').on(t.userId)]);

/**
 * Manual-account passwords (docs/features/F03-email-login.md). One password
 * per account; the email itself lives on `users` (unique). Only the salted
 * scrypt hash is stored, never the password.
 */
export const credentials = pgTable('credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Uploaded avatars (docs/features/F02b-avatar-upload.md). Bytes are base64
 * text (≤256×256, size-capped), stored in our own DB; `users.avatar_url`
 * points at the versioned public URL that serves them.
 */
export const avatars = pgTable('avatars', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  mime: text('mime').notNull(),
  data: text('data').notNull(), // base64
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Practice mode (docs/features/F04-practice-mode.md). A challenge is the
 * stable identity (slug); `current_version` names the active version row.
 * Fixing a problem creates version n+1 — a running version never mutates.
 */
export const challenges = pgTable('challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  difficulty: difficultyEnum('difficulty').notNull(),
  tags: text('tags').array().notNull(),
  currentVersion: integer('current_version').notNull().default(1),
  isPublished: boolean('is_published').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One immutable version of a challenge. Tests are jsonb entries
 * { args, expected, hidden } — the judge calls the player's function with
 * `args` and compares the returned value. Hidden tests never leave the server
 * (docs/features/F04-practice-mode.md, risk-register rule).
 */
export const challengeVersions = pgTable('challenge_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  challengeId: uuid('challenge_id').notNull().references(() => challenges.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  statement: text('statement').notNull(),
  entryFunctions: jsonb('entry_functions').notNull(), // { javascript, python } — function the player must write
  starterCode: jsonb('starter_code').notNull(), // { javascript, python }
  timeLimitMs: integer('time_limit_ms').notNull(),
  memoryLimitMb: integer('memory_limit_mb').notNull(),
  tests: jsonb('tests').notNull(), // { args, expected, hidden }[] — args are the function's call arguments
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique('challenge_versions_challenge_version_unique').on(t.challengeId, t.version)]);

/**
 * Practice submissions. Only SUBMIT is saved (RUN is ephemeral). Results
 * jsonb is redacted server-side: hidden tests show only hidden=true with
 * pass/fail — never their input or expected output.
 */
export const submissions = pgTable('submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  challengeId: uuid('challenge_id').notNull().references(() => challenges.id, { onDelete: 'cascade' }),
  challengeVersionId: uuid('challenge_version_id').notNull().references(() => challengeVersions.id, { onDelete: 'cascade' }),
  kind: submissionKindEnum('kind').notNull(),
  language: languageEnum('language').notNull(),
  status: submissionStatusEnum('status').notNull(),
  passed: integer('passed').notNull(),
  total: integer('total').notNull(),
  results: jsonb('results').notNull(), // redacted per-test results
  sourceCode: text('source_code').notNull(),
  judgeLatencyMs: integer('judge_latency_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('submissions_user_created_idx').on(t.userId, t.createdAt)]);
