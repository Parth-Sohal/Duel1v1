import { LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS } from '@coding-arena/shared';

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
