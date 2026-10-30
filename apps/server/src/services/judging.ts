import { LANGUAGES, MAX_CODE_LENGTH, type Language } from '@coding-arena/shared';
import type { TestCase } from './challenges.js';
import { composeSource, isFunctionPass, runOnce } from './judge.js';
import { recordJudgeSubmission } from './rate-limit.js';

/**
 * Shared judge loop for practice (F04) and duel (F06) submissions: identical
 * function-call harness, per-test verdicts, aggregation, and rate limiting.
 * The player's function is called with each test's arguments through
 * composeSource — their code never sees test JSON.
 */

export type TestResult = {
  index: number;
  hidden: boolean;
  pass: boolean;
  status: string;
  args?: unknown[];
  expected?: string;
  stdout?: string;
  stderr?: string;
  timeMs?: number;
};

/** Aggregate per-test verdicts into one submission status. */
export function aggregate(results: TestResult[]): {
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

/** Validate a run/submit body; returns the parsed values or an error code. */
export function parseSubmissionBody(body: unknown): { language: Language; sourceCode: string } | { error: string } {
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

export async function judgeLoop(
  userId: string,
  language: Language,
  sourceCode: string,
  entryFunction: string,
  tests: TestCase[],
  limits: { timeLimitMs: number; memoryLimitMb: number },
): Promise<{ results: TestResult[]; aggregate: ReturnType<typeof aggregate>; latencyMs: number }> {
  const started = Date.now();
  const composed = composeSource(language, sourceCode, entryFunction);
  const results: TestResult[] = [];
  for (const [index, test] of tests.entries()) {
    const run = await runOnce({
      language,
      sourceCode: composed,
      stdin: JSON.stringify(test.args),
      timeLimitMs: limits.timeLimitMs,
      memoryLimitMb: limits.memoryLimitMb,
    });
    results.push({
      index,
      hidden: test.hidden,
      pass: isFunctionPass(run, test.expected),
      status: run.status,
      args: test.args,
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
