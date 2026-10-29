import type { Language } from '@coding-arena/shared';
import { JUDGE0_LANGUAGE_IDS, RUN_MEMORY_LIMIT_MB, RUN_TIME_LIMIT_MS, RUN_TIME_MULTIPLIER_PY } from '@coding-arena/shared';
import { env } from '../config/env.js';

/**
 * Judge0 client (docs/features/F04-practice-mode.md). The server is the only
 * caller; the browser never talks to the judge. Player code executes inside
 * Judge0's sandbox only — never in our process.
 *
 * D4: hosted, free public CE endpoint by default; JUDGE0_API_URL / JUDGE0_API_KEY
 * make a keyed or self-hosted endpoint an env-only swap.
 */

type Judge0Status = { id: number; description: string };
type Judge0Response = {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  status: Judge0Status;
  time: string | null;
  memory: number | null;
};

/** The subset of Judge0 status ids we distinguish; everything else is internal_error. */
const STATUS_MAP: Record<number, 'accepted' | 'time_limit' | 'memory_limit' | 'runtime_error' | 'compile_error' | 'internal_error'> = {
  3: 'accepted', // program ran to exit 0 (pass/fail is our stdout comparison)
  5: 'time_limit',
  6: 'compile_error',
  // 7..12 are the runtime-error signals (NZEC, segfault, OOM-as-signal, etc.)
  7: 'runtime_error',
  8: 'runtime_error',
  9: 'runtime_error',
  10: 'runtime_error',
  11: 'runtime_error',
  12: 'runtime_error',
  14: 'runtime_error', // exec format error
  13: 'internal_error', // judge's own internal error
};

export type JudgeRun = {
  /** Our submission_status verdict for this single test case. */
  status: 'accepted' | 'wrong_answer' | 'time_limit' | 'memory_limit' | 'runtime_error' | 'compile_error' | 'internal_error';
  stdout: string;
  stderr: string;
  compileOutput: string;
  /** Wall-clock the judge reported (ms). */
  timeMs: number;
  /** Memory the judge reported (KB). */
  memoryKb: number;
};

/** Per-language CPU limit (PLAN F3: per-language time multiplier). */
function timeLimitMsFor(language: Language): number {
  return language === 'python' ? Math.round(RUN_TIME_LIMIT_MS * RUN_TIME_MULTIPLIER_PY) : RUN_TIME_LIMIT_MS;
}

/** Judge0 compares loosely; we compare exactly, modulo trailing whitespace. */
export function normalizeOutput(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd();
}

/**
 * Run ONE test case: player source on one stdin input. Runs synchronously
 * (wait=true) — v1 executes one judge call per test and aggregates in the
 * route (docs/features/F04-practice-mode.md).
 */
export async function runOnce(opts: {
  language: Language;
  sourceCode: string;
  stdin: string;
  /** Overrides the per-language default (challenge versions may pin their own). */
  timeLimitMs?: number;
  memoryLimitMb?: number;
}): Promise<JudgeRun> {
  const started = Date.now();
  const timeLimitMs = opts.timeLimitMs ?? timeLimitMsFor(opts.language);
  const memoryLimitMb = opts.memoryLimitMb ?? RUN_MEMORY_LIMIT_MB;

  const body = {
    source_code: opts.sourceCode,
    language_id: JUDGE0_LANGUAGE_IDS[opts.language],
    stdin: opts.stdin,
    cpu_time_limit: Math.ceil(timeLimitMs / 100) / 10, // seconds, one decimal
    // Grace beyond the CPU limit: on the shared free endpoint, box load can
    // inflate measured CPU time; this absorbs the jitter without letting real
    // infinite loops through (they still get killed after limit + extra).
    cpu_extra_time: 1,
    memory_limit: memoryLimitMb * 1024, // KB
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeLimitMs + 20_000);

  let response: Response;
  try {
    response = await fetch(`${env.judge0Url}/submissions?base64_encoded=false&wait=true`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(env.judge0ApiKey ? { 'X-Auth-Token': env.judge0ApiKey, 'X-RapidAPI-Key': env.judge0ApiKey } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    return {
      status: 'internal_error',
      stdout: '',
      stderr: err instanceof Error ? `judge unreachable: ${err.message}` : 'judge unreachable',
      compileOutput: '',
      timeMs: Date.now() - started,
      memoryKb: 0,
    };
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return {
      status: 'internal_error',
      stdout: '',
      stderr: `judge HTTP ${response.status}: ${text.slice(0, 200)}`,
      compileOutput: '',
      timeMs: Date.now() - started,
      memoryKb: 0,
    };
  }

  const data = (await response.json()) as Judge0Response;
  const mapped = STATUS_MAP[data.status?.id] ?? 'internal_error';
  return {
    status: mapped,
    stdout: data.stdout ?? '',
    stderr: data.stderr ?? '',
    compileOutput: data.compile_output ?? '',
    timeMs: data.time ? Math.round(Number(data.time) * 1000) : Date.now() - started,
    memoryKb: data.memory ?? 0,
  };
}

/**
 * Function-call harness (owner decision, 2026-10-29: the player writes a
 * FUNCTION and returns the answer — no stdin parsing, no printing). The server
 * wraps their code so the judge calls the entry function with the test's
 * arguments (delivered as a JSON array on stdin) and prints the return value
 * as one JSON line. Everything still executes inside Judge0's sandbox.
 *
 * Serialization contract (must match across languages):
 * - JS  : JSON.stringify(value)
 * - PY  : json.dumps(value, separators=(',', ':'), ensure_ascii=False)
 * Both produce identical JSON for numbers / strings / arrays / booleans / null.
 * The last non-empty stdout line is the answer, so stray prints don't break it.
 */
export function composeSource(language: Language, userCode: string, entryFunction: string): string {
  if (language === 'javascript') {
    return `${userCode}\nif (typeof ${entryFunction} !== 'function') { throw new Error('define the function ${entryFunction}(…)'); }\nconst __args = JSON.parse(require('fs').readFileSync(0, 'utf8'));\nprocess.stdout.write(JSON.stringify(${entryFunction}.apply(null, __args)));\n`;
  }
  return `${userCode}\nimport json as __json, sys as __sys\n__args = __json.loads(__sys.stdin.read())\n__fn = globals().get('${entryFunction}')\nif not callable(__fn):\n    raise SystemExit('define the function ${entryFunction}(…)')\nprint(__json.dumps(__fn(*__args), separators=(',', ':'), ensure_ascii=False))\n`;
}

/** The answer line: the LAST non-empty stdout line (player prints are tolerated). */
export function answerOf(stdout: string): string {
  const lines = normalizeOutput(stdout).split('\n').filter((l) => l.trim() !== '');
  return lines.length > 0 ? lines[lines.length - 1] : '';
}

/** Compare a harness run against the frozen JSON answer. */
export function isFunctionPass(run: JudgeRun, expected: string): boolean {
  return run.status === 'accepted' && answerOf(run.stdout) === expected;
}
