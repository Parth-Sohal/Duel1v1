# F07 — Match history + repeat rule

Status: spec (2026-10-29)
Branch: feature/F05-duels
Depends on: F06 (matches exist), F04 (challenges)
PLAN reference: Iteration 3, "F6 Match history + repeat rule"

## Goal

Players can see the duels they've played — who won, on what challenge, and how points moved — and never get the same challenge dished out twice in a short span.

## Scope

- In: `GET /api/matches` (own history, paginated), `GET /api/matches/:id` detail (participant-only), profile-page MATCHES section listing recent duels (result, points delta, opponent, challenge, date), repeat rule in challenge selection (engine lives in F06).
- Out: leaderboards/seasons (backlog, LEAGUES), AI reviews (later), spectating others' history.

## History list

`GET /api/matches?limit=20&offset=0` → own matches, newest first, each row:
`{ id, resultType, winnerId, swingPoints, pointsDelta (own), opponent { id, displayName, avatarUrl }, challenge { slug, title, difficulty }, finishedAt, isBotMatch }`.

Running (active) matches appear first with status `active` so a refresh mid-duel can restore the link.

## Detail

`GET /api/matches/:id` (participant only): full state per F06 — status, challenge (visible tests only), both players with points before/after, `ends_at`, own latest submission (code + verdict). Opponent's code and outputs are NEVER included, even after the match ends.

## Repeat rule (F6)

When the engine picks a challenge (F06), it excludes challenges either player had accepted in their last `REPEAT_AVOID_LAST_N` (3) matches. Fallbacks when the pool would empty: widen to only the immediately-previous match's challenge per player; then any published challenge. This keeps friend rematches fresh without stranding two players who've played everything recently.

## UI

Profile page (`/u/[id]`, own view): "MATCH HISTORY." block under the rating — rows styled like the practice roster (index number, opponent name, W/L/D/F marker in orange/carbon, +30 / −30 delta, challenge title, time ago). Rows link to the match detail view (`/match/:id`, which shows the result overlay for finished matches). Empty state: "NO DUELS YET — pick a fight on PLAY." Public profiles show only published-visual data: opponent-facing rows stay (they're the player's public record) but without any code.

## Test checklist

- [x] History lists own matches newest-first with correct result and point deltas (win/draw/forfeit all shown correctly) *(f05 + soak: win rows via API both players; draw/forfeit rows verified at row level in engine tests — same column feeds the API)*
- [x] Another player's history is not reachable (`GET /api/matches/:id` as non-participant → 403) *(403 `not_a_participant`)*
- [x] Opponent code/outputs never appear in detail responses (even finished matches) *(both directions + own submissions visible)*
- [x] Repeat rule: playing 3 matches in a row never repeats a challenge while alternatives exist *(engine test + soak variety check across 10 duels)*
- [x] Pagination works (limit/offset), active match pinned on top *(limit/offset verified; active-first enforced in ORDER BY)*

*(Verified 2026-10-30: `f05-api-test.ts` 48/48, `f06-soak-test.ts` 52/52.)*
