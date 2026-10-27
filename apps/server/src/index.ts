import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env.js';
import { createDb } from './db/index.js';
import { healthRoutes } from './routes/health.js';

async function main(): Promise<void> {
  const app = Fastify({
    logger: true, // structured logs (pino); match/user ids added per-service later
  });

  const { db, pool } = createDb(env.databaseUrl);

  await app.register(cors, {
    origin: env.corsOrigin,
  });

  await app.register(healthRoutes, { db });

  await app.ready();

  // Socket.IO shares Fastify's HTTP server; engine.io only handles its own
  // /socket.io paths (polling + websocket upgrades), other requests stay with Fastify.
  const io = new SocketIOServer(app.server, {
    cors: {
      origin: env.corsOrigin,
    },
  });
  io.on('connection', (socket) => {
    app.log.info({ socketId: socket.id }, 'socket connected');
    socket.on('disconnect', (reason) => {
      app.log.info({ socketId: socket.id, reason }, 'socket disconnected');
    });
  });

  await app.listen({ port: env.port, host: '0.0.0.0' });
  app.log.info({ port: env.port, corsOrigin: env.corsOrigin }, 'server started');

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
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
