import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { challengeVersions, challenges, submissions } from '../db/schema.js';

/**
 * Practice-mode data access (docs/features/F04-practice-mode.md).
 */

/** The exact jsonb shape stored per challenge version. The judge calls the player's function with `args`. */
export type TestCase = { args: unknown[]; expected: string; hidden: boolean };

/**
 * THE single hidden-test filter. Everything serialized to a player goes
 * through here — the detail page and Run both use it. Hidden tests never
 * leave the server (risk-register rule): the browser only ever learns
 * pass/fail for them, from a Submit result that was redacted below.
 */
export function visibleTests(tests: unknown): TestCase[] {
  if (!Array.isArray(tests)) return [];
  return (tests as TestCase[]).filter((t) => Array.isArray(t.args) && typeof t.expected === 'string' && !t.hidden);
}

/**
 * Redact per-test results before they are stored or sent: hidden tests keep
 * only pass/fail (+ the player's own stderr — it is their program's output,
 * never the expected answer). Visible tests keep the call arguments, the
 * frozen expected JSON, and what the player's function returned.
 */
export function redactResults(
  results: Array<{ pass: boolean; status: string; hidden: boolean; args?: unknown[]; expected?: string; stdout?: string; stderr?: string }>,
): Array<{ pass: boolean; status: string; hidden: boolean }> {
  return results.map((r) =>
    r.hidden
      ? { pass: r.pass, status: r.status, hidden: true, ...(r.stderr ? { stderr: r.stderr } : {}) }
      : {
          pass: r.pass,
          status: r.status,
          hidden: false,
          args: JSON.stringify(r.args ?? []),
          expected: r.expected ?? '',
          stdout: r.stdout ?? '',
          ...(r.stderr ? { stderr: r.stderr } : {}),
        },
  );
}

type ChallengeRow = typeof challenges.$inferSelect;
type VersionRow = typeof challengeVersions.$inferSelect;

/** Challenge + its current version. 404 semantics live in the route. */
export async function getChallengeWithVersion(
  db: Database,
  slug: string,
): Promise<{ challenge: ChallengeRow; version: VersionRow } | null> {
  const rows = await db
    .select({ challenge: challenges, version: challengeVersions })
    .from(challenges)
    .innerJoin(
      challengeVersions,
      and(
        eq(challengeVersions.challengeId, challenges.id),
        eq(challengeVersions.version, challenges.currentVersion),
      ),
    )
    .where(eq(challenges.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

/** List published challenges with the player's own submit-derived state. */
export async function listForPlayer(db: Database, userId: string) {
  const rows = await db
    .select({
      slug: challenges.slug,
      title: challenges.title,
      difficulty: challenges.difficulty,
      tags: challenges.tags,
      attempts: sql<number>`count(${submissions.id})::int`,
      solved: sql<boolean>`bool_or(${submissions.status} = 'accepted')`,
    })
    .from(challenges)
    .leftJoin(
      submissions,
      and(
        eq(submissions.challengeId, challenges.id),
        eq(submissions.userId, userId),
        eq(submissions.kind, 'submit'),
      ),
    )
    .where(eq(challenges.isPublished, true))
    .groupBy(challenges.id)
    .orderBy(asc(challenges.createdAt));
  return rows.map((r) => ({ ...r, solved: r.solved ?? false }));
}

/** Save one Submit. */
export async function saveSubmission(db: Database, row: typeof submissions.$inferInsert) {
  const [saved] = await db.insert(submissions).values(row).returning({ id: submissions.id });
  return saved;
}

/** The player's own recent submissions for one challenge. */
export async function listOwnSubmissions(db: Database, userId: string, challengeId: string) {
  return db
    .select({
      id: submissions.id,
      kind: submissions.kind,
      language: submissions.language,
      status: submissions.status,
      passed: submissions.passed,
      total: submissions.total,
      createdAt: submissions.createdAt,
    })
    .from(submissions)
    .where(and(eq(submissions.userId, userId), eq(submissions.challengeId, challengeId)))
    .orderBy(desc(submissions.createdAt))
    .limit(20);
}
