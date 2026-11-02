/**
 * F10 error tracking (docs/features/F10-hardening.md). Next.js instrumentation
 * hooks, env-gated: with no DSN nothing is initialised and the app runs
 * exactly as before (the SDK is never imported). Server errors use
 * SENTRY_DSN; browser errors use NEXT_PUBLIC_SENTRY_DSN. Nothing PII is
 * attached — sendDefaultPii is off by default and we add nothing extra.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.SENTRY_DSN) {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0,
    });
  }
  if (process.env.NEXT_RUNTIME === 'browser' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0,
    });
  }
}

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string | undefined> },
  context: { routerType?: string; routePath?: string },
): Promise<void> {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(err, request as Parameters<typeof Sentry.captureRequestError>[1], context as Parameters<typeof Sentry.captureRequestError>[2]);
}
