import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env.js';
import { createDb } from './db/index.js';
import { FORFEIT_PENALTY, FORFEIT_REWARD, MATCHMAKING_TICK_MS, WIN_SWING_MIN } from '@coding-arena/shared';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { meRoutes } from './routes/me.js';
import { challengeRoutes } from './routes/challenges.js';
import { duelRoutes } from './routes/duels.js';
import { matchRoutes } from './routes/matches.js';
import { feedbackRoutes } from './routes/feedback.js';
import { eventRoutes } from './routes/events.js';
import { aiRoutes } from './routes/ai.js';
import { leaderboardRoutes } from './routes/leaderboard.js';
import { setupGateway } from './services/gateway.js';
import { sweepMatches } from './services/matches.js';
import { closeExpiredRooms } from './services/rooms.js';
import { ensureBotUser, runBotTick } from './services/bots.js';
import { runMatchmakingTick } from './services/matchmaking.js';
import { captureError, initObservability } from './services/observability.js';
import { eq, sql } from 'drizzle-orm';
import { challengeVersions, matches } from './db/schema.js';

/** Sweeper cadence: forfeit grace + draw deadlines checked this often. */
const SWEEP_INTERVAL_MS = 5000;

async function main(): Promise<void> {
  const app = Fastify({
    logger: true, // structured pino logs; ids added at every match/user/submission touchpoint (F10)
  });

  // F10: Sentry is a no-op without SENTRY_DSN (the SDK is not even loaded).
  await initObservability();
  // Route errors ship to Sentry (when enabled) with the request id — the
  // default Fastify error handler still produces the responses.
  app.addHook('onError', async (request, _reply, error) => {
    captureError(error, { reqId: request.id, method: request.method, url: request.url, userId: request.user?.id ?? null });
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
  // F10 feedback + analytics.
  await app.register(feedbackRoutes, { db, prefix: '/api' });
  await app.register(eventRoutes, { db, prefix: '/api' });
  // F11 AI code analysis: /api/ai/usage + /api/ai/review (+ dev prompt preview).
  await app.register(aiRoutes, { db, prefix: '/api' });
  // F09 public Rankings feed: /api/leaderboard.
  await app.register(leaderboardRoutes, { db, prefix: '/api' });

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
  // past the deadline, expired rooms. F08: executes the KERN BOT's plan.
  // Runs on boot + every few seconds.
  const sweep = async () => {
    try {
      await closeExpiredRooms(db);
      const botId = await ensureBotUser(db); // cached after first success
      const bot = await runBotTick(db, botId);
      for (const applied of bot.applied) {
        // Deltas exactly as applied by finishMatch (all zero per D6).
        await app.gateway.broadcastMatchEnded(applied.match.id, {
          resultType: applied.outcome.kind,
          winnerId: applied.outcome.kind === 'draw' ? null : applied.outcome.winnerId,
          deltas: applied.deltas,
        });
      }
      // KERN's visible "wrong attempt" before each failing plan clears.
      for (const matchId of bot.failing) {
        const [total] = await db
          .select({ total: sql<number>`jsonb_array_length(${challengeVersions.tests})` })
          .from(challengeVersions)
          .innerJoin(matches, eq(matches.challengeVersionId, challengeVersions.id))
          .where(eq(matches.id, matchId));
        app.gateway.broadcastProgress(matchId, { userId: await ensureBotUser(db), testsPassed: 0, attempts: 1 });
        app.log.info({ matchId, tests: total?.total ?? 0 }, 'bot fail-plan attempt broadcast');
      }
      const finished = await sweepMatches(db);
      for (const applied of finished) {
        // Deltas exactly as applied by finishMatch (floor rule included).
        await app.gateway.broadcastMatchEnded(applied.match.id, {
          resultType: applied.outcome.kind,
          winnerId: applied.outcome.kind === 'draw' ? null : applied.outcome.winnerId,
          deltas: applied.deltas,
        });
      }
    } catch (err) {
      app.log.error({ err }, 'sweeper pass failed');
      captureError(err, { scope: 'sweeper' });
    }
  };
  await sweep();
  const sweepTimer = setInterval(() => void sweep(), SWEEP_INTERVAL_MS);
  sweepTimer.unref();

  // F09 matchmaking: pair queued humans every couple of seconds. The queue is
  // process memory; matches themselves are durable in Postgres.
  const matchmakingPass = async () => {
    try {
      const created = await runMatchmakingTick(db);
      if (created.length > 0) {
        app.log.info(
          { matches: created.map((c) => c.matchId), players: created.map((c) => c.players) },
          'quick matches created',
        );
      }
    } catch (err) {
      app.log.error({ err }, 'matchmaking pass failed');
      captureError(err, { scope: 'matchmaking' });
    }
  };
  await matchmakingPass();
  const matchmakingTimer = setInterval(() => void matchmakingPass(), MATCHMAKING_TICK_MS);
  matchmakingTimer.unref();

  await app.listen({ port: env.port, host: '0.0.0.0' });
  app.log.info({ port: env.port, corsOrigin: env.corsOrigin }, 'server started');

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    clearInterval(sweepTimer);
    clearInterval(matchmakingTimer);
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
