import type { FastifyInstance } from 'fastify';
import { requireAuth } from './auth.js';
import type { Database } from '../db/index.js';
import {
  entryFunctionsOf,
  getChallengeWithVersion,
  listForPlayer,
  listOwnSubmissions,
  redactResults,
  saveSubmission,
  visibleTests,
  type TestCase,
} from '../services/challenges.js';
import { judgeLoop, parseSubmissionBody } from '../services/judging.js';
import { allowJudgeSubmission } from '../services/rate-limit.js';
import { dailyPayload } from '../services/daily.js';
import { SESSION_COOKIE } from '@coding-arena/shared';
import { resolveSession } from '../services/sessions.js';
import { recordEvent } from '../services/events.js';

type ChallengeDeps = {
  db: Database;
};

/**
 * F04 practice routes (docs/features/F04-practice-mode.md). All cookie-authed.
 * The server is the referee: hidden tests are stripped server-side (visibleTests)
 * and player code only ever runs inside Judge0.
 */
export async function challengeRoutes(app: FastifyInstance, opts: ChallengeDeps): Promise<void> {
  const { db } = opts;
  const auth = { preHandler: requireAuth(db) };

  /** GET /challenges — the list for the practice screen. */
  app.get('/challenges', auth, async (request) => {
    const list = await listForPlayer(db, request.user!.id);
    return { challenges: list };
  });

  /** GET /challenges/:slug — statement + starter + VISIBLE tests only. */
  app.get('/challenges/:slug', auth, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) {
      return reply.code(404).send({ error: 'challenge_not_found' });
    }
    const found = await getChallengeWithVersion(db, slug);
    if (!found || !found.challenge.isPublished) {
      return reply.code(404).send({ error: 'challenge_not_found' });
    }
    const v = found.version;
    return {
      challenge: {
        slug: found.challenge.slug,
        title: found.challenge.title,
        difficulty: found.challenge.difficulty,
        tags: found.challenge.tags,
        version: found.challenge.currentVersion,
        statement: v.statement,
        entryFunctions: entryFunctionsOf(v),
        starterCode: v.starterCode,
        timeLimitMs: v.timeLimitMs,
        memoryLimitMb: v.memoryLimitMb,
        visibleTests: visibleTests(v.tests).map((t) => ({ args: t.args, expected: t.expected })),
      },
    };
  });

  /** POST /challenges/:slug/run — visible tests only, never saved. */
  app.post('/challenges/:slug/run', auth, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) {
      return reply.code(404).send({ error: 'challenge_not_found' });
    }
    const parsed = parseSubmissionBody(request.body);
    if ('error' in parsed) {
      return reply.code(400).send({ error: parsed.error });
    }
    if (!allowJudgeSubmission(request.user!.id)) {
      return reply.code(429).send({ error: 'rate_limited', message: 'Too many runs - wait a few minutes.' });
    }
    const found = await getChallengeWithVersion(db, slug);
    if (!found || !found.challenge.isPublished) {
      return reply.code(404).send({ error: 'challenge_not_found' });
    }
    const runEntry = entryFunctionsOf(found.version)[parsed.language];
    if (!runEntry) {
      return reply.code(400).send({ error: 'entry_point_missing' });
    }
    const { results, aggregate: agg, latencyMs } = await judgeLoop(
      request.user!.id,
      parsed.language,
      parsed.sourceCode,
      runEntry,
      visibleTests(found.version.tests),
      { timeLimitMs: found.version.timeLimitMs, memoryLimitMb: found.version.memoryLimitMb },
    );
    // Same redaction as Submit: one results shape for the UI (args as JSON string).
    return { status: agg.status, passed: results.filter((r) => r.pass).length, total: results.length, results: redactResults(results), latencyMs };
  });

  /** POST /challenges/:slug/submit — all tests, saved, hidden inputs redacted. */
  app.post('/challenges/:slug/submit', auth, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) {
      return reply.code(404).send({ error: 'challenge_not_found' });
    }
    const parsed = parseSubmissionBody(request.body);
    if ('error' in parsed) {
      return reply.code(400).send({ error: parsed.error });
    }
    if (!allowJudgeSubmission(request.user!.id)) {
      return reply.code(429).send({ error: 'rate_limited', message: 'Too many submissions - wait a few minutes.' });
    }
    const found = await getChallengeWithVersion(db, slug);
    if (!found || !found.challenge.isPublished) {
      return reply.code(404).send({ error: 'challenge_not_found' });
    }
    const all = found.version.tests as TestCase[];
    const submitEntry = entryFunctionsOf(found.version)[parsed.language];
    if (!submitEntry) {
      return reply.code(400).send({ error: 'entry_point_missing' });
    }
    const { results, aggregate: agg, latencyMs } = await judgeLoop(
      request.user!.id,
      parsed.language,
      parsed.sourceCode,
      submitEntry,
      all,
      { timeLimitMs: found.version.timeLimitMs, memoryLimitMb: found.version.memoryLimitMb },
    );
    const redacted = redactResults(results);
    const saved = await saveSubmission(db, {
      userId: request.user!.id,
      challengeId: found.challenge.id,
      challengeVersionId: found.version.id,
      kind: 'submit',
      language: parsed.language,
      status: agg.status,
      passed: results.filter((r) => r.pass).length,
      total: results.length,
      results: redacted,
      sourceCode: parsed.sourceCode,
      judgeLatencyMs: latencyMs,
    });
    app.log.info(
      { userId: request.user!.id, submissionId: saved.id, slug, status: agg.status, passed: results.filter((r) => r.pass).length, total: results.length },
      'practice submission judged',
    );
    await recordEvent(db, { type: 'submit', userId: request.user!.id, meta: { context: 'practice', slug, status: agg.status } });
    return { submissionId: saved.id, status: agg.status, passed: results.filter((r) => r.pass).length, total: results.length, results: redacted };
  });

  /** GET /challenges/:slug/submissions — the player's own history for this challenge. */
  app.get('/challenges/:slug/submissions', auth, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) {
      return reply.code(404).send({ error: 'challenge_not_found' });
    }
    const found = await getChallengeWithVersion(db, slug);
    if (!found || !found.challenge.isPublished) {
      return reply.code(404).send({ error: 'challenge_not_found' });
    }
    return { submissions: await listOwnSubmissions(db, request.user!.id, found.challenge.id) };
  });

  /** GET /daily — today's challenge for EVERYONE (F09). Viewable signed-out
   * (session resolved opportunistically, never 401s); solving still goes
   * through the authed practice flow (/practice/:slug). F10: the view is a
   * fire-and-forget analytics event (only when a player is signed in —
   * anonymous page loads stay untracked). */
  app.get('/daily', async (request) => {
    const token = request.cookies[SESSION_COOKIE];
    const session = token ? await resolveSession(db, token) : null;
    const payload = await dailyPayload(db, session?.user.id ?? null);
    if (session) {
      await recordEvent(db, { type: 'daily_view', userId: session.user.id, meta: { slug: payload.challenge?.slug ?? null } });
    }
    return payload;
  });
}
