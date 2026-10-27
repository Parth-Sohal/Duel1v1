import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import type { Database } from '../db/index.js';

type HealthDeps = {
  db: Database;
};

/** GET /health — liveness probe; reports service and database status. */
export async function healthRoutes(app: FastifyInstance, opts: HealthDeps): Promise<void> {
  app.get('/health', async () => {
    let database = 'down';
    try {
      await opts.db.execute(sql`select 1`);
      database = 'up';
    } catch {
      database = 'down';
    }

    const ok = database === 'up';
    if (!ok) {
      app.log.warn({ database }, 'health check: database down');
    }

    return {
      status: ok ? 'ok' : 'degraded',
      database,
      uptime_s: Math.round(process.uptime()),
    };
  });
}
