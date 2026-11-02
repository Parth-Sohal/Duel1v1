/**
 * F04 seed loader: takes the CHALLENGES definitions from seed-data.ts, FREEZES
 * the expected answers by running each reference solution (JavaScript AND
 * Python) through Judge0 with the real function-call harness, verifies both
 * languages agree, then inserts into the DB as UNPUBLISHED (owner signs off
 * before we publish).
 *
 * Safe to re-run at any time: slugs already in the DB are skipped untouched
 * (published challenges have real player submissions — deleting them would
 * cascade those rows away). Only NEW slugs are frozen + inserted.
 *
 * The player writes a FUNCTION and returns the answer; the server wraps their
 * code so the judge calls it with the test's arguments (JSON on stdin) and
 * compares the returned value. Expected outputs are never hand-typed —
 * "correct" is whatever a working reference function actually returns.
 * Run with: npx tsx scripts/f04-seed-challenges.ts
 */
import 'dotenv/config';
import { inArray } from 'drizzle-orm';
import { createDb } from '../src/db/index.js';
import { challengeVersions, challenges } from '../src/db/schema.js';
import { answerOf, composeSource, runOnce } from '../src/services/judge.js';
import { CHALLENGES, type SeedChallenge, type SeedTest } from './seed-data.js';

/** Worker-pool map with bounded concurrency (Judge0 public endpoint allows a few req/s per IP). */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const db = createDb(process.env.DATABASE_URL!).db;

type Frozen = SeedChallenge & { tests: Array<SeedTest & { expected: string }> };

/**
 * Authoring-time judge run: the shared public endpoint intermittently fails
 * (transient network errors, CPU spikes on a loaded box), so authoring runs
 * get a generous 10 s CPU budget and up to 3 attempts. Player runs do NOT
 * get this - the route uses runOnce with the challenge's real limits.
 */
async function authoringRun(opts: { language: 'javascript' | 'python'; sourceCode: string; stdin: string }) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    last = await runOnce({ ...opts, timeLimitMs: 10_000 });
    if (last.status === 'accepted') return last;
    await new Promise((r) => setTimeout(r, attempt * 1500));
  }
  return last!;
}

async function freezeAndVerify(list: SeedChallenge[]): Promise<Frozen[]> {
  type Task = { c: number; t: number; lang: 'javascript' | 'python'; source: string; stdin: string };
  const tasks: Task[] = [];
  list.forEach((c, ci) =>
    c.tests.forEach((t, ti) => {
      const stdin = JSON.stringify(t.args);
      tasks.push({ c: ci, t: ti, lang: 'javascript', source: composeSource('javascript', c.reference.javascript, c.entryFunctions.javascript), stdin });
      tasks.push({ c: ci, t: ti, lang: 'python', source: composeSource('python', c.reference.python, c.entryFunctions.python), stdin });
    }),
  );

  console.log(`judging ${tasks.length} reference runs through ${process.env.JUDGE0_API_URL ?? 'https://ce.judge0.com'} ...`);
  const runs = await mapPool(tasks, 2, (task) => authoringRun({ language: task.lang, sourceCode: task.source, stdin: task.stdin }));

  const expected = list.map(() => new Map<number, string>());
  let fails = 0;
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const run = runs[i];
    const label = `${list[task.c].slug} #${task.t + 1} ${task.lang}`;
    if (run.status !== 'accepted') {
      console.log(`FAIL ${label}: status=${run.status} stderr=${run.stderr.slice(0, 120)} compile=${run.compileOutput.slice(0, 120)}`);
      fails++;
      continue;
    }
    const answer = answerOf(run.stdout);
    const seen = expected[task.c].get(task.t);
    if (seen === undefined) {
      expected[task.c].set(task.t, answer);
    } else if (seen !== answer) {
      console.log(`FAIL ${label}: JS and Python disagree\n  js:     ${JSON.stringify(seen)}\n  python: ${JSON.stringify(answer)}`);
      fails++;
    }
  }
  if (fails > 0) {
    throw new Error(`${fails} reference run(s) failed or disagreed - nothing inserted`);
  }

  return list.map((c, ci) => ({
    ...c,
    tests: c.tests.map((t, ti) => ({ ...t, expected: expected[ci].get(ti)! })),
  }));
}

async function insert(frozen: Frozen[]): Promise<void> {
  // Slugs already in the DB are untouched: published challenges carry real
  // player submissions, and deleting them would cascade those rows away.
  // Editing an EXISTING challenge is a manual, owner-approved act (new
  // version row), never a re-run of this loader.
  const existing = await db
    .select({ slug: challenges.slug })
    .from(challenges)
    .where(inArray(challenges.slug, frozen.map((c) => c.slug)));
  const have = new Set(existing.map((r) => r.slug));
  const fresh = frozen.filter((c) => !have.has(c.slug));
  if (fresh.length === 0) {
    console.log('nothing to insert - all seed slugs already exist (untouched)');
    return;
  }
  await db.transaction(async (tx) => {
    for (const c of fresh) {
      const [row] = await tx
        .insert(challenges)
        .values({
          slug: c.slug,
          title: c.title,
          difficulty: c.difficulty,
          tags: c.tags,
          currentVersion: 1,
          isPublished: false, // unpublished until the owner signs off
        })
        .returning();
      await tx.insert(challengeVersions).values({
        challengeId: row.id,
        version: 1,
        statement: c.statement,
        entryFunctions: c.entryFunctions,
        starterCode: c.starterCode,
        timeLimitMs: 5000, // JS base; the judge applies the Python multiplier
        memoryLimitMb: 256,
        tests: c.tests.map((t) => ({ args: t.args, expected: t.expected, hidden: t.hidden })),
      });
    }
  });
  console.log(`inserted ${fresh.length} new challenge(s); skipped ${frozen.length - fresh.length} existing`);
}

function reviewTable(frozen: Frozen[]): void {
  for (const c of frozen) {
    console.log(`\n=== ${c.slug} (${c.difficulty}, ${c.tags.join(', ')}) ===`);
    console.log(c.statement);
    for (const [i, t] of c.tests.entries()) {
      const argsPrev = JSON.stringify(t.args);
      console.log(`  test ${i + 1} [${t.hidden ? 'HIDDEN' : 'visible'}]`);
      console.log(`    args:     ${argsPrev.length > 70 ? argsPrev.slice(0, 67) + '...' : argsPrev}`);
      console.log(`    expected: ${JSON.stringify(t.expected.length > 60 ? t.expected.slice(0, 57) + '...' : t.expected)}`);
    }
  }
}

// Only JUDGE challenges that are not in the DB yet - re-running the loader
// must never re-burn hundreds of judge calls on slugs it is going to skip.
const alreadyHere = await db.select({ slug: challenges.slug }).from(challenges);
const have = new Set(alreadyHere.map((r) => r.slug));
const toFreeze = CHALLENGES.filter((c) => !have.has(c.slug));
if (toFreeze.length < CHALLENGES.length) {
  console.log(`${have.size} slug(s) already in the DB - skipped untouched; freezing ${toFreeze.length} new`);
}

const frozen = await freezeAndVerify(toFreeze);
await insert(frozen);
reviewTable(frozen);
console.log(`\ninserted ${frozen.length} challenges (is_published=false) - awaiting owner sign-off`);
process.exit(0);
