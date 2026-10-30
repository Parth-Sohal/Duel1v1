import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env.js';
import { createDb } from './db/index.js';
import { FORFEIT_PENALTY, FORFEIT_REWARD, WIN_SWING_MIN } from '@coding-arena/shared';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { meRoutes } from './routes/me.js';
import { challengeRoutes } from './routes/challenges.js';
import { duelRoutes } from './routes/duels.js';
import { matchRoutes } from './routes/matches.js';
import { setupGateway } from './services/gateway.js';
import { sweepMatches } from './services/matches.js';
import { closeExpiredRooms } from './services/rooms.js';

/** Sweeper cadence: forfeit grace + draw deadlines checked this often. */
const SWEEP_INTERVAL_MS = 5000;

async function main(): Promise<void> {
  const app = Fastify({
    logger: true, // structured logs (pino); match/user ids added per-service later
  });

  const { db, pool } = createDb(env.databaseUrl);

  await app.register(cors, {
    origin: env.corsOrigin,
  });

  // Parses the session cookie on every request (routes decide what to do with it).
  await app.register(cookie);

  // Body parser: JSON when present, {} when the body is empty or the POST
  // carries no content-type at all (join/leave/start/ready are bodyless POSTs).
  // Registered for both the exact JSON type (replaces Fastify's default, whose
  // empty-body check would 400 our bodyless POSTs) and the catch-all.
  const parseBody = (_req: unknown, body: unknown, done: (err: Error | null, parsed?: unknown) => void): void => {
    if (typeof body !== 'string' || body.trim().length === 0) return done(null, {});
    try {
      done(null, JSON.parse(body));
    } catch (err) {
      done(err as Error, undefined);
    }
  };
  app.addContentTypeParser('application/json', { parseAs: 'string' }, parseBody);
  app.addContentTypeParser('*', { parseAs: 'string' }, parseBody);

  await app.register(healthRoutes, { db });
  // Spec paths are /api/auth/*; the web app proxies /api/* here (same-origin
  // in the browser so the session cookie stays first-party).
  await app.register(authRoutes, { db, prefix: '/api' });
  // F02 profile routes: /api/me (GET/PATCH) and /api/users/:id (GET).
  await app.register(meRoutes, { db, prefix: '/api' });
  // F04 practice routes: /api/challenges (+ /:slug/run|submit|submissions).
  await app.register(challengeRoutes, { db, prefix: '/api' });

  // F05 friend rooms: /api/duels/*.
  await app.register(duelRoutes, { db, prefix: '/api' });
  // F06/F07 matches: /api/matches*.
  await app.register(matchRoutes, { db, prefix: '/api' });

  // Socket.IO shares Fastify's HTTP server; engine.io only handles its own
  // /socket.io paths (polling + websocket upgrades), other requests stay with Fastify.
  // F05: one-time token auth, room presence, live room/match events.
  // Attached + decorated BEFORE app.ready() (decorators cannot be added after start).
  const io = new SocketIOServer(app.server, {
    cors: {
      origin: env.corsOrigin,
    },
  });
  setupGateway(io, db, app);

  await app.ready();

  // Sweeper (F06 restart safety): forfeits past the disconnect grace, draws
  // past the deadline, expired rooms. Runs on boot + every few seconds.
  const sweep = async () => {
    try {
      await closeExpiredRooms(db);
      const finished = await sweepMatches(db);
      for (const applied of finished) {
        // D5 deltas recomputed for the broadcast payload (same math as finishMatch).
        const deltas =
          applied.outcome.kind === 'draw'
            ? {}
            : {
                [applied.outcome.winnerId]:
                  applied.outcome.kind === 'forfeit' ? FORFEIT_REWARD : (applied.match.swingPoints ?? WIN_SWING_MIN),
                [applied.outcome.loserId]:
                  applied.outcome.kind === 'forfeit' ? -FORFEIT_PENALTY : -(applied.match.swingPoints ?? WIN_SWING_MIN),
              };
        await app.gateway.broadcastMatchEnded(applied.match.id, {
          resultType: applied.outcome.kind,
          winnerId: applied.outcome.kind === 'draw' ? null : applied.outcome.winnerId,
          deltas,
        });
      }
    } catch (err) {
      app.log.error({ err }, 'sweeper pass failed');
    }
  };
  await sweep();
  const sweepTimer = setInterval(() => void sweep(), SWEEP_INTERVAL_MS);
  sweepTimer.unref();

  await app.listen({ port: env.port, host: '0.0.0.0' });
  app.log.info({ port: env.port, corsOrigin: env.corsOrigin }, 'server started');

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    clearInterval(sweepTimer);
    io.close();
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('fatal: server failed to start', err);
  process.exit(1);
});
