import type { EntryPoint, FunctionParamType, Language } from '@coding-arena/shared';
import {
  JUDGE0_LANGUAGE_IDS,
  RUN_MEMORY_LIMIT_MB,
  RUN_TIME_LIMIT_MS,
  RUN_TIME_MULTIPLIERS,
  entryName,
  entrySignature,
} from '@coding-arena/shared';
import { env } from '../config/env.js';
import { CPP_PRELUDE, JAVA_PRELUDE, JAVA_SUPPORT } from './judge-harness.js';

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

/** Per-language CPU limit (PLAN F3/F12: per-language time multiplier). */
export function timeLimitMsFor(language: Language, baseMs = RUN_TIME_LIMIT_MS): number {
  return Math.round(baseMs * RUN_TIME_MULTIPLIERS[language]);
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
 * - Java: Long/String/boolean/array serializers in judge-harness.ts
 * - C++ : arena::encode in judge-harness.ts
 * All produce identical JSON for numbers / strings / arrays / booleans / null.
 * The last non-empty stdout line is the answer, so stray prints don't break it.
 * Java and C++ receive a typed entry signature (F12) so the wrapper knows the
 * player function's parameter and return types.
 */
export function composeSource(language: Language, userCode: string, entry: EntryPoint): string {
  const entryFunction = entryName(entry);
  if (language === 'javascript') {
    return `${userCode}\nif (typeof ${entryFunction} !== 'function') { throw new Error('define the function ${entryFunction}(…)'); }\nconst __args = JSON.parse(require('fs').readFileSync(0, 'utf8'));\nprocess.stdout.write(JSON.stringify(${entryFunction}.apply(null, __args)));\n`;
  }
  if (language === 'python') {
    return `${userCode}\nimport json as __json, sys as __sys\n__args = __json.loads(__sys.stdin.read())\n__fn = globals().get('${entryFunction}')\nif not callable(__fn):\n    raise SystemExit('define the function ${entryFunction}(…)')\nprint(__json.dumps(__fn(*__args), separators=(',', ':'), ensure_ascii=False))\n`;
  }

  const signature = entrySignature(entry);
  if (!signature) {
    throw new Error(`missing typed signature for ${language} entry point ${entryFunction}`);
  }

  if (language === 'cpp') {
    const args = signature.params
      .map((type, i) => `${CPP_CONVERTERS[type]}(__args.items.at(${i}))`)
      .join(', ');
    return `${CPP_PRELUDE}\n${userCode}\n\nint main() {\n  std::ios::sync_with_stdio(false);\n  std::cin.tie(nullptr);\n  std::string __raw((std::istreambuf_iterator<char>(std::cin)), std::istreambuf_iterator<char>());\n  arena::Val __args = arena::parseArgs(__raw);\n  ${CPP_TYPES[signature.returns]} __result = ${entryFunction}(${args});\n  std::cout << arena::encode(__result);\n  return 0;\n}\n`;
  }

  const args = signature.params
    .map((type, i) => `${JAVA_CONVERTERS[type]}(__args.items.get(${i}))`)
    .join(', ');
  return `${JAVA_PRELUDE}\n${userCode}\n\npublic class Main {\n${JAVA_SUPPORT}\n\n  public static void main(String[] __argv) throws Exception {\n    String __raw = new String(System.in.readAllBytes(), StandardCharsets.UTF_8);\n    Val __args = new Parser(__raw).parse();\n    if (__args.kind != Val.ARR) throw new RuntimeException("arguments must be an array");\n    ${JAVA_TYPES[signature.returns]} __result = Solution.${entryFunction}(${args});\n    System.out.print(out(__result));\n  }\n}\n`;
}

/** Java type for a harness signature (every number is a 64-bit long). */
const JAVA_TYPES: Record<FunctionParamType, string> = {
  number: 'long',
  string: 'String',
  boolean: 'boolean',
  'number[]': 'long[]',
  'string[]': 'String[]',
  'number[][]': 'long[][]',
};

/** Java converter for one parsed argument. */
const JAVA_CONVERTERS: Record<FunctionParamType, string> = {
  number: 'asNum',
  string: 'asStr',
  boolean: 'asBool',
  'number[]': 'asNums',
  'string[]': 'asStrs',
  'number[][]': 'asMatrix',
};

/** C++ type for a harness signature (every number is a 64-bit long long). */
const CPP_TYPES: Record<FunctionParamType, string> = {
  number: 'long long',
  string: 'std::string',
  boolean: 'bool',
  'number[]': 'std::vector<long long>',
  'string[]': 'std::vector<std::string>',
  'number[][]': 'std::vector<std::vector<long long>>',
};

/** C++ converter for one parsed argument. */
const CPP_CONVERTERS: Record<FunctionParamType, string> = {
  number: 'arena::asNum',
  string: 'arena::asStr',
  boolean: 'arena::asBool',
  'number[]': 'arena::asNums',
  'string[]': 'arena::asStrs',
  'number[][]': 'arena::asMatrix',
};

/** The answer line: the LAST non-empty stdout line (player prints are tolerated). */
export function answerOf(stdout: string): string {
  const lines = normalizeOutput(stdout).split('\n').filter((l) => l.trim() !== '');
  return lines.length > 0 ? lines[lines.length - 1] : '';
}

/** Compare a harness run against the frozen JSON answer. */
export function isFunctionPass(run: JudgeRun, expected: string): boolean {
  return run.status === 'accepted' && answerOf(run.stdout) === expected;
}
