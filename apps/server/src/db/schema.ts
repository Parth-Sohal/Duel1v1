import { pgEnum } from 'drizzle-orm/pg-core';

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
