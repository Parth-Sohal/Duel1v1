import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { SESSION_COOKIE, PASSWORD_MIN, PASSWORD_MAX } from '@coding-arena/shared';
import type { UserPublic } from '@coding-arena/shared';
import type { Database } from '../db/index.js';
import { users, credentials } from '../db/schema.js';
import { env } from '../config/env.js';
import { createSession, deleteSession, resolveSession } from '../services/sessions.js';
import { publicUser, validateDisplayName, normalizeEmail } from '../services/users.js';
import { hashPassword, verifyPassword } from '../services/passwords.js';
import { allowLoginAttempt, clearLoginFailures, recordFailedLogin, allowRegister } from '../services/rate-limit.js';
import { recordEvent } from '../services/events.js';

type AuthDeps = {
  db: Database;
};

const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true, // not readable by JS (docs/features/F01-google-login.md)
  sameSite: 'lax',
  secure: env.nodeEnv === 'production',
} as const;

/** Google's public signing keys; fetched and cached by `jose`. */
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

/** Claims we need from a verified Google ID token. */
type GoogleClaims = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
};

/** Verify a Google ID token with Google's keys. Returns its claims or null. */
async function verifyGoogleIdToken(credential: string): Promise<GoogleClaims | null> {
  try {
    const { payload } = await jwtVerify(credential, GOOGLE_JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: env.googleClientId, // must be issued for OUR client
    });
    if (typeof payload.sub !== 'string') return null;
    return {
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    };
  } catch {
    return null; // forged, expired, or wrong audience — same outcome: 401
  }
}

/** Google display names can be any length; ours must be 2–30 chars. */
function clampDisplayName(raw: string | undefined, email: string | undefined): string {
  let name = (raw ?? '').trim();
  if (name.length < 2 && email) name = email.split('@')[0]?.trim() ?? '';
  if (name.length < 2) name = 'Player';
  if (name.length > 30) name = name.slice(0, 30).trim();
  if (name.length < 2) name = 'Player';
  return name;
}

/** Set the session cookie on a reply. */
function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
  reply.setCookie(SESSION_COOKIE, token, {
    ...COOKIE_OPTIONS,
    expires: expiresAt,
  });
}

/**
 * Cookie-auth guard for protected routes. Resolves the session and, on
 * success, decorates the request with the public user. Shared by REST
 * routes now and the Socket.IO handshake later (F04).
 */
export function requireAuth(db: Database) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = request.cookies[SESSION_COOKIE];
    const session = token ? await resolveSession(db, token) : null;
    if (!session) {
      await reply.code(401).send({ error: 'not_signed_in' });
      return;
    }
    request.user = session.user;
  };
}

/**
 * Optional cookie-auth guard for public routes (F09 leaderboard): resolves the
 * session when present, never rejects. A missing or stale session simply
 * renders the signed-out view.
 */
export function optionalAuth(db: Database) {
  return async function (request: FastifyRequest): Promise<void> {
    const token = request.cookies[SESSION_COOKIE];
    if (!token) return;
    const session = await resolveSession(db, token);
    if (session) request.user = session.user;
  };
}

// Type augmentation so `request.user` is typed after the guard runs.
declare module 'fastify' {
  interface FastifyRequest {
    user?: UserPublic;
  }
}

export async function authRoutes(app: FastifyInstance, opts: AuthDeps): Promise<void> {
  const { db } = opts;

  /**
   * POST /auth/google — sign in / sign up.
   * Body: { credential: <Google ID token from GIS> }. The browser's profile
   * fields are never trusted; identity comes only from the verified token.
   */
  app.post('/auth/google', async (request, reply) => {
    const body = (request.body ?? {}) as { credential?: unknown };
    if (typeof body.credential !== 'string' || body.credential.length === 0) {
      return reply.code(400).send({ error: 'missing_credential' });
    }

    const claims = await verifyGoogleIdToken(body.credential);
    if (!claims) {
      app.log.warn({ reqId: request.id }, 'google id token verification failed');
      return reply.code(401).send({ error: 'invalid_google_token' });
    }

    // Find-or-create the user keyed on google_id.
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.googleId, claims.sub))
      .limit(1);

    let user = existing[0];
    if (!user) {
      const inserted = await db
        .insert(users)
        .values({
          googleId: claims.sub,
          email: claims.email ?? null,
          displayName: clampDisplayName(claims.name, claims.email),
          avatarUrl: claims.picture ?? null,
        })
        .returning();
      user = inserted[0];
      app.log.info({ userId: user.id }, 'user created (first google login)');
      await recordEvent(db, { type: 'signup', userId: user.id, meta: { method: 'google' } });
    } else if (claims.picture && claims.picture !== user.avatarUrl) {
      // v1 avatars come only from Google (F02 spec): if the player adds or
      // changes their Google photo, pick it up at the next sign-in — but only
      // when there is no local upload (F02b: an upload always wins). The
      // display name is NOT refreshed — the player owns it now.
      const localUpload = user.avatarUrl?.startsWith('/') ?? false;
      if (!localUpload) {
        const updated = await db
          .update(users)
          .set({ avatarUrl: claims.picture, updatedAt: new Date() })
          .where(eq(users.id, user.id))
          .returning();
        user = updated[0];
        app.log.info({ userId: user.id }, 'avatar refreshed from google');
      }
    }

    const { token, expiresAt } = await createSession(db, user.id);
    setSessionCookie(reply, token, expiresAt);
    return { user: publicUser(user) };
  });

  /** GET /auth/me — who is signed in? 401 when nobody. */
  app.get('/auth/me', { preHandler: requireAuth(db) }, async (request) => {
    return { user: request.user };
  });

  /** POST /auth/logout — delete the session row, clear the cookie. */
  app.post('/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) {
      await deleteSession(db, token);
    }
    reply.clearCookie(SESSION_COOKIE, { ...COOKIE_OPTIONS, expires: new Date(0) });
    return reply.code(204).send();
  });

  /**
   * POST /auth/register — manual account (F03). Creates the user (google_id
   * null) plus the password credential in one transaction, then signs the
   * player in. Validation is server-side; the form is a convenience.
   */
  app.post('/auth/register', async (request, reply) => {
    const ip = request.ip;
    const body = (request.body ?? {}) as {
      email?: unknown;
      password?: unknown;
      displayName?: unknown;
    };

    const email = normalizeEmail(body.email);
    if (!email) return reply.code(400).send({ error: 'invalid_email', message: 'Enter a valid email address.' });

    // F10: signup spam throttled per IP (the login limiter above stays for
    // sign-in attempts; this one guards account creation itself).
    if (!allowRegister(`ip:${ip}`)) {
      return reply.code(429).send({ error: 'rate_limited', message: 'Too many signups from this network — try again later.' });
    }

    if (!allowLoginAttempt(`ip:${ip}`)) {
      return reply.code(429).send({ error: 'rate_limited', message: 'Too many attempts — try again in a few minutes.' });
    }

    const password = typeof body.password === 'string' ? body.password : '';
    if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
      return reply.code(400).send({
        error: 'invalid_password',
        message: `Password must be ${PASSWORD_MIN}–${PASSWORD_MAX} characters.`,
      });
    }

    const displayName = validateDisplayName(body.displayName);
    if (!displayName) {
      return reply.code(400).send({
        error: 'invalid_display_name',
        message: 'Display name must be 2–30 characters (spaces around it are trimmed).',
      });
    }

    const taken = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (taken.length > 0) {
      return reply.code(409).send({ error: 'email_taken', message: 'That email already has an account.' });
    }

    const passwordHash = await hashPassword(password);
    try {
      const created = await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(users)
          .values({ email, displayName, avatarUrl: null })
          .returning();
        const user = inserted[0];
        await tx.insert(credentials).values({ userId: user.id, passwordHash });
        return user;
      });
      app.log.info({ userId: created.id }, 'manual account created');
      await recordEvent(db, { type: 'signup', userId: created.id, meta: { method: 'email' } });
      const { token, expiresAt } = await createSession(db, created.id);
      setSessionCookie(reply, token, expiresAt);
      return { user: publicUser(created) };
    } catch (err) {
      // The unique indexes are the real guard against a signup race.
      app.log.warn({ reqId: request.id }, 'register failed (email likely taken in a race)');
      void err;
      return reply.code(409).send({ error: 'email_taken', message: 'That email already has an account.' });
    }
  });

  /**
   * POST /auth/login — manual sign-in (F03). Generic error for unknown email
   * and wrong password alike (no account enumeration). Rate limited.
   */
  app.post('/auth/login', async (request, reply) => {
    const ip = request.ip;
    const body = (request.body ?? {}) as { email?: unknown; password?: unknown };

    const email = normalizeEmail(body.email);
    if (!email) return reply.code(400).send({ error: 'invalid_email', message: 'Enter a valid email address.' });

    if (!allowLoginAttempt(`email:${email}`, `ip:${ip}`)) {
      return reply.code(429).send({ error: 'rate_limited', message: 'Too many attempts — try again in a few minutes.' });
    }

    const rows = await db
      .select({ user: users, passwordHash: credentials.passwordHash })
      .from(users)
      .innerJoin(credentials, eq(credentials.userId, users.id))
      .where(eq(users.email, email))
      .limit(1);
    const row = rows[0];

    const password = typeof body.password === 'string' ? body.password : '';
    const ok = row ? await verifyPassword(password, row.passwordHash) : false;
    if (!row || !ok) {
      recordFailedLogin(`email:${email}`, `ip:${ip}`);
      app.log.warn({ reqId: request.id }, 'manual login failed');
      return reply.code(401).send({ error: 'invalid_credentials', message: 'Email or password is incorrect.' });
    }

    clearLoginFailures(`email:${email}`);
    const { token, expiresAt } = await createSession(db, row.user.id);
    setSessionCookie(reply, token, expiresAt);
    return { user: publicUser(row.user) };
  });
}
