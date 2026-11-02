import {
  BOT_MAX_PER_WINDOW,
  BOT_WINDOW_MS,
  FEEDBACK_MAX_PER_WINDOW,
  FEEDBACK_WINDOW_MS,
  JUDGE_MAX_PER_WINDOW,
  JUDGE_WINDOW_MS,
  LOGIN_MAX_ATTEMPTS,
  LOGIN_WINDOW_MS,
  REGISTER_MAX_PER_WINDOW,
  REGISTER_WINDOW_MS,
  ROOM_OPS_MAX_PER_WINDOW,
  ROOM_OPS_WINDOW_MS,
  SOCKET_TOKEN_MAX_PER_WINDOW,
  SOCKET_TOKEN_WINDOW_MS,
} from '@coding-arena/shared';

/**
 * In-memory login rate limiter (docs/features/F03-email-login.md): 8 failed
 * attempts per 15 minutes, tracked per email AND per IP; a successful login
 * clears the email's count. Good enough for the single-instance free tiers;
 * Redis-backed limiting is already in the scaling backlog for multi-instance.
 */
const attempts = new Map<string, number[]>();

function prune(key: string, now: number): number[] {
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < LOGIN_WINDOW_MS);
  if (recent.length === 0) attempts.delete(key);
  else attempts.set(key, recent);
  return recent;
}

/** True when the attempt is allowed (records it). */
export function allowLoginAttempt(...keys: string[]): boolean {
  const now = Date.now();
  return keys.every((key) => prune(key, now).length < LOGIN_MAX_ATTEMPTS);
}

/** Record a failed attempt. */
export function recordFailedLogin(...keys: string[]): void {
  const now = Date.now();
  for (const key of keys) {
    const recent = prune(key, now);
    recent.push(now);
    attempts.set(key, recent);
  }
}

/** Clear the email's failures after a success (IP history stays). */
export function clearLoginFailures(emailKey: string): void {
  attempts.delete(emailKey);
}

/**
 * Practice-mode submission limiter (docs/features/F04-practice-mode.md):
 * JUDGE_MAX_PER_WINDOW Run+Submit calls per user per JUDGE_WINDOW_MS. In-memory
 * single-instance, same tradeoff as the login limiter above.
 */
const judgeHits = new Map<string, number[]>();

export function allowJudgeSubmission(userId: string): boolean {
  const now = Date.now();
  const recent = (judgeHits.get(userId) ?? []).filter((t) => now - t < JUDGE_WINDOW_MS);
  judgeHits.set(userId, recent);
  return recent.length < JUDGE_MAX_PER_WINDOW;
}

export function recordJudgeSubmission(userId: string): void {
  const now = Date.now();
  const recent = (judgeHits.get(userId) ?? []).filter((t) => now - t < JUDGE_WINDOW_MS);
  recent.push(now);
  judgeHits.set(userId, recent);
}

/**
 * F10 launch hardening (docs/features/F10-hardening.md): one generic
 * sliding-window limiter for every remaining throttle (signups per IP, room
 * writes / bot duels / socket tokens / feedback per user). In-memory,
 * single-instance — same tradeoff as the limiters above; Redis is backlog.
 */
function windowLimiter(max: number, windowMs: number): (key: string) => boolean {
  const hits = new Map<string, number[]>();
  return (key: string): boolean => {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    hits.set(key, recent);
    if (recent.length >= max) return false;
    recent.push(now);
    return true;
  };
}

export const allowRegister = windowLimiter(REGISTER_MAX_PER_WINDOW, REGISTER_WINDOW_MS);
export const allowRoomOp = windowLimiter(ROOM_OPS_MAX_PER_WINDOW, ROOM_OPS_WINDOW_MS);
export const allowBotDuel = windowLimiter(BOT_MAX_PER_WINDOW, BOT_WINDOW_MS);
export const allowSocketToken = windowLimiter(SOCKET_TOKEN_MAX_PER_WINDOW, SOCKET_TOKEN_WINDOW_MS);
export const allowFeedback = windowLimiter(FEEDBACK_MAX_PER_WINDOW, FEEDBACK_WINDOW_MS);
