import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { requireAuth } from './auth.js';
import type { Database } from '../db/index.js';
import { matches, submissions } from '../db/schema.js';
import {
  entryFunctionsOf,
  getChallengeWithVersion,
  visibleTests,
  type TestCase,
} from '../services/challenges.js';
import {
  aiUsageToday,
  analyzeWithGemini,
  buildPrompt,
  recordAiReview,
  type AiLanguage,
  type AiReview,
} from '../services/ai.js';
import { env } from '../config/env.js';
import { AI_BURST_MAX_PER_WINDOW, AI_BURST_WINDOW_MS, AI_DAILY_LIMIT, LANGUAGES, entryName } from '@coding-arena/shared';
import { recordEvent } from '../services/events.js';

type AiDeps = {
  db: Database;
};

/**
 * F11 AI code analysis (docs/features/F11-ai-analysis.md). Cookie-authed,
 * opt-in only: nothing reaches the provider unless the player clicks Analyze.
 * Guard order matters: cheap local validation → burst limit → durable daily
 * cap → (duel) ownership check → provider call.
 */

/** In-memory burst limiter (same single-instance tradeoff as the others). */
const burstHits = new Map<string, number[]>();
function allowBurst(userId: string): boolean {
  const now = Date.now();
  const recent = (burstHits.get(userId) ?? []).filter((t) => now - t < AI_BURST_WINDOW_MS);
  burstHits.set(userId, recent);
  if (recent.length >= AI_BURST_MAX_PER_WINDOW) return false;
  recent.push(now);
  return true;
}

type ReviewBody = {
  slug?: unknown;
  language?: unknown;
  sourceCode?: unknown;
  submissionId?: unknown;
  context?: unknown;
};

function parseBody(body: unknown): { error: string } | {
  slug: string;
  language: AiLanguage;
  sourceCode: string;
  submissionId: string | null;
  context: 'practice' | 'duel';
} {
  const b = (body ?? {}) as ReviewBody;
  if (typeof b.slug !== 'string' || !/^[a-z0-9-]{1,80}$/.test(b.slug)) return { error: 'invalid_slug' };
  if (typeof b.language !== 'string' || !LANGUAGES.includes(b.language as AiLanguage)) {
    return { error: 'invalid_language' };
  }
  if (typeof b.sourceCode !== 'string' || b.sourceCode.trim().length === 0) {
    return { error: 'invalid_source_code' };
  }
  const context = b.context === 'duel' ? 'duel' : 'practice';
  if (context === 'duel' && (typeof b.submissionId !== 'string' || b.submissionId.length === 0)) {
    return { error: 'duel_needs_submission' };
  }
  return {
    slug: b.slug,
    language: b.language as AiLanguage,
    sourceCode: b.sourceCode,
    submissionId: typeof b.submissionId === 'string' ? b.submissionId : null,
    context,
  };
}

export async function aiRoutes(app: FastifyInstance, opts: AiDeps): Promise<void> {
  const { db } = opts;
  const auth = { preHandler: requireAuth(db) };

  const featureOn = env.geminiApiKey.length > 0;
  if (!featureOn) {
    app.log.info('ai analysis disabled: GEMINI_API_KEY not set');
  }

  /** GET /ai/usage — remaining analyses today + feature flag. */
  app.get('/ai/usage', auth, async (request) => {
    if (!featureOn) return { enabled: false };
    const usage = await aiUsageToday(db, request.user!.id, env.aiDailyLimit);
    return { enabled: true, ...usage };
  });

  /** POST /ai/review — analyze the player's own code against one challenge. */
  app.post('/ai/review', auth, async (request, reply) => {
    if (!featureOn) {
      return reply.code(503).send({ error: 'ai_disabled' });
    }
    const parsed = parseBody(request.body);
    if ('error' in parsed) {
      return reply.code(400).send({ error: parsed.error });
    }
    // Size cap BEFORE anything touches the provider.
    if (parsed.sourceCode.length > env.aiMaxCodeChars) {
      return reply.code(413).send({ error: 'code_too_large', max: env.aiMaxCodeChars });
    }
    if (!allowBurst(request.user!.id)) {
      return reply.code(429).send({ error: 'rate_limited', message: 'Slow down - wait a minute.' });
    }
    const usage = await aiUsageToday(db, request.user!.id, env.aiDailyLimit);
    if (usage.used >= usage.limit) {
      return reply.code(429).send({ error: 'daily_cap_reached', ...usage });
    }

    const found = await getChallengeWithVersion(db, parsed.slug);
    if (!found || !found.challenge.isPublished) {
      return reply.code(404).send({ error: 'challenge_not_found' });
    }

    // Duel reviews anchor to the caller's own submission of a FINISHED match
    // they played. Ownership + state checked in one join — never trust ids.
    if (parsed.context === 'duel' && parsed.submissionId) {
      const owned = await db
        .select({ id: submissions.id, matchStatus: matches.status })
        .from(submissions)
        .innerJoin(matches, eq(matches.id, submissions.matchId))
        .where(and(eq(submissions.id, parsed.submissionId), eq(submissions.userId, request.user!.id)))
        .limit(1);
      if (!owned[0] || owned[0].matchStatus !== 'finished') {
        return reply.code(403).send({ error: 'submission_not_reviewable' });
      }
    }

    const entry = entryFunctionsOf(found.version)[parsed.language];
    const entryFunction = entryName(entry);
    const tests = visibleTests(found.version.tests) as TestCase[];

    let review: AiReview;
    try {
      review = await analyzeWithGemini(
        {
          challengeTitle: found.challenge.title,
          difficulty: found.challenge.difficulty,
          statement: found.version.statement,
          entryFunction,
          // ONLY visible tests — the prompt builder never sees the hidden ones.
          tests: tests.map((t) => ({ args: t.args, expected: t.expected })),
          language: parsed.language,
          sourceCode: parsed.sourceCode,
        },
        { apiKey: env.geminiApiKey, model: env.aiModel },
      );
    } catch (err) {
      app.log.warn({ userId: request.user!.id, err: (err as Error).message }, 'ai review failed');
      return reply.code(502).send({ error: 'ai_upstream' });
    }

    await recordAiReview(db, {
      userId: request.user!.id,
      challengeId: found.challenge.id,
      submissionId: parsed.submissionId,
      context: parsed.context,
      language: parsed.language,
      verdict: review,
      model: env.aiModel,
    });
    await recordEvent(db, { type: 'ai_review', userId: request.user!.id, meta: { context: parsed.context, slug: parsed.slug } });
    const after = await aiUsageToday(db, request.user!.id, env.aiDailyLimit);
    return { review, usage: after };
  });

  /** Dev-time helper for the test gate: the exact prompt body the provider
   * would receive (no provider call, no cap consumption). Never ships hidden
   * data because buildPrompt only receives what we hand it. */
  app.post('/ai/prompt-preview', auth, async (request, reply) => {
    if (env.nodeEnv === 'production') {
      return reply.code(404).send({ error: 'not_found' });
    }
    const parsed = parseBody(request.body);
    if ('error' in parsed) {
      return reply.code(400).send({ error: parsed.error });
    }
    const found = await getChallengeWithVersion(db, parsed.slug);
    if (!found || !found.challenge.isPublished) {
      return reply.code(404).send({ error: 'challenge_not_found' });
    }
    const entry = entryFunctionsOf(found.version)[parsed.language];
    const entryFunction = entryName(entry);
    const tests = visibleTests(found.version.tests) as TestCase[];
    return buildPrompt({
      challengeTitle: found.challenge.title,
      difficulty: found.challenge.difficulty,
      statement: found.version.statement,
      entryFunction,
      tests: tests.map((t) => ({ args: t.args, expected: t.expected })),
      language: parsed.language,
      sourceCode: parsed.sourceCode.slice(0, env.aiMaxCodeChars),
    });
  });
}
