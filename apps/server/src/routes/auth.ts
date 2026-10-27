import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { SESSION_COOKIE } from '@coding-arena/shared';
import type { UserPublic } from '@coding-arena/shared';
import type { Database } from '../db/index.js';
import { users } from '../db/schema.js';
import { env } from '../config/env.js';
import { createSession, deleteSession, resolveSession } from '../services/sessions.js';

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

function publicUser(row: {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  points: number;
  wins: number;
  losses: number;
  draws: number;
}): UserPublic {
  return {
    id: row.id,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    points: row.points,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
  };
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
}
