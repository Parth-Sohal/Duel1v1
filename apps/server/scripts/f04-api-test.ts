/**
 * F04 API test matrix (docs/features/F04-practice-mode.md, test checklist).
 * Creates a throwaway account and exercises the practice routes against the
 * REAL public Judge0 endpoint: list/detail, hidden-test stripping, run (right/
 * wrong/python/timeout), submit (save + redaction), history, validation, and
 * the per-user rate limit. Cleans up after itself.
 * Run with: npx tsx scripts/f04-api-test.ts
 */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { createDb } from '../src/db/index.js';
import { challenges, users } from '../src/db/schema.js';

const BASE = 'http://localhost:4000';
const EMAIL = 'f04-test@example.com';
const PASSWORD = 'F04TestPass!';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed++;
    console.log(`  PASS ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`);
  }
}

const db = createDb(process.env.DATABASE_URL!).db;

async function call(
  path: string,
  method: string,
  body: unknown,
  cookie?: string,
): Promise<{ status: number; json: any; cookie?: string }> {
  // Local network blips (ECONNRESET / DNS) have killed runs; retry them.
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(cookie ? { cookie } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      let json: any = null;
      try {
        json = await res.json();
      } catch {
        /* no body */
      }
      const setCookie = res.headers.get('set-cookie');
      return { status: res.status, json, cookie: setCookie?.split(';')[0] };
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  throw lastError;
}

/** Wipe the throwaway account (cascades submissions + sessions). */
async function cleanupUser(): Promise<void> {
  await db.delete(users).where(eq(users.email, EMAIL));
}

// --- ensure a clean slate -------------------------------------------------
await cleanupUser();
// start from everything unpublished; the test publishes two challenges itself
await db.update(challenges).set({ isPublished: false });

const REF_JS = `function pairTargetSum(nums, target) {
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) return [nums[i], nums[j]];
    }
  }
  return null;
}`;

const REF_PY = `def pair_target_sum(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [nums[i], nums[j]]
    return None`;

console.log('\n-- publish two challenges for the run --');
await db.update(challenges).set({ isPublished: true }).where(eq(challenges.slug, 'pair-target-sum'));
await db.update(challenges).set({ isPublished: true }).where(eq(challenges.slug, 'rotate-array'));

console.log('\n-- auth setup --');
const reg = await call('/api/auth/register', 'POST', { email: EMAIL, password: PASSWORD, displayName: 'F04 Tester' });
check('register 200', reg.status === 200, `got ${reg.status}`);
const cookie = reg.cookie!;

console.log('\n-- list + detail --');
const list = await call('/api/challenges', 'GET', undefined, cookie);
check('GET /challenges 200', list.status === 200);
check('list shows exactly the 2 published', list.json.challenges?.length === 2, JSON.stringify(list.json.challenges));
check('list has solved/attempts fields', list.json.challenges?.every((c: any) => c.solved === false && c.attempts === 0));

const detail = await call('/api/challenges/pair-target-sum', 'GET', undefined, cookie);
check('GET detail 200', detail.status === 200);
check('detail has statement + starter code (both langs)', !!detail.json.challenge?.statement && !!detail.json.challenge?.starterCode?.javascript && !!detail.json.challenge?.starterCode?.python);
check('detail exposes entry functions (both langs)', detail.json.challenge?.entryFunctions?.javascript === 'pairTargetSum' && detail.json.challenge?.entryFunctions?.python === 'pair_target_sum', JSON.stringify(detail.json.challenge?.entryFunctions));
check('detail shows exactly 2 visible tests', detail.json.challenge?.visibleTests?.length === 2, JSON.stringify(detail.json.challenge?.visibleTests));
const detailStr = JSON.stringify(detail.json);
check('detail leaks NO hidden tests', !detailStr.includes('"hidden":true'), 'found hidden:true in detail response');

const missing = await call('/api/challenges/first-duplicate', 'GET', undefined, cookie);
check('unpublished challenge -> 404', missing.status === 404);
const unknown = await call('/api/challenges/nope-does-not-exist', 'GET', undefined, cookie);
check('unknown slug -> 404', unknown.status === 404);
const noauth = await call('/api/challenges', 'GET', undefined);
check('list without cookie -> 401', noauth.status === 401);

console.log('\n-- run (visible tests only, not saved) --');
const runOk = await call('/api/challenges/pair-target-sum/run', 'POST', { language: 'javascript', sourceCode: REF_JS }, cookie);
check('run correct JS -> accepted', runOk.json.status === 'accepted' && runOk.json.passed === 2 && runOk.json.total === 2, JSON.stringify(runOk.json));
check('run results expose call arguments (visible)', runOk.json.results?.[0]?.args === '[[1,2,3,4],7]' && runOk.json.results?.[0]?.expected === '[3,4]', JSON.stringify(runOk.json.results?.[0]));
check('run saved nothing', (await call('/api/challenges/pair-target-sum/submissions', 'GET', undefined, cookie)).json.submissions?.length === 0);

const runWrong = await call('/api/challenges/pair-target-sum/run', 'POST', { language: 'javascript', sourceCode: 'function pairTargetSum(nums, target) { return [0, 0]; }' }, cookie);
check('run wrong -> wrong_answer', runWrong.json.status === 'wrong_answer' && runWrong.json.passed === 0, JSON.stringify(runWrong.json.results?.map((r: any) => r.status)));

const runPy = await call('/api/challenges/pair-target-sum/run', 'POST', { language: 'python', sourceCode: REF_PY }, cookie);
check('run correct Python -> accepted', runPy.json.status === 'accepted', JSON.stringify(runPy.json.results?.map((r: any) => r.status)));

const runTle = await call('/api/challenges/pair-target-sum/run', 'POST', { language: 'javascript', sourceCode: 'function pairTargetSum() { while(true){} }' }, cookie);
check('run infinite loop -> time_limit', runTle.json.status === 'time_limit', JSON.stringify(runTle.json.results?.map((r: any) => r.status)));

const runRe = await call('/api/challenges/pair-target-sum/run', 'POST', { language: 'javascript', sourceCode: 'function pairTargetSum() { throw new Error("boom"); }' }, cookie);
check('run throw -> runtime_error', runRe.json.status === 'runtime_error', JSON.stringify(runRe.json.results?.map((r: any) => r.status)));

const runCe = await call('/api/challenges/pair-target-sum/run', 'POST', { language: 'python', sourceCode: 'def oops(:' }, cookie);
// Interpreted languages: a syntax error is an NZEC exit -> runtime_error, and the
// player must be able to SEE why (stderr surfaced in the result).
check('run syntax error -> runtime_error with traceback', runCe.json.status === 'runtime_error' && (runCe.json.results?.[0]?.stderr ?? '').includes('SyntaxError'), JSON.stringify(runCe.json.results?.[0]));

console.log('\n-- submit (all tests, saved, hidden redacted) --');
const sub = await call('/api/challenges/pair-target-sum/submit', 'POST', { language: 'javascript', sourceCode: REF_JS }, cookie);
check('submit correct -> accepted 5/5', sub.json.status === 'accepted' && sub.json.passed === 5 && sub.json.total === 5, JSON.stringify(sub.json));
const hiddenResults = sub.json.results?.filter((r: any) => r.hidden === true) ?? [];
check('submit results include hidden markers', hiddenResults.length === 3, `got ${hiddenResults.length}`);
check('hidden results leak NO input/expected/stdout', hiddenResults.every((r: any) => !('input' in r) && !('expected' in r) && !('stdout' in r)), JSON.stringify(hiddenResults));
const visibleResults = sub.json.results?.filter((r: any) => r.hidden === false) ?? [];
check('visible results keep args+expected+stdout', visibleResults.every((r: any) => typeof r.args === 'string' && typeof r.expected === 'string' && typeof r.stdout === 'string'));

const wrongSub = await call('/api/challenges/pair-target-sum/submit', 'POST', { language: 'python', sourceCode: 'def pair_target_sum(nums, target):\n    return [0, 0]' }, cookie);
check('submit wrong -> wrong_answer saved', wrongSub.json.status === 'wrong_answer' && wrongSub.json.passed === 0 && wrongSub.json.total === 5, JSON.stringify({ status: wrongSub.json.status, passed: wrongSub.json.passed, total: wrongSub.json.total }));

const hist = await call('/api/challenges/pair-target-sum/submissions', 'GET', undefined, cookie);
check('history shows 2 own submissions', hist.json.submissions?.length === 2, JSON.stringify(hist.json.submissions?.length));
const listAfter = await call('/api/challenges', 'GET', undefined, cookie);
const pts = listAfter.json.challenges?.find((c: any) => c.slug === 'pair-target-sum');
check('list now shows pair-target-sum solved', pts?.solved === true && pts?.attempts === 2, JSON.stringify(pts));
const rot = listAfter.json.challenges?.find((c: any) => c.slug === 'rotate-array');
check('rotate-array still unsolved', rot?.solved === false);

console.log('\n-- validation --');
const badLang = await call('/api/challenges/pair-target-sum/run', 'POST', { language: 'ruby', sourceCode: 'x' }, cookie);
check('invalid language -> 400', badLang.status === 400 && badLang.json.error === 'invalid_language');
const empty = await call('/api/challenges/pair-target-sum/run', 'POST', { language: 'javascript', sourceCode: '   ' }, cookie);
check('empty code -> 400', empty.status === 400 && empty.json.error === 'empty_code');
const tooLong = await call('/api/challenges/pair-target-sum/run', 'POST', { language: 'javascript', sourceCode: 'x'.repeat(50001) }, cookie);
check('oversized code -> 400', tooLong.status === 400 && tooLong.json.error === 'code_too_long');
const noauthRun = await call('/api/challenges/pair-target-sum/run', 'POST', { language: 'javascript', sourceCode: 'x' });
check('run without cookie -> 401', noauthRun.status === 401);

console.log('\n-- rate limit (20 per user per 5 min; compile-error runs are fast) --');
let sawLimit = false;
let limitAt = -1;
for (let i = 1; i <= 21; i++) {
  const r = await call('/api/challenges/rotate-array/run', 'POST', { language: 'python', sourceCode: 'def oops(:' }, cookie);
  if (r.status === 429) {
    sawLimit = true;
    limitAt = i;
    break;
  }
  process.stdout.write(`.`);
}
console.log('');
check('21st submission in window -> 429', sawLimit, `429 first seen at call ${limitAt}`);

console.log('\n-- cleanup --');
await cleanupUser();
await db.update(challenges).set({ isPublished: false });
check('cleanup: no challenges published', (await db.select().from(challenges).where(eq(challenges.isPublished, true))).length === 0);
check('cleanup: test user deleted', (await db.select().from(users).where(eq(users.email, EMAIL))).length === 0);

console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
