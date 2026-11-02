import { and, desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { FastifyInstance } from 'fastify';
import {
  DRAW_PENALTY,
  FORFEIT_PENALTY,
  FORFEIT_REWARD,
  WIN_SWING_MIN,
} from '@coding-arena/shared';
import { requireAuth } from './auth.js';
import type { Database } from '../db/index.js';
import {
  challengeVersions,
  challenges,
  matchPlayers,
  matches,
  submissions,
  users,
} from '../db/schema.js';
import { getChallengeWithVersion, redactResults, visibleTests, type TestCase } from '../services/challenges.js';
import { judgeLoop, parseSubmissionBody } from '../services/judging.js';
import { allowJudgeSubmission } from '../services/rate-limit.js';
import { finishMatch, getMatchWithPlayers, type Outcome } from '../services/matches.js';
import { issueSocketToken } from '../services/gateway.js';
import { recordEvent } from '../services/events.js';

/**
 * F06/F07 match routes (docs/features/F06-match-engine.md, F07-history-repeat.md).
 * All cookie-authed, participant-checked. The server decides everything:
 * the first accepted submission wins via a conditional update; points move
 * per decision D5 in the same transaction as the finish.
 */

type MatchDeps = {
  db: Database;
};

/** The per-language entry-function names ({ javascript, python }) from a version row. */
function entryFunctionsOf(v: { entryFunctions: unknown }): { javascript: string; python: string } {
  const e = (v.entryFunctions ?? {}) as { javascript?: unknown; python?: unknown };
  return {
    javascript: typeof e.javascript === 'string' ? e.javascript : '',
    python: typeof e.python === 'string' ? e.python : '',
  };
}

export async function matchRoutes(app: FastifyInstance, opts: MatchDeps): Promise<void> {
  const { db } = opts;
  const auth = { preHandler: requireAuth(db) };

  /** Participant guard: 404 unknown, 403 not a participant. */
  async function requireParticipant(matchId: string, userId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(matchId)) return null;
    const found = await getMatchWithPlayers(db, matchId);
    if (!found) return null;
    if (!found.players.some((p) => p.userId === userId)) return null;
    return found;
  }

  /** GET /matches — own history, newest first, active matches pinned on top (F07). */
  app.get('/matches', auth, async (request) => {
    const me = request.user!.id;
    const mine = alias(matchPlayers, 'mine');
    const theirs = alias(matchPlayers, 'theirs');
    const query = request.query as { limit?: unknown; offset?: unknown };
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50);
    const offset = Math.max(Number(query.offset) || 0, 0);

    const rows = await db
      .select({
        id: matches.id,
        status: matches.status,
        resultType: matches.resultType,
        winnerId: matches.winnerId,
        finishedAt: matches.finishedAt,
        startedAt: matches.startedAt,
        endsAt: matches.endsAt,
        isBotMatch: matches.isBotMatch,
        pointsBefore: mine.pointsBefore,
        pointsAfter: mine.pointsAfter,
        opponentId: users.id,
        opponentName: users.displayName,
        opponentAvatar: users.avatarUrl,
        challengeSlug: challenges.slug,
        challengeTitle: challenges.title,
        challengeDifficulty: challenges.difficulty,
      })
      .from(mine)
      .innerJoin(matches, eq(matches.id, mine.matchId))
      .innerJoin(theirs, and(eq(theirs.matchId, mine.matchId), sql`${theirs.userId} <> ${mine.userId}`))
      .innerJoin(users, eq(users.id, theirs.userId))
      .innerJoin(challengeVersions, eq(challengeVersions.id, matches.challengeVersionId))
      .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
      .where(eq(mine.userId, me))
      .orderBy(sql`CASE WHEN ${matches.status} = 'active' THEN 0 ELSE 1 END`, desc(sql`coalesce(${matches.finishedAt}, ${matches.startedAt}, ${matches.createdAt})`))
      .limit(limit)
      .offset(offset);

    return {
      matches: rows.map((r) => ({
        id: r.id,
        status: r.status,
        resultType: r.resultType,
        winnerId: r.winnerId,
        startedAt: r.startedAt?.toISOString() ?? null,
        endsAt: r.endsAt?.toISOString() ?? null,
        finishedAt: r.finishedAt?.toISOString() ?? null,
        isBotMatch: r.isBotMatch,
        pointsDelta: r.pointsAfter !== null ? r.pointsAfter - r.pointsBefore : null,
        points: r.pointsAfter,
        opponent: { id: r.opponentId, displayName: r.opponentName, avatarUrl: r.opponentAvatar },
        challenge: { slug: r.challengeSlug, title: r.challengeTitle, difficulty: r.challengeDifficulty },
      })),
    };
  });

  /** GET /matches/:id — participant-only full state (restore after refresh). */
  app.get('/matches/:id', auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const found = await requireParticipant(id, request.user!.id);
    if (!found) {
      const exists = await db.select({ id: matches.id }).from(matches).where(eq(matches.id, id)).limit(1);
      return reply.code(exists.length ? 403 : 404).send({ error: exists.length ? 'not_a_participant' : 'match_not_found' });
    }
    const { match, players } = found;
    const me = request.user!.id;

    // Challenge via visible tests only.
    const cv = await db
      .select({ slug: challenges.slug })
      .from(challengeVersions)
      .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
      .where(eq(challengeVersions.id, match.challengeVersionId))
      .limit(1);
    const detail = cv[0] ? await getChallengeWithVersion(db, cv[0].slug) : null;
    if (!detail) return reply.code(404).send({ error: 'match_not_found' });

    // My latest own submission in this match (code restore) + opponent progress.
    const mine = await db
      .select({
        id: submissions.id,
        status: submissions.status,
        passed: submissions.passed,
        total: submissions.total,
        language: submissions.language,
        sourceCode: submissions.sourceCode,
        results: submissions.results,
        createdAt: submissions.createdAt,
      })
      .from(submissions)
      .where(and(eq(submissions.matchId, match.id), eq(submissions.userId, me)))
      .orderBy(desc(submissions.createdAt))
      .limit(1);

    const opponent = players.find((p) => p.userId !== me);
    const opponentProgress = opponent
      ? await db
          .select({ attempts: sql<number>`count(*)::int`, testsPassed: sql<number>`coalesce(max(${submissions.passed}), 0)::int` })
          .from(submissions)
          .where(and(eq(submissions.matchId, match.id), eq(submissions.userId, opponent.userId)))
      : [{ attempts: 0, testsPassed: 0 }];

    return {
      match: {
        id: match.id,
        status: match.status,
        resultType: match.resultType,
        winnerId: match.winnerId,
        startedAt: match.startedAt?.toISOString() ?? null,
        endsAt: match.endsAt?.toISOString() ?? null,
        finishedAt: match.finishedAt?.toISOString() ?? null,
        isBotMatch: match.isBotMatch,
        challenge: {
          slug: detail.challenge.slug,
          title: detail.challenge.title,
          difficulty: detail.challenge.difficulty,
          statement: detail.version.statement,
          entryFunctions: entryFunctionsOf(detail.version),
          starterCode: detail.version.starterCode,
          timeLimitMs: detail.version.timeLimitMs,
          memoryLimitMb: detail.version.memoryLimitMb,
          visibleTests: visibleTests(detail.version.tests).map((t) => ({ args: t.args, expected: t.expected })),
        },
        players: players.map((p) => ({
          userId: p.userId,
          seat: p.seat,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl,
          points: p.points,
          pointsBefore: p.pointsBefore,
          pointsAfter: p.pointsAfter,
          online: p.disconnectedAt === null,
        })),
        mySubmission: mine[0]
          ? {
              id: mine[0].id,
              status: mine[0].status,
              passed: mine[0].passed,
              total: mine[0].total,
              language: mine[0].language,
              sourceCode: mine[0].sourceCode,
              results: mine[0].results,
            }
          : null,
        opponentProgress: { attempts: opponentProgress[0]?.attempts ?? 0, testsPassed: opponentProgress[0]?.testsPassed ?? 0 },
      },
    };
  });

  /** POST /matches/:id/submit — judged duel submission; an accepted one may finish the match. */
  app.post('/matches/:id/submit', auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const found = await requireParticipant(id, request.user!.id);
    if (!found) {
      return reply.code(404).send({ error: 'match_not_found' });
    }
    const { match, players } = found;
    if (match.status !== 'active') {
      return reply.code(409).send({ error: 'match_not_active' });
    }
    const parsed = parseSubmissionBody(request.body);
    if ('error' in parsed) {
      return reply.code(400).send({ error: parsed.error });
    }
    if (!allowJudgeSubmission(request.user!.id)) {
      return reply.code(429).send({ error: 'rate_limited', message: 'Too many submissions - wait a few minutes.' });
    }

    const cv = await db
      .select({ slug: challenges.slug })
      .from(challengeVersions)
      .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
      .where(eq(challengeVersions.id, match.challengeVersionId))
      .limit(1);
    const detail = cv[0] ? await getChallengeWithVersion(db, cv[0].slug) : null;
    if (!detail) return reply.code(404).send({ error: 'match_not_found' });

    const entry = entryFunctionsOf(detail.version)[parsed.language];
    if (!entry) return reply.code(400).send({ error: 'entry_point_missing' });

    const me = request.user!.id;
    const { results, aggregate: agg, latencyMs } = await judgeLoop(
      me,
      parsed.language,
      parsed.sourceCode,
      entry,
      detail.version.tests as TestCase[],
      { timeLimitMs: detail.version.timeLimitMs, memoryLimitMb: detail.version.memoryLimitMb },
    );
    const redacted = redactResults(results);

    const [saved] = await db
      .insert(submissions)
      .values({
        userId: me,
        challengeId: detail.challenge.id,
        challengeVersionId: detail.version.id,
        matchId: match.id,
        kind: 'submit',
        language: parsed.language,
        status: agg.status,
        passed: results.filter((r) => r.pass).length,
        total: results.length,
        results: redacted,
        sourceCode: parsed.sourceCode,
        judgeLatencyMs: latencyMs,
      })
      .returning({ id: submissions.id });
    app.log.info(
      { userId: me, matchId: match.id, submissionId: saved.id, slug: cv[0]?.slug, status: agg.status },
      'duel submission judged',
    );
    await recordEvent(db, {
      type: 'submit',
      userId: me,
      matchId: match.id,
      meta: { context: 'duel', slug: cv[0]?.slug ?? null, status: agg.status },
    });

    // Opponent sees progress only — never code or outputs.
    const myAttempts = await db
      .select({ attempts: sql<number>`count(*)::int` })
      .from(submissions)
      .where(and(eq(submissions.matchId, match.id), eq(submissions.userId, me)));
    app.gateway.broadcastProgress(match.id, {
      userId: me,
      testsPassed: results.filter((r) => r.pass).length,
      attempts: myAttempts[0]?.attempts ?? 1,
    });

    let applied: Awaited<ReturnType<typeof finishMatch>> = null;
    if (agg.status === 'accepted') {
      const outcome: Outcome = { kind: 'win', winnerId: me, loserId: players.find((p) => p.userId !== me)!.userId };
      applied = await finishMatch(db, match.id, outcome);
    }

    if (applied) {
      // Deltas exactly as applied (floor rule may reduce a poor loser's loss).
      const deltas = applied.deltas;
      await app.gateway.broadcastMatchEnded(match.id, {
        resultType: applied.outcome.kind,
        winnerId: applied.outcome.kind === 'draw' ? null : applied.outcome.winnerId,
        deltas,
      });
    }

    return {
      status: agg.status,
      passed: results.filter((r) => r.pass).length,
      total: results.length,
      results: redacted,
      matchFinished: await matchIsFinished(db, match.id),
      matchOutcome: applied
        ? {
            resultType: applied.outcome.kind,
            winnerId: applied.outcome.kind === 'draw' ? null : applied.outcome.winnerId,
            deltas: applied.deltas,
          }
        : null,
    };
  });

  /** GET /matches/:id/socket-token — one-time socket token, participant-only. */
  app.get('/matches/:id/socket-token', auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const found = await requireParticipant(id, request.user!.id);
    if (!found) {
      return reply.code(404).send({ error: 'match_not_found' });
    }
    return issueSocketToken(request.user!.id);
  });
}

/** Small helper: is the match finished in the DB right now? */
async function matchIsFinished(db: Database, matchId: string): Promise<boolean> {
  const rows = await db.select({ status: matches.status }).from(matches).where(eq(matches.id, matchId)).limit(1);
  return rows[0]?.status === 'finished';
}
