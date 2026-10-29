import type { FastifyInstance } from 'fastify';
import { LANGUAGES, MAX_CODE_LENGTH, type Language } from '@coding-arena/shared';
import { requireAuth } from './auth.js';
import type { Database } from '../db/index.js';
import {
  getChallengeWithVersion,
  listForPlayer,
  listOwnSubmissions,
  redactResults,
  saveSubmission,
  visibleTests,
  type TestCase,
} from '../services/challenges.js';
import { isPass, runOnce } from '../services/judge.js';
import { allowJudgeSubmission, recordJudgeSubmission } from '../services/rate-limit.js';

type ChallengeDeps = {
  db: Database;
};

type TestResult = {
  index: number;
  hidden: boolean;
  pass: boolean;
  status: string;
  input?: string;
  expected?: string;
  stdout?: string;
  stderr?: string;
  timeMs?: number;
};

/** Aggregate per-test verdicts into one submission status. */
function aggregate(results: TestResult[]): {
  status: 'accepted' | 'wrong_answer' | 'time_limit' | 'memory_limit' | 'runtime_error' | 'compile_error' | 'internal_error';
} {
  if (results.length > 0 && results.every((r) => r.pass)) return { status: 'accepted' };
  const first = (s: string) => results.find((r) => r.status === s);
  if (first('compile_error')) return { status: 'compile_error' };
  if (first('time_limit')) return { status: 'time_limit' };
  if (first('memory_limit')) return { status: 'memory_limit' };
  if (first('runtime_error')) return { status: 'runtime_error' };
  if (first('internal_error')) return { status: 'internal_error' };
  return { status: 'wrong_answer' };
}

/**
 * F04 practice routes (docs/features/F04-practice-mode.md). All cookie-authed.
 * The server is the referee: hidden tests are stripped server-side (visibleTests)
 * and player code only ever runs inside Judge0.
 */
export async function challengeRoutes(app: FastifyInstance, opts: ChallengeDeps): Promise<void> {
  const { db } = opts;
  const auth = { preHandler: requireAuth(db) };

  /** Validate a run/submit body; returns the parsed values or an error code. */
  function parseSubmissionBody(body: unknown): { language: Language; sourceCode: string } | { error: string } {
    const b = (body ?? {}) as { language?: unknown; sourceCode?: unknown };
    if (typeof b.language !== 'string' || !LANGUAGES.includes(b.language as Language)) {
      return { error: 'invalid_language' };
    }
    if (typeof b.sourceCode !== 'string' || b.sourceCode.trim().length === 0) {
      return { error: 'empty_code' };
    }
    if (b.sourceCode.length > MAX_CODE_LENGTH) {
      return { error: 'code_too_long' };
    }
    return { language: b.language as Language, sourceCode: b.sourceCode };
  }

  /** Shared judge loop: runs the given tests sequentially, aggregates, redacts. */
  async function judgeLoop(
    userId: string,
    language: Language,
    sourceCode: string,
    tests: TestCase[],
    limits: { timeLimitMs: number; memoryLimitMb: number },
  ): Promise<{ results: TestResult[]; aggregate: ReturnType<typeof aggregate>; latencyMs: number }> {
    const started = Date.now();
    const results: TestResult[] = [];
    for (const [index, test] of tests.entries()) {
      const run = await runOnce({
        language,
        sourceCode,
        stdin: test.input,
        timeLimitMs: limits.timeLimitMs,
        memoryLimitMb: limits.memoryLimitMb,
      });
      results.push({
        index,
        hidden: test.hidden,
        pass: isPass(run, test.expected),
        status: run.status,
        input: test.input,
        expected: test.expected,
        stdout: run.stdout,
        stderr: run.stderr || run.compileOutput || undefined,
        timeMs: run.timeMs,
      });
      // A compile error fails every test with the same message — no point burning judge calls.
      if (run.status === 'compile_error') {
        for (const rest of tests.slice(index + 1)) {
          results.push({ index: results.length, hidden: rest.hidden, pass: false, status: 'compile_error' });
        }
        break;
      }
    }
    recordJudgeSubmission(userId);
    return { results, aggregate: aggregate(results), latencyMs: Date.now() - started };
  }

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
        starterCode: v.starterCode,
        timeLimitMs: v.timeLimitMs,
        memoryLimitMb: v.memoryLimitMb,
        visibleTests: visibleTests(v.tests).map((t) => ({ input: t.input, expected: t.expected })),
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
    const { results, aggregate: agg, latencyMs } = await judgeLoop(
      request.user!.id,
      parsed.language,
      parsed.sourceCode,
      visibleTests(found.version.tests),
      { timeLimitMs: found.version.timeLimitMs, memoryLimitMb: found.version.memoryLimitMb },
    );
    return { status: agg.status, passed: results.filter((r) => r.pass).length, total: results.length, results, latencyMs };
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
    const { results, aggregate: agg, latencyMs } = await judgeLoop(
      request.user!.id,
      parsed.language,
      parsed.sourceCode,
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
      { userId: request.user!.id, slug, status: agg.status, passed: results.filter((r) => r.pass).length, total: results.length },
      'practice submission judged',
    );
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
}
