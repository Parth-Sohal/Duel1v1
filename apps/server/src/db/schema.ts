import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
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
