/**
 * F12 gate (docs/features/F12-more-languages.md): judge every published
 * challenge's Java and C++ reference solution through the REAL Judge0 over
 * ALL stored tests, and require the answer to equal the version's frozen
 * `expected` jsonb. JS/Python are covered by challenge-verify.ts; this gate
 * adds the two static languages.
 *
 * Filters (useful while authoring):
 *   F12_LANGS=java|cpp|java,cpp   default java,cpp
 *   F12_SLUG=pair-target-sum      one challenge only
 *
 * Run with: npx tsx scripts/f12-verify.ts
 */
import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { createDb } from '../src/db/index.js';
import { challengeVersions, challenges } from '../src/db/schema.js';
import { answerOf, composeSource, runOnce } from '../src/services/judge.js';
import { CHALLENGES } from './seed-data.js';
import type { Language } from '@coding-arena/shared';

const requested = (process.env.F12_LANGS ?? 'java,cpp')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean) as Language[];
const languages = requested.filter((l) => l === 'java' || l === 'cpp');
if (languages.length === 0) {
  console.error('F12_LANGS must contain java and/or cpp');
  process.exit(1);
}
const slugFilter = process.env.F12_SLUG?.trim() || null;

/** Authoring-style run: generous budget, up to 3 attempts on the flaky endpoint. */
async function authoringRun(opts: { language: Language; sourceCode: string; stdin: string }) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    last = await runOnce({ ...opts, timeLimitMs: 15_000 });
    if (last.status === 'accepted') return last;
    await new Promise((r) => setTimeout(r, attempt * 1200));
  }
  return last!;
}

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

  const seeds = new Map(CHALLENGES.map((c) => [c.slug, c]));
  const targets = slugFilter ? published.filter((p) => p.slug === slugFilter) : published;
  console.log(
    `F12 gate: ${targets.length} published challenge(s) × ${languages.join(' + ')} through the real judge`,
  );

  let failedChallenges = 0;
  let calls = 0;

  for (const pub of targets) {
    const label = `${pub.slug} v${pub.version}`;
    const seed = seeds.get(pub.slug);
    if (!seed) {
      console.log(`FAIL ${label}: no seed reference`);
      failedChallenges++;
      continue;
    }

    const [row] = await db
      .select({ tests: challengeVersions.tests })
      .from(challengeVersions)
      .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
      .where(and(eq(challenges.slug, pub.slug), eq(challengeVersions.version, pub.version)))
      .limit(1);
    const tests = (row?.tests ?? []) as Array<{ args: unknown[]; expected: string; hidden: boolean }>;
    if (tests.length === 0) {
      console.log(`FAIL ${label}: no tests`);
      failedChallenges++;
      continue;
    }

    type Task = { lang: Language; i: number; args: unknown[]; expected: string };
    const tasks: Task[] = tests.flatMap((t, i) =>
      languages.map((lang) => ({ lang, i, args: t.args, expected: t.expected })),
    );
    const runs = await mapPool(tasks, 3, (t) =>
      authoringRun({
        language: t.lang,
        sourceCode: composeSource(t.lang, seed.reference[t.lang]!, seed.entryFunctions[t.lang]!),
        stdin: JSON.stringify(t.args),
      }),
    );
    calls += tasks.length;

    let bad = 0;
    runs.forEach((run, k) => {
      const task = tasks[k];
      if (run.status !== 'accepted') {
        console.log(
          `FAIL ${label} #${task.i + 1} ${task.lang}: status=${run.status} compile=${run.compileOutput.slice(0, 300)} stderr=${run.stderr.slice(0, 200)}`,
        );
        bad++;
        return;
      }
      const answer = answerOf(run.stdout);
      if (answer !== task.expected) {
        console.log(
          `FAIL ${label} #${task.i + 1} ${task.lang}: returned ${JSON.stringify(answer.slice(0, 120))}, froze ${JSON.stringify(task.expected.slice(0, 120))}`,
        );
        bad++;
      }
    });

    if (bad === 0) {
      console.log(`PASS ${label} — ${tests.length} tests × ${languages.length} language(s)`);
    } else {
      failedChallenges++;
    }
  }

  console.log(
    `\nRESULT: ${targets.length - failedChallenges}/${targets.length} challenge(s) verified in ${languages.join(', ')} (${calls} judge calls)`,
  );
  process.exit(failedChallenges === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
