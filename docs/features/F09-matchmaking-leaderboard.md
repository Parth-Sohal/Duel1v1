# F09 — Random matchmaking and leaderboard

**Iteration 5 feature. Status: shipped (2026-11-14).** Gate: `f09-matchmaking-test.ts` **39/39**, plus a live two-account queue check that paired two real sessions into one active match.
Branch: `feature/F09-matchmaking-leaderboard`
Depends on: F05 (rooms/presence conventions), F06 (match engine, repeat rule), F07 (finished-match history)

Turn the disabled **ANYONE** option into a real queue that pairs two signed-in
players into a normal duel, and add a public **Rankings** page built from real
finished human matches. No fake players, bot opponents, seasons, clubs, tiers,
or simulated live status.

## Owner decisions

| Decision | Choice |
|---|---|
| Queue storage | **In-memory, single server instance** (per PLAN: "queue behind a small interface, in-memory first") |
| Pairing discovery | Client polls the status endpoint; no new socket namespace needed |
| Match shape | A normal `matches` row with `room_id = NULL`; same engine, timer, judge, points, history |
| Ranking metric | `users.points` (the real rating shown in the header) |
| Ladder size | **Top 30** humans, plus the signed-in viewer's own rank if outside the top 30 |
| Exclusions | Bots, practice submissions, and players with no finished human duel |

## Scope

### In

- In-memory matchmaking queue behind a small interface (`MatchmakingQueue`), with
  a database-backed pairing pass that creates real matches.
- `POST /api/duels/matchmaking` — join (or refresh) the queue.
- `GET /api/duels/matchmaking` — status/heartbeat: idle, searching, or matched.
- `DELETE /api/duels/matchmaking` — leave the queue.
- Pairing loop in `apps/server/src/index.ts` (same timer pattern as the sweeper).
- `createQuickMatch` in the match service: two players, `pickChallenge` with the
  F6 repeat rule, D5 swing, normal active match.
- Leaderboard service + `GET /api/leaderboard`: top 30 ranked humans, last-five
  form, total ranked players, and the optional signed-in viewer's row.
- Web: enable **Anyone** in `DuelLauncher` with a real search state, add the
  **Rankings** nav link, and build `/leaderboard` from `SplitShell`.
- Shared constants/types for matchmaking and leaderboard contracts.
- `scripts/f09-matchmaking-test.ts` covering the F9 gate.

### Out

- Redis, durable queues, cross-instance matchmaking (scaling backlog).
- Seasons, tiers, promotion/relegation, College Clash, clubs, badges.
- Reactive/instant push for "match found" (polling is enough at this scale).
- Rating changes, ELO/Glicko, placement matches.
- Chat, rematches, best-of-three, spectators.
- Matchmaking for anonymous users (must be signed in, like all duels).

## Queue model

An entry is `{ userId, difficulty, enqueuedAt, lastSeenAt }`:

- **One entry per user.** Re-posting while queued refreshes the entry and may
  change its difficulty; it never duplicates the player.
- **Difficulty compatibility:** `ANY` is compatible with every difficulty; two
  concrete difficulties must be equal. When one side is `ANY`, the match uses
  the concrete difficulty of the other side. Two `ANY` entries → no filter.
- **Ordering:** oldest waiting entry first. The pairing pass takes compatible
  pairs in FIFO order; no randomness (predictable, easy to test). Challenge
  selection remains random through `pickChallenge`.
- **Heartbeat + stale pruning:** the status GET refreshes `lastSeenAt`. Waiting
  entries unseen for `MATCHMAKING_STALE_MS` (30 s) are pruned, so a closed tab
  cannot hold a slot. `MATCHMAKING_ENTRY_TTL_MS` also caps a single search at
  5 minutes; an expired search returns to `idle` and the UI offers a retry.
- **Pairing reservation:** once a pair is taken for match creation, both players
  are moved into a short-lived `pairing` set. Status GETs keep returning
  `searching` for them until the DB insert resolves, so a slow database can
  never make a client abandon the queue with a false `idle`.
- **Matched results** are retained for `MATCHMAKING_MATCHED_TTL_MS` (5 min) so
  either client can recover the `matchId` if one poll is missed. Re-queuing
  clears the retained result.
- **No self-pairing:** the map is keyed by user id, and the pairing pass also
  asserts `a.userId !== b.userId`.

### Pairing pass

Every `MATCHMAKING_TICK_MS` (2 s):

1. Prune stale waiting entries and expired matched results.
2. Find the oldest waiting entry, then the oldest compatible entry.
3. Re-check `activeMatchFor` for both players (one live duel per human).
4. `createQuickMatch` in one transaction:
   - `pickChallenge(db, [a, b], resolvedDifficulty)` — F6 repeat rule applies;
   - insert `matches` with `roomId = null`, `status = 'active'`,
     `swingPoints = randomSwing()`, `startedAt = now`, `endsAt = now + 10 min`;
   - insert both `match_players` seats with `points_before`;
   - no room is created or mutated.
5. On success, replace the reservations with `matched` for both players and
   record a `match_started` event with `meta.matchType = 'quick'`.
6. On `challenge_unavailable`, return both entries to waiting and retry next
   tick. On `already_in_match`, drop only the blocked player's entry.

Pairing is serialized in the single Node process, so two ticks can never consume
the same entry. The match insert runs in one DB transaction; partial matches are
not possible.

## Server contract

All matchmaking routes require cookie auth. The leaderboard GET is public and
uses optional auth.

### `POST /api/duels/matchmaking`

Body: `{ "difficulty": "easy" | "medium" | "hard" | null }` (unknown values are
treated as `ANY`; the body is optional).

| Status | Response | When |
|---|---|---|
| 200 | `{ status: "searching", since, difficulty, waiting }` | queued or refreshed |
| 401 | `{ error: "not_signed_in" }` | no session |
| 409 | `{ error: "already_in_match" }` | a live duel exists (`activeMatchFor`) |
| 429 | `{ error: "rate_limited", message }` | room-op limiter |

`waiting` is the number of **other** real entries currently waiting. It is never
simulated. Re-posting is idempotent and refreshes the heartbeat. A POST always
starts/refreshes a search (it clears an old pairing result); use GET to recover a
pairing result after a missed poll.

### `GET /api/duels/matchmaking`

Returns the same three shapes as POST (`idle` when the player has no entry).
Every GET refreshes `lastSeenAt` for a waiting entry. A `matched` response stays
available for 5 minutes. No DB match lookup is needed: if the match was swept or
forfeited, the match page still shows its real finished state.

### `DELETE /api/duels/matchmaking`

Returns `{ ok: true }` and removes the entry (waiting or matched). Idempotent.

### `GET /api/leaderboard`

Optional auth. Response:

```json
{
  "entries": [
    {
      "rank": 1,
      "userId": "uuid",
      "displayName": "Player",
      "avatarUrl": null,
      "points": 142,
      "wins": 7,
      "losses": 3,
      "draws": 1,
      "lastFive": ["W", "L", "W", "D", "W"]
    }
  ],
  "totalPlayers": 42,
  "viewer": null
}
```

- Eligibility: `users.is_bot = false` **and** `wins + losses + draws > 0` (bot
  duels never increment these counters, so bot-only players are excluded).
- Order: `points DESC, wins DESC, lower(display_name) ASC, id ASC`; `rank` is
  the 1-based position under that order (ties broken deterministically).
- `entries` is capped at `LEADERBOARD_TOP_N` (30).
- `lastFive` is the player's five most recent **finished human** matches, newest
  first: `W` (winner, including forfeit wins), `L` (loser, including forfeits),
  `D` (draw). Fewer than five results → shorter array. Bot matches excluded.
- `viewer` is the authenticated player's own entry (with real rank) when they
  are eligible — including when they also appear in the top 30; `null` when
  signed out or unranked (the UI uses it for highlighting either way).
- `totalPlayers` counts all eligible humans, not just the top 30.

## UI

### `/duel` — Anyone

- The **Anyone** option becomes selectable. Selecting it shows a real queue panel
  instead of room controls:
  - idle: **Find a match** button, difficulty still selectable;
  - searching: disabled difficulty controls, elapsed time, the real number of
    other players waiting, and **Cancel search**;
  - matched: navigates to `/match/:id`;
  - error: the same plain-language errors as rooms (`already_in_match`,
    rate limit, connection failure).
- Polling every 2 s; a `visibilitychange` refresh and cleanup on unmount cancel
  the queue (best effort). If the search expires, the UI returns to idle with a
  retry message; it never invents an opponent.
- RIVAL and KERN behavior, strings, and routing stay unchanged.

### `/leaderboard` — Rankings

- New public page built from `SplitShell`.
- Cream (7/12): eyebrow, **"The ladder."** headline, one paragraph of protocol
  copy, and the real top-30 table: rank, avatar + name, points, W–L–D, last five
  as square W/L/D marks. Rank 1–3 get an accent marker. Empty state when no
  ranked players exist.
- Dark (5/12): **Your rank** — the viewer's rank, points, record, last five, and
  a link to `/duel`; signed-out state offers sign-in. Below it, a short "How the
  ladder works" list (points decide rank, bots/practice excluded, top 30 shown).
- Header **Rankings** becomes a real link in desktop and mobile nav.
- Style: existing brutalist system only — cream/carbon/orange, mono labels,
  square corners, thin rules. No new dependencies or animation.

## Data model

No migration. The queue is process memory; matches and results already exist:

- `matches.room_id` is nullable, so quick matches use `NULL`.
- `matches.is_bot_match = false`, `status/result_type/winner_id` unchanged.
- `match_players`, `users.points/wins/losses/draws`, `submissions` unchanged.
- Leaderboard reads `users`, `matches`, `match_players`; no new indexes required
  at current scale. If the ladder becomes slow, add `(points DESC)` and
  `(status, finished_at DESC)` indexes in a follow-up migration.

## Test gate

`npx tsx scripts/f09-matchmaking-test.ts` (real DB, throwaway users, cleans up):

- [x] Two different strangers are paired into one active match with `room_id = null`.
- [x] A lone queued player is never paired with themselves.
- [x] A recently solved challenge is avoided when other published challenges exist.
- [x] `ANY` pairs with a concrete difficulty; EASY does not pair with HARD.
- [x] Stale entries are pruned; one user cannot hold two entries.
- [x] Leaderboard excludes bots and unranked players, orders by the documented
      tie-breakers, caps at 30, and reports real last-five results.
- [x] Live API check: queue two throwaway sessions, see `matched`, open the match.

Result (2026-11-14): **39/39** in `scripts/f09-matchmaking-test.ts`. The live
check registered two throwaway accounts, queued one as `easy` and one as `ANY`,
and both status polls returned the same active `matchId`; the match page loaded
with the real challenge and timer. Screens reviewed at 1440 and 390 widths with
no horizontal overflow, and both signed-in/signed-out Rankings states checked.

## Open items resolved during build

- Matchmaking discovery uses polling rather than Socket.IO. The existing socket
  token flow is tied to room/match channels and would add failure modes without
  improving the 2-second pairing window.
- Quick matches deliberately create no room. Synthesizing a hidden lobby would
  duplicate state and break the "one live duel" guard's simple invariants.
