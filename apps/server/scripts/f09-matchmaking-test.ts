/**
 * F09 gate (docs/features/F09-matchmaking-leaderboard.md): queue pairing,
 * no self-pair, difficulty compatibility, stale pruning, repeated-challenge
 * avoidance, and the leaderboard read model. Runs against the real DB with
 * throwaway users and cleans up after itself.
 * Run with: npx tsx scripts/f09-matchmaking-test.ts
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import {
  LEADERBOARD_TOP_N,
  MATCHMAKING_ENTRY_TTL_MS,
  MATCHMAKING_MATCHED_TTL_MS,
  MATCHMAKING_STALE_MS,
} from '@coding-arena/shared';
import { createDb } from '../src/db/index.js';
import { challengeVersions, challenges, matchPlayers, matches, submissions, users } from '../src/db/schema.js';
import { createQuickMatch, finishMatch } from '../src/services/matches.js';
import { ensureBotUser } from '../src/services/bots.js';
import {
  InMemoryMatchmakingQueue,
  difficultiesCompatible,
  matchmakingQueue,
  resolveDifficulty,
  runMatchmakingTick,
} from '../src/services/matchmaking.js';
import { getLeaderboard } from '../src/services/leaderboard.js';

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
const PREFIX = 'f09-gate';

type MadeUser = {
  id: string;
  email: string;
  displayName: string;
  points: number;
  wins: number;
  losses: number;
  draws: number;
};

async function makeUser(
  tag: string,
  opts: { points?: number; wins?: number; losses?: number; draws?: number; bot?: boolean } = {},
): Promise<MadeUser> {
  const email = `${PREFIX}-${tag}-${randomBytes(3).toString('hex')}@example.com`;
  const [u] = await db
    .insert(users)
    .values({
      email,
      displayName: `${tag} ${randomBytes(2).toString('hex')}`.slice(0, 30),
      points: opts.points ?? 0,
      wins: opts.wins ?? 0,
      losses: opts.losses ?? 0,
      draws: opts.draws ?? 0,
      isBot: opts.bot ?? false,
    })
    .returning({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      points: users.points,
      wins: users.wins,
      losses: users.losses,
      draws: users.draws,
    });
  return u;
}

async function seedFinishedMatch(
  versionId: string,
  aId: string,
  bId: string,
  outcome: { kind: 'win'; winnerId: string } | { kind: 'draw' },
  finishedAt: Date,
): Promise<string> {
  const [match] = await db
    .insert(matches)
    .values({
      challengeVersionId: versionId,
      status: 'finished',
      resultType: outcome.kind === 'draw' ? 'draw' : 'win',
      winnerId: outcome.kind === 'win' ? outcome.winnerId : null,
      swingPoints: 30,
      startedAt: new Date(finishedAt.getTime() - 10 * 60_000),
      endsAt: finishedAt,
      finishedAt,
    })
    .returning({ id: matches.id });
  await db.insert(matchPlayers).values([
    { matchId: match.id, userId: aId, seat: 1, pointsBefore: 0, pointsAfter: 0 },
    { matchId: match.id, userId: bId, seat: 2, pointsBefore: 0, pointsAfter: 0 },
  ]);
  return match.id;
}

async function cleanup(): Promise<void> {
  const emailPattern = `${PREFIX}-%`;
  await db.execute(sql`
    delete from matches
    where id in (
      select mp.match_id
      from match_players mp
      join users u on u.id = mp.user_id
      where u.email like ${emailPattern}
    )
  `);
  await db.execute(sql`delete from users where email like ${emailPattern}`);
}

async function main(): Promise<void> {
  console.log('F09 matchmaking + leaderboard tests against the real DB');

  // A previous failed run may have left rows behind; only this prefix is touched.
  await cleanup();

  // ---------------------------------------------------------------- pure queue
  const q = new InMemoryMatchmakingQueue();
  const qa = 'user-a';
  const qb = 'user-b';
  const qNow = 1_000_000;

  const idle = q.status(qa, qNow);
  check('status starts idle', idle.status === 'idle');

  q.enqueue(qa, null, qNow);
  const lone = q.takePair(qNow);
  check('a lone waiter is never paired with themselves', lone === null);
  check('waiting count excludes the viewer', q.waitingCount(qa, qNow) === 0);

  q.enqueue(qb, 'hard', qNow + 1);
  const paired = q.takePair(qNow + 2);
  check(
    'two strangers are paired oldest-first',
    !!paired && paired[0].userId === qa && paired[1].userId === qb,
  );
  check(
    'pairing window still reports searching (never a false idle)',
    q.status(qa, qNow + 2).status === 'searching' && q.size().pairing === 2,
  );
  check('the exact same entry cannot be paired twice', q.takePair(qNow + 3) === null);
  check('queue is empty after pairing', q.size().waiting === 0);
  if (paired) q.markMatched(paired[0], paired[1], 'match-0', qNow + 3);

  check('ANY pairs with a concrete difficulty', difficultiesCompatible(null, 'hard'));
  check('EASY does not pair with HARD', !difficultiesCompatible('easy', 'hard'));
  check('resolved difficulty uses the concrete side', resolveDifficulty(null, 'hard') === 'hard');

  q.enqueue(qa, null, qNow + 10);
  q.enqueue(qa, 'easy', qNow + 11);
  check('one user holds exactly one queue entry', q.size().waiting === 1);
  const refreshed = q.status(qa, qNow + 12);
  check('re-enqueue refreshes difficulty, not a duplicate', refreshed.status === 'searching' && refreshed.difficulty === 'easy');
  q.cancel(qa);

  q.enqueue(qa, null, qNow + 20);
  q.prune(qNow + 20 + MATCHMAKING_STALE_MS + 1);
  check('stale entries are pruned (closed tab)', q.size().waiting === 0);

  q.enqueue(qa, null, qNow + 30);
  const expired = q.status(qa, qNow + 30 + MATCHMAKING_ENTRY_TTL_MS + 1);
  check('a search expires after the entry TTL', expired.status === 'idle');

  q.enqueue(qa, null, qNow + 40);
  q.enqueue(qb, null, qNow + 41);
  const pair2 = q.takePair(qNow + 42)!;
  q.markMatched(pair2[0], pair2[1], 'match-x', qNow + 42);
  check('both players recover the matched status', q.status(qa, qNow + 43).status === 'matched' && q.status(qb, qNow + 43).status === 'matched');
  const expiredMatch = q.status(qa, qNow + 42 + MATCHMAKING_MATCHED_TTL_MS + 1);
  check('matched results expire after their TTL', expiredMatch.status === 'idle');

  // ------------------------------------------------------- real pairing pass
  const a = await makeUser('stranger-a');
  const b = await makeUser('stranger-b');
  matchmakingQueue.cancel(a.id);
  matchmakingQueue.cancel(b.id);
  matchmakingQueue.enqueue(a.id, null, Date.now());
  matchmakingQueue.enqueue(b.id, null, Date.now() + 1);

  const created = await runMatchmakingTick(db);
  const quick = created.find((c) => c.players.includes(a.id) && c.players.includes(b.id));
  check('pairing pass creates a real match for two strangers', !!quick);

  if (quick) {
    const [row] = await db.select().from(matches).where(eq(matches.id, quick.matchId));
    check('quick match has room_id = NULL', row.roomId === null);
    check('quick match is active, human, and has a deadline', row.status === 'active' && !row.isBotMatch && row.endsAt !== null);
    check('quick match locks a D5 swing', (row.swingPoints ?? 0) >= 29 && (row.swingPoints ?? 0) <= 31);
    const seats = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, quick.matchId));
    check('exactly two seats, one per stranger', seats.length === 2 && seats.some((s) => s.userId === a.id) && seats.some((s) => s.userId === b.id));
    check('both players get a matched status', matchmakingQueue.status(a.id, Date.now()).status === 'matched' && matchmakingQueue.status(b.id, Date.now()).status === 'matched');
  }

  // No self-pairing in the real pass either.
  const loneUser = await makeUser('lone');
  matchmakingQueue.cancel(loneUser.id);
  matchmakingQueue.enqueue(loneUser.id, null, Date.now());
  const noPair = await runMatchmakingTick(db);
  check('real pass never pairs a lone player with themselves', !noPair.some((c) => c.players.includes(loneUser.id)));
  check('the lone player is still waiting', matchmakingQueue.status(loneUser.id, Date.now()).status === 'searching');
  matchmakingQueue.cancel(loneUser.id);

  // ------------------------------------------------- repeat-rule integration
  const [pool] = await db.select({ n: sql<number>`count(*)::int` }).from(challenges).where(eq(challenges.isPublished, true));
  const r1 = await makeUser('repeat-a');
  const r2 = await makeUser('repeat-b');
  const first = await createQuickMatch(db, r1.id, r2.id, null);
  check('first quick match created for the repeat test', first.ok);

  if (first.ok) {
    const [firstMatch] = await db
      .select({ versionId: matches.challengeVersionId })
      .from(matches)
      .where(eq(matches.id, first.matchId));
    const [firstChallenge] = await db
      .select({ challengeId: challengeVersions.challengeId })
      .from(challengeVersions)
      .where(eq(challengeVersions.id, firstMatch.versionId));

    await finishMatch(db, first.matchId, { kind: 'draw' });
    await db.insert(submissions).values({
      userId: r1.id,
      challengeId: firstChallenge.challengeId,
      challengeVersionId: firstMatch.versionId,
      matchId: first.matchId,
      kind: 'submit',
      language: 'javascript',
      status: 'accepted',
      passed: 1,
      total: 1,
      results: [],
      sourceCode: 'test',
    });

    matchmakingQueue.enqueue(r1.id, null, Date.now());
    matchmakingQueue.enqueue(r2.id, null, Date.now() + 1);
    const secondPass = await runMatchmakingTick(db);
    const second = secondPass.find((c) => c.players.includes(r1.id) && c.players.includes(r2.id));
    check('repeat test produced a second quick match', !!second);

    if (second) {
      const [secondMatch] = await db
        .select({ versionId: matches.challengeVersionId })
        .from(matches)
        .where(eq(matches.id, second.matchId));
      const [secondChallenge] = await db
        .select({ challengeId: challengeVersions.challengeId })
        .from(challengeVersions)
        .where(eq(challengeVersions.id, secondMatch.versionId));
      check(
        'recently solved challenge is avoided when the pool allows',
        pool.n <= 1 || secondChallenge.challengeId !== firstChallenge.challengeId,
        `${firstChallenge.challengeId} vs ${secondChallenge.challengeId}`,
      );
    }
  }

  // -------------------------------------------------------------- leaderboard
  const [version] = await db
    .select({ id: challengeVersions.id })
    .from(challengeVersions)
    .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
    .where(and(eq(challenges.isPublished, true), eq(challengeVersions.version, challenges.currentVersion)))
    .limit(1);

  const l1 = await makeUser('ladder-a', { points: 130, wins: 3, losses: 0 });
  const l2 = await makeUser('ladder-b', { points: 130, wins: 4, losses: 0 });
  const unranked = await makeUser('ladder-unranked', { points: 121 });
  // The schema allows exactly one bot user (KERN). Reuse it instead of inserting
  // a second one; the ladder must exclude it.
  const botId = await ensureBotUser(db);

  const base = Date.now() - 7 * 24 * 3600_000;
  // Newest first: W, L, D, W, L, W. The ladder keeps the newest five.
  const results: Array<{ kind: 'win'; winnerId: string } | { kind: 'draw' }> = [
    { kind: 'win', winnerId: l1.id },
    { kind: 'win', winnerId: l2.id },
    { kind: 'draw' },
    { kind: 'win', winnerId: l1.id },
    { kind: 'win', winnerId: l2.id },
    { kind: 'win', winnerId: l1.id },
  ];
  for (let i = 0; i < results.length; i++) {
    await seedFinishedMatch(version.id, l1.id, l2.id, results[i], new Date(base + i * 3600_000));
  }

  const board = await getLeaderboard(db, l1.id);
  const entry1 = board.entries.find((e) => e.userId === l1.id);
  const entry2 = board.entries.find((e) => e.userId === l2.id);

  check('leaderboard includes ranked humans', !!entry1 && !!entry2);
  check('bots are excluded from the ladder', !board.entries.some((e) => e.userId === botId));
  check('players with no finished human match are excluded', !board.entries.some((e) => e.userId === unranked.id));
  check(
    'ties are ordered by wins (then name)',
    !!entry1 && !!entry2 && entry1.rank > entry2.rank,
    `${entry1?.rank} vs ${entry2?.rank}`,
  );
  check(
    'last five are the newest five real results',
    !!entry1 && entry1.lastFive.join('') === 'WLWDL',
    entry1?.lastFive.join(''),
  );
  check('viewer sees their own real rank', board.viewer?.userId === l1.id && board.viewer.rank === entry1?.rank);
  check('a signed-in unranked player gets viewer = null', (await getLeaderboard(db, unranked.id)).viewer === null);
  check('a bot viewer gets viewer = null', (await getLeaderboard(db, botId)).viewer === null);

  // Top-N cap and deterministic top order: 31 high-point humans beat the seeds.
  const capped: MadeUser[] = [];
  for (let i = 0; i < LEADERBOARD_TOP_N + 1; i++) {
    capped.push(await makeUser(`cap-${String(i).padStart(2, '0')}`, { points: 500_000 + i, wins: 1 }));
  }
  const cappedBoard = await getLeaderboard(db, l1.id);
  check(`ladder is capped at ${LEADERBOARD_TOP_N}`, cappedBoard.entries.length === LEADERBOARD_TOP_N);
  check('highest points rank first', cappedBoard.entries[0]?.userId === capped[capped.length - 1].id);
  check('a viewer outside the top N still gets a real rank', (cappedBoard.viewer?.rank ?? 0) > LEADERBOARD_TOP_N, String(cappedBoard.viewer?.rank));

  const [eligible] = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from users
    where is_bot = false and (wins + losses + draws) > 0
  `);
  check('totalPlayers counts every eligible human', cappedBoard.totalPlayers === Number(eligible.n), `${cappedBoard.totalPlayers} vs ${eligible.n}`);

  // ---------------------------------------------------------------- cleanup
  await cleanup();

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
