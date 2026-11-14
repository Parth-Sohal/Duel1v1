import type { FastifyInstance } from 'fastify';
import type { Database } from '../db/index.js';
import { optionalAuth } from './auth.js';
import { getLeaderboard } from '../services/leaderboard.js';

/**
 * F09 public Rankings feed (docs/features/F09-matchmaking-leaderboard.md).
 * Optional auth: signed-out visitors see the same top-30 ladder; signed-in
 * players also get their own real rank for the dark panel.
 */

type LeaderboardDeps = {
  db: Database;
};

export async function leaderboardRoutes(app: FastifyInstance, opts: LeaderboardDeps): Promise<void> {
  const { db } = opts;

  app.get('/leaderboard', { preHandler: optionalAuth(db) }, async (request) => {
    return getLeaderboard(db, request.user?.id ?? null);
  });
}
