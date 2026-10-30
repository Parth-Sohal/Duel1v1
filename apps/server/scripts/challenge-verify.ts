/**
 * F09 pool gate (docs/features/F09-daily-challenge.md): run every PUBLISHED
 * version's reference solution through the REAL Judge0 over ALL of its tests,
 * and require the answer to equal the version's frozen `expected` jsonb. A
 * challenge that does not pass does not count toward the pool.
 *
 * References live in seed-data.ts (the DB stores no reference solutions).
 * A published slug missing from seed-data.ts FAILS — the seed file is the
 * single source of truth for what "a working reference" is.
 * Run with: npx tsx scripts/challenge-verify.ts
 */
import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { createDb } from '../src/db/index.js';
import { challengeVersions, challenges } from '../src/db/schema.js';
import { answerOf, composeSource, runOnce } from '../src/services/judge.js';
import { CHALLENGES, type SeedChallenge } from './seed-data.js';

/**
 * Authoring-style run: generous CPU budget, up to 3 attempts at the flaky
 * public endpoint.
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

/** Worker-pool map with bounded concurrency (public Judge0 allows a few req/s per IP). */
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

async function main(): Promise<void> {
  const published = await db
    .select({ slug: challenges.slug, title: challenges.title, version: challenges.currentVersion })
    .from(challenges)
    .where(eq(challenges.isPublished, true))
    .orderBy(challenges.slug);

  console.log(`published pool: ${published.length} challenge(s) — verifying references through the real judge`);

  const bySlug = new Map<string, SeedChallenge>(CHALLENGES.map((c) => [c.slug, c]));
  let poolFailures = 0;

  for (const pub of published) {
    const label = `${pub.slug} v${pub.version}`;
    const seed = bySlug.get(pub.slug);
    if (!seed) {
      console.log(`FAIL ${label}: no reference in seed-data.ts — author it there first`);
      poolFailures++;
      continue;
    }

    const [row] = await db
      .select({ statement: challengeVersions.statement, tests: challengeVersions.tests })
      .from(challengeVersions)
      .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
      .where(and(eq(challenges.slug, pub.slug), eq(challengeVersions.version, pub.version)))
      .limit(1);
    if (!row) {
      console.log(`FAIL ${label}: version row missing`);
      poolFailures++;
      continue;
    }

    const tests = row.tests as Array<{ args: unknown[]; expected: string; hidden: boolean }>;

    type Task = { lang: 'javascript' | 'python'; i: number; args: unknown[] };
    const tasks: Task[] = tests.flatMap((t, i) => [
      { lang: 'javascript' as const, i, args: t.args },
      { lang: 'python' as const, i, args: t.args },
    ]);
    const runs = await mapPool(tasks, 2, (t) =>
      authoringRun({
        language: t.lang,
        sourceCode: composeSource(t.lang, seed.reference[t.lang], seed.entryFunctions[t.lang]),
        stdin: JSON.stringify(t.args),
      }),
    );

    let bad = 0;
    runs.forEach((res, k) => {
      const { lang, i } = tasks[k];
      const expected = tests[i]?.expected;
      if (res.status !== 'accepted') {
        console.log(`FAIL ${label} #${i + 1} ${lang}: judge status=${res.status}`);
        bad++;
        return;
      }
      const answer = answerOf(res.stdout);
      if (answer !== expected) {
        console.log(`FAIL ${label} #${i + 1} ${lang}: reference returned ${JSON.stringify(answer)}, DB froze ${JSON.stringify(expected)}`);
        bad++;
      }
    });

    if (bad === 0) {
      console.log(`PASS ${label} — ${tests.length} tests × 2 languages, all match the frozen answers`);
    } else {
      poolFailures++;
    }
  }

  console.log(`\nRESULT: ${published.length - poolFailures}/${published.length} published version(s) verified`);
  process.exit(poolFailures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
