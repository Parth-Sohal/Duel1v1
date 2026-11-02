/**
 * Owner review artifact for the pool-2 sign-off (2026-11-02): renders every
 * UNPUBLISHED challenge straight from the DB (the frozen version rows, not
 * the seed file) into docs/reports/challenge-pool2-review.md — statement,
 * entry functions, and every test with its FROZEN expected answer so the
 * owner can hand-check the math before publishing.
 * Run with: npx tsx scripts/review-pool2.ts
 */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { writeFileSync } from 'node:fs';
import { createDb } from '../src/db/index.js';
import { challengeVersions, challenges } from '../src/db/schema.js';

const db = createDb(process.env.DATABASE_URL!).db;

/** Shorten huge values for print; note the true size instead of dumping it. */
function brief(value: unknown): string {
  const json = JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) {
    if (value.length > 12) {
      const head = JSON.stringify(value.slice(0, 12)).slice(1, -1);
      return `[${head}, … (${value.length} items)]`;
    }
  }
  if (typeof value === 'string' && value.length > 90) {
    return `${JSON.stringify(value.slice(0, 90))}… (${value.length} chars)`;
  }
  return json.length > 140 ? `${json.slice(0, 140)}… (${json.length} chars)` : json;
}

const rows = await db
  .select({
    slug: challenges.slug,
    title: challenges.title,
    difficulty: challenges.difficulty,
    tags: challenges.tags,
    version: challengeVersions.version,
    statement: challengeVersions.statement,
    entryFunctions: challengeVersions.entryFunctions,
    starterCode: challengeVersions.starterCode,
    timeLimitMs: challengeVersions.timeLimitMs,
    tests: challengeVersions.tests,
  })
  .from(challenges)
  .innerJoin(challengeVersions, eq(challengeVersions.challengeId, challenges.id))
  .where(eq(challenges.isPublished, false))
  .orderBy(challenges.slug);

const byDifficulty = (d: string) => rows.filter((r) => r.difficulty === d);
const counts = `easy ${byDifficulty('easy').length} / medium ${byDifficulty('medium').length} / hard ${byDifficulty('hard').length}`;

const out: string[] = [
  '# Challenge pool 2 — owner review (unpublished, frozen)',
  '',
  `Generated from the DB (challenge_versions), not the seed file. ${rows.length} challenges (${counts}).`,
  'Every `expected` below is what the reference solution ACTUALLY returned through Judge0 —',
  'JavaScript and Python agreed byte-for-byte on all of these. Hidden tests are marked;',
  'their values are shown ONLY in this document and are never sent to players.',
  '',
  '| slug | difficulty | tags | entry (js / py) | tests |',
  '|---|---|---|---|---|',
  ...rows.map(
    (r) =>
      `| ${r.slug} | ${r.difficulty} | ${r.tags.join(', ')} | ${r.entryFunctions.javascript} / ${r.entryFunctions.python} | ${r.tests.length} |`,
  ),
  '',
];

for (const r of rows) {
  out.push(`---`, '', `## ${r.slug} — ${r.title}`, '');
  out.push(`**difficulty:** ${r.difficulty} · **tags:** ${r.tags.join(', ')} · **time limit:** ${r.timeLimitMs} ms`);
  out.push('');
  out.push('```');
  out.push(r.statement.trim());
  out.push('```');
  out.push('');
  out.push('**Tests (args → frozen expected):**');
  out.push('');
  r.tests.forEach((t, i) => {
    const hidden = t.hidden ? ' HIDDEN' : '';
    out.push(`- #${i + 1}${hidden} \`${brief(t.args)}\` → \`${brief(t.expected)}\``);
  });
  out.push('');
  out.push('<details><summary>starter code (javascript)</summary>');
  out.push('');
  out.push('```js');
  out.push(r.starterCode.javascript.trim());
  out.push('```');
  out.push('');
  out.push('</details>');
  out.push('');
}

const file = '../../../docs/reports/challenge-pool2-review.md';
writeFileSync(new URL(file, import.meta.url), out.join('\n'), 'utf8');
console.log(`wrote docs/reports/challenge-pool2-review.md — ${rows.length} challenges, ${rows.reduce((n, r) => n + r.tests.length, 0)} tests`);
process.exit(0);
