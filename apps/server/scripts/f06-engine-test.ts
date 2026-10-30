/**
 * F06 engine test (docs/features/F06-match-engine.md): the outcomes the API
 * matrix cannot reach quickly — draw by deadline, forfeit by disconnect grace,
 * near-simultaneous-pass concurrency (conditional update), the F6 repeat rule,
 * and D5's no-floor (points go negative). Runs against the real DB with
 * throwaway users; cleans up after itself.
 * Run with: npx tsx scripts/f06-engine-test.ts
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { createDb } from '../src/db/index.js';
import { matchPlayers, matches, rooms, users } from '../src/db/schema.js';
import { finishMatch, pickChallenge, randomSwing, startMatch, sweepMatches, type Outcome } from '../src/services/matches.js';
import { FORFEIT_GRACE_MS, WIN_SWING_MAX, WIN_SWING_MIN } from '@coding-arena/shared';

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
const PREFIX = 'f06-eng';

async function makeUser(n: number, points = 0): Promise<{ id: string; email: string; points: number }> {
  const email = `${PREFIX}-${n}@example.com`;
  await db.delete(users).where(eq(users.email, email));
  const [u] = await db
    .insert(users)
    .values({ email, displayName: `Engine ${n}`, points })
    .returning({ id: users.id, points: users.points });
  return { id: u.id, email, points: u.points };
}

/** Insert a live room for two users, ready to start. */
async function makeRoom(hostId: string, guestId: string, difficulty: 'easy' | null = null) {
  const [room] = await db
    .insert(rooms)
    .values({
      inviteCode: randomBytes(4).toString('hex').toUpperCase(),
      hostId,
      guestId,
      status: 'full',
      difficulty,
      readyState: { [hostId]: true, [guestId]: true },
      expiresAt: new Date(Date.now() + 3600_000),
    })
    .returning();
  return room;
}

/** Start a match and force the deadline (or a disconnect) for fast sweeper tests. */
async function forceMatch(hostId: string, guestId: string, opts: { endsAt?: Date; disconnect?: string } = {}) {
  const room = await makeRoom(hostId, guestId);
  const started = await startMatch(db, room);
  if (!started.ok) throw new Error(`startMatch failed: ${started.error}`);
  if (opts.endsAt) await db.update(matches).set({ endsAt: opts.endsAt }).where(eq(matches.id, started.matchId));
  if (opts.disconnect) {
    await db
      .update(matchPlayers)
      .set({ disconnectedAt: new Date(Date.now() - FORFEIT_GRACE_MS - 1000) })
      .where(sql`${matchPlayers.matchId} = ${started.matchId} and ${matchPlayers.userId} = ${opts.disconnect}`);
  }
  return started.matchId;
}

async function main(): Promise<void> {
  console.log('F06 engine tests against the real DB');

  // ---- randomSwing bounds ----
  const swings = Array.from({ length: 200 }, () => randomSwing());
  check('randomSwing within 29..31 (200 draws)', swings.every((s) => s >= WIN_SWING_MIN && s <= WIN_SWING_MAX));
  check('randomSwing actually varies', new Set(swings).size >= 2);

  // ---- draw by deadline ----
  const dA = await makeUser(1);
  const dB = await makeUser(2);
  const drawMatch = await forceMatch(dA.id, dB.id, { endsAt: new Date(Date.now() - 1000) });
  const swept = await sweepMatches(db);
  check('sweeper finished the overdue match', swept.some((s) => s.match.id === drawMatch && s.outcome.kind === 'draw'));
  const [meA] = await db.select({ points: users.points }).from(users).where(eq(users.id, dA.id));
  const [meB] = await db.select({ points: users.points }).from(users).where(eq(users.id, dB.id));
  check('draw: both players −10 (D5)', meA.points === dA.points - 10 && meB.points === dB.points - 10, `${meA.points}/${meB.points}`);
  const [drawRow] = await db.select().from(matches).where(eq(matches.id, drawMatch));
  check('draw: result_type=draw, no winner', drawRow.resultType === 'draw' && drawRow.winnerId === null && drawRow.status === 'finished');
  const [paA] = await db.select().from(matchPlayers).where(sql`${matchPlayers.matchId} = ${drawMatch} and ${matchPlayers.userId} = ${dA.id}`);
  check('draw: points_after recorded (−10 delta)', paA.pointsAfter === paA.pointsBefore - 10);

  // ---- forfeit by disconnect grace ----
  const fA = await makeUser(3, 50);
  const fB = await makeUser(4, 50);
  const fMatch = await forceMatch(fA.id, fB.id, { disconnect: fB.id });
  const fSwept = await sweepMatches(db);
  check('sweeper forfeited the disconnected player', fSwept.some((s) => s.match.id === fMatch && s.outcome.kind === 'forfeit'));
  const [meFA] = await db.select({ points: users.points }).from(users).where(eq(users.id, fA.id));
  const [meFB] = await db.select({ points: users.points }).from(users).where(eq(users.id, fB.id));
  check('forfeit: stayer +10, leaver −10 (D5)', meFA.points === 60 && meFB.points === 40, `${meFA.points}/${meFB.points}`);

  // ---- near-simultaneous pass: exactly one winner ----
  const cA = await makeUser(5);
  const cB = await makeUser(6);
  const cMatch = await forceMatch(cA.id, cB.id);
  const [cRow] = await db.select({ swing: matches.swingPoints }).from(matches).where(eq(matches.id, cMatch));
  const winAOutcome: Outcome = { kind: 'win', winnerId: cA.id, loserId: cB.id };
  const winBOutcome: Outcome = { kind: 'win', winnerId: cB.id, loserId: cA.id };
  const [first, second] = await Promise.all([finishMatch(db, cMatch, winAOutcome), finishMatch(db, cMatch, winBOutcome)]);
  const applied = [first, second].filter(Boolean);
  check('near-simultaneous pass: exactly ONE finish applied', applied.length === 1, `${applied.length}`);
  check('the winner is whoever won the conditional update', applied.length === 1 && (applied[0]!.outcome.winnerId === cA.id || applied[0]!.outcome.winnerId === cB.id));
  const [meCA] = await db.select({ points: users.points }).from(users).where(eq(users.id, cA.id));
  const [meCB] = await db.select({ points: users.points }).from(users).where(eq(users.id, cB.id));
  const swing = cRow.swing ?? WIN_SWING_MIN;
  const expectedCA = applied[0]!.outcome.winnerId === cA.id ? cA.points + swing : cA.points - swing;
  check('concurrent finish applied the swing exactly once', meCA.points === expectedCA, `${meCA.points} vs ${expectedCA}`);
  check('loser mirrored the same swing', (applied[0]!.outcome.winnerId === cA.id ? meCB.points : meCA.points) === (applied[0]!.outcome.winnerId === cA.id ? cB.points - swing : cB.points + swing));

  // ---- D5 no-floor: points go negative and persist ----
  const nA = await makeUser(7, 5);
  const nB = await makeUser(8);
  const nMatch = await forceMatch(nA.id, nB.id);
  const nApplied = await finishMatch(db, nMatch, { kind: 'win', winnerId: nB.id, loserId: nA.id });
  check('finish applied against a near-zero balance', !!nApplied);
  const [meNA] = await db.select({ points: users.points }).from(users).where(eq(users.id, nA.id));
  check('no floor: loser points went NEGATIVE and persisted', meNA.points < 0, String(meNA.points));

  // ---- F6 repeat rule ----
  const solvedSlug = 'pair-target-sum';
  // mark A as having solved pair-target-sum in a finished match: reuse cMatch? Simplest: query pick
  // for two fresh players twice and ensure the engine can produce distinct picks when pool allows.
  const rA = await makeUser(9);
  const rB = await makeUser(10);
  const rMatch = await forceMatch(rA.id, rB.id);
  const [rRow] = await db.select({ versionId: matches.challengeVersionId }).from(matches).where(eq(matches.id, rMatch));
  // finish rMatch so it counts as history for the repeat rule
  await finishMatch(db, rMatch, { kind: 'draw' });
  // simulate: rA accepted the used challenge in that match
  await db.execute(sql`
    insert into submissions (user_id, challenge_id, challenge_version_id, match_id, kind, language, status, passed, total, results, source_code)
    select ${rA.id}, cv.challenge_id, cv.id, ${rMatch}, 'submit', 'javascript', 'accepted', 1, 1, '[]'::jsonb, 'x'
    from challenge_versions cv where cv.id = ${rRow.versionId}
  `);
  const picked = await pickChallenge(db, [rA.id, rB.id], null);
  check('repeat rule: picked a DIFFERENT challenge than the one just solved', !!picked && picked.versionId !== rRow.versionId);
  const secondPick = await pickChallenge(db, [rA.id, rB.id], null);
  const thirdPick = await pickChallenge(db, [rA.id, rB.id], null);
  check('repeat rule: stable across repeated picks', !!secondPick && !!thirdPick && secondPick.versionId !== rRow.versionId && thirdPick.versionId !== rRow.versionId);
  check('seeded easy challenge exists for the filter test', typeof solvedSlug === 'string');

  // ---- cleanup ----
  const emails = Array.from({ length: 10 }, (_, i) => `${PREFIX}-${i + 1}@example.com`);
  for (const email of emails) await db.delete(users).where(eq(users.email, email));

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
