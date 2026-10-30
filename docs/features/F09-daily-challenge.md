# F09 — Daily challenge (+ growing the pool to 30–50)

Status: built + gated (2026-10-30, test matrix 21/21 + pool verify 8/8)
Branch: feature/F09-daily-challenge
Depends on: F04 (challenges + judging)
PLAN reference: Iteration 4, "Daily challenge; grow to 30 to 50 hand-checked challenges"

## Goal

Everyone gets the same fresh challenge every day — a reason to come back solo,
and a fair "compare with friends" hook. The same frozen versioning and judging
as practice: a daily is a pointer at a published challenge version, never a new
mode or a second submission path.

## Scope

- In: `daily_challenges` table (`day date` PK UTC, `challenge_version_id` FK);
  deterministic date-seeded pick from the published pool with no repeat until
  the pool is exhausted; `GET /api/daily` (challenge detail + the caller's
  solved/attempt state + time until the next one); `/daily` page reusing the
  practice workbench UI with a "today's challenge" banner and countdown;
  home-screen entry point; `scripts/challenge-verify.ts` — runs every
  published version's reference solution through the real Judge0 over all its
  tests (the PLAN gate "all challenges pass with their reference solutions").
- Out (not now): daily leaderboards (iteration 5 needs real users), daily
  streaks/rewards, per-difficulty dailies.

## Pick rule

Day → deterministic pick: order the published pool by `slug`, hash
`(day, salt)` to pick the index, skip the last `N` days' picks (no repeats
while alternatives exist; wraps only when the pool is exhausted). The result is
cached in `daily_challenges` (written on first request of the day, then
authoritative). UTC boundaries; the "next challenge in…" countdown derives from
the next UTC midnight.

## Solving a daily

The `/daily` page deep-links into the existing practice flow for that slug
(`/practice/:slug`), so solving, judging, redaction, rate limits, and solved
state are the F04 systems exactly. The daily page itself only adds the banner
(TODAY'S CHALLENGE + time left) and the shared-for-everyone guarantee.

## Growing the pool (owner hand-checks, tooling on me)

- Seed format unchanged (`challenges` + immutable `challenge_versions` with
  `entry_functions` jsonb, tests jsonb, reference solution per language).
- Target: 30–50 published challenges (8 today). The owner authors/hand-checks;
  I keep the seed loader and the verify script. The verify script is the gate —
  every version's reference solution must pass all tests via the real judge
  before it counts.

## Test checklist

Evidence: `apps/server/scripts/f09-daily-test.ts` — 21/21 against the local
server + shared Neon DB (2026-10-30); pool gate
`scripts/challenge-verify.ts` — 8/8 published versions verified through the
real Judge0. Note: the seed loader (`f04-seed-challenges.ts`) now SKIPS slugs
already in the DB — published challenges carry real player submissions and
re-running the old delete-and-reinsert would have cascaded them away.

- [x] Two different accounts get the SAME challenge for the same UTC day
- [x] The daily changes each day; no repeats while the pool has fresh entries
- [x] Solving the daily works through the normal practice submit (solved state
      round-trips; attempts counted; hidden tests sealed)
- [x] The daily respects the 20-judges/5-min rate limit like practice (the
      daily solve path IS the practice submit route — same `allowJudgeSubmission`
      guard, gated by the F04 matrix)
- [x] `challenge-verify.ts` passes for every published version (reference
      solutions × all tests, real judge)
- [x] The daily page works signed-out (viewable) and redirects to sign-in to solve
