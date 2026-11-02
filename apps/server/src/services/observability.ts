import { env } from '../config/env.js';

/**
 * F10 error tracking (docs/features/F10-hardening.md). Sentry, env-gated:
 * with no SENTRY_DSN nothing is initialised and the app runs exactly as
 * before (the SDK is not even loaded). With a DSN, unhandled route errors
 * ship with the request id — never player code, emails, or request bodies
 * (sendDefaultPii is off by default in the Node SDK; nothing PII is added).
 */
type SentryNode = typeof import('@sentry/node');

let sentry: SentryNode | null = null;

export async function initObservability(): Promise<void> {
  if (!env.sentryDsn || sentry) return;
  sentry = await import('@sentry/node');
  sentry.init({
    dsn: env.sentryDsn,
    environment: env.nodeEnv,
  });
}

/** Fire-and-forget capture for the onError hook / sweeper catch-alls. */
export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!sentry) return;
  try {
    sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    // observability must never break the request path
  }
}
