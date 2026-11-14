/**
 * F12 version upgrade (docs/features/F12-more-languages.md): give every
 * published challenge a NEW immutable version carrying all four languages
 * (JavaScript, Python, Java, C++), then repoint `challenges.current_version`.
 *
 * Why a new version: challenge versions are immutable and submissions (and
 * live matches) reference a version id. Mutating v1 would rewrite history and
 * could change the meaning of an in-flight duel. v2 keeps the exact same
 * statement, tests and frozen expected answers and only adds the language
 * maps, so every existing submission stays valid.
 *
 * Idempotent: if the latest version already has Java + C++, it only repairs
 * `current_version` if needed. Default is a dry run; pass --apply to write.
 *
 * Run: npx tsx scripts/f12-upgrade-versions.ts [--apply]
 */
import 'dotenv/config';
import { desc, eq } from 'drizzle-orm';
import { createDb } from '../src/db/index.js';
import { challengeVersions, challenges } from '../src/db/schema.js';
import { CHALLENGES } from './seed-data.js';

const apply = process.argv.includes('--apply');
const slugFilter = process.env.F12_SLUG?.trim() || null;
const db = createDb(process.env.DATABASE_URL!).db;

function hasStaticLanguages(entryFunctions: unknown, starterCode: unknown): boolean {
  const entries = (entryFunctions ?? {}) as Record<string, unknown>;
  const starters = (starterCode ?? {}) as Record<string, unknown>;
  const typed = (v: unknown): boolean => {
    if (!v || typeof v !== 'object') return false;
    const s = v as Record<string, unknown>;
    return typeof s.name === 'string' && Array.isArray(s.params) && typeof s.returns === 'string';
  };
  return typed(entries.java) && typed(entries.cpp) && typeof starters.java === 'string' && typeof starters.cpp === 'string';
}

async function main(): Promise<void> {
  const seeds = CHALLENGES.filter((c) => !slugFilter || c.slug === slugFilter);
  console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${seeds.length} challenge(s)`);

  // Batch the reads: a per-challenge query pair over a remote DB makes even a
  // dry run take minutes.
  const rows = await db
    .select({ id: challenges.id, slug: challenges.slug, currentVersion: challenges.currentVersion })
    .from(challenges);
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const versionRows = await db
    .select()
    .from(challengeVersions)
    .orderBy(desc(challengeVersions.version));
  const latestByChallenge = new Map<string, (typeof versionRows)[number]>();
  for (const row of versionRows) {
    if (!latestByChallenge.has(row.challengeId)) latestByChallenge.set(row.challengeId, row);
  }

  let planned = 0;
  let skipped = 0;
  let missing = 0;
  let repaired = 0;

  for (const seed of seeds) {
    const challenge = bySlug.get(seed.slug);
    if (!challenge) {
      console.log(`SKIP ${seed.slug}: not in DB`);
      missing++;
      continue;
    }

    const latest = latestByChallenge.get(challenge.id);
    if (!latest) {
      console.log(`SKIP ${seed.slug}: no version row`);
      missing++;
      continue;
    }

    if (hasStaticLanguages(latest.entryFunctions, latest.starterCode)) {
      if (challenge.currentVersion !== latest.version) {
        console.log(`REPAIR ${seed.slug}: current_version ${challenge.currentVersion} -> v${latest.version}`);
        if (apply) {
          await db
            .update(challenges)
            .set({ currentVersion: latest.version, updatedAt: new Date() })
            .where(eq(challenges.id, challenge.id));
        }
        repaired++;
      } else {
        skipped++;
      }
      continue;
    }

    const nextVersion = latest.version + 1;
    const tests = latest.tests as Array<{ args: unknown[]; expected: string; hidden: boolean }>;
    const entryFunctions = {
      ...(latest.entryFunctions as Record<string, unknown>),
      java: seed.entryFunctions.java,
      cpp: seed.entryFunctions.cpp,
    };
    const starterCode = {
      ...(latest.starterCode as Record<string, unknown>),
      java: seed.starterCode.java,
      cpp: seed.starterCode.cpp,
    };

    console.log(
      `ADD ${seed.slug}: v${latest.version} -> v${nextVersion} (${tests.length} tests preserved)`,
    );
    planned++;

    if (!apply) continue;
    await db.transaction(async (tx) => {
      await tx.insert(challengeVersions).values({
        challengeId: challenge.id,
        version: nextVersion,
        statement: latest.statement,
        entryFunctions,
        starterCode,
        timeLimitMs: latest.timeLimitMs,
        memoryLimitMb: latest.memoryLimitMb,
        tests,
      });
      await tx
        .update(challenges)
        .set({ currentVersion: nextVersion, updatedAt: new Date() })
        .where(eq(challenges.id, challenge.id));
    });
  }

  console.log(
    `\nRESULT: ${planned} version(s) ${apply ? 'created' : 'planned'}, ${repaired} pointer repair(s), ${skipped} already current, ${missing} missing`,
  );
  if (!apply && planned > 0) console.log('Dry run only. Re-run with --apply to write.');
  process.exit(missing === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
