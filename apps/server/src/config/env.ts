import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function number(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive number, got: ${raw}`);
  }
  return parsed;
}

/**
 * Server configuration. Fails fast on missing required variables so the
 * server never starts in an unsafe or half-configured state.
 */
export const env = {
  port: number('PORT', 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  databaseUrl: required('DATABASE_URL'),
  googleClientId: required('GOOGLE_CLIENT_ID'),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  /**
   * Judge0 (F04 practice mode). The public CE endpoint needs no key;
   * a keyed endpoint (RapidAPI Basic $0 / self-hosted) is an env-only swap.
   */
  judge0Url: process.env.JUDGE0_API_URL ?? 'https://ce.judge0.com',
  judge0ApiKey: process.env.JUDGE0_API_KEY ?? '',
} as const;
