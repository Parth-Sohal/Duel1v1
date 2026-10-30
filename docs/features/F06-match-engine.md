# F06 — Match engine (duel lifecycle, timer, winner, points)

Status: spec (2026-10-29)
Branch: feature/F05-duels
Depends on: F05 (rooms), F04 (challenges + judge)
PLAN reference: Iteration 3, "F5 Match engine"

## Goal

A fair, server-owned 1v1: same challenge, same deadline, first correct submission wins, points move per decision D5 — exactly one outcome per match, even under concurrency, disconnects, and server restarts.

## Data (migration 0006)

- `matches`: per `docs/data-model.md` — `room_id`, `challenge_version_id`, `status` (waiting|active|finished), `result_type` (win|draw|forfeit), `winner_id`, `swing_points` (the D5 random 29–31 locked at start), `is_bot_match`, `started_at`, `ends_at` (server deadline = start + MATCH_DURATION_MS), `finished_at` + CHECKs (finished ⇒ result_type; win ⇒ winner_id).
- `match_players`: `(match_id, user_id)` pk, seat 1|2, `points_before`, `points_after`, `disconnected_at`.
- `submissions` gains nullable `match_id` (null = practice) + index `(match_id, created_at)`.

## Lifecycle

1. **Create** (host Start): one transaction — pick the challenge (F06 selection below), insert `matches` (status `active`, swing randomized, `ends_at` = now + MATCH_DURATION_MS), insert both `match_players` with `points_before`, set room `in_match`.
2. **Duel submissions** reuse the F04 judge loop (function harness, both languages) with two differences: `match_id` set, kind `submit`; per-test results are NOT sent to the opponent — the opponent sees only live progress (tests passed / attempts), never code or outputs.
3. **First accepted wins.** On an accepted submit: `UPDATE matches SET ... WHERE id = ? AND status = 'active'` — the conditional update guarantees exactly one winner on near-simultaneous passes; the losing submit just records its result and the match end is broadcast.
4. **Points (D5)** in the same transaction as the finish: win → winner `+swing`, loser `−swing`; draw → both `−DRAW_PENALTY`; forfeit → stayer `+FORFEIT_REWARD`, leaver `−FORFEIT_PENALTY`. No floor (points may go negative). `points_after` recorded per player.
5. **Forfeit:** a player with no live socket for FORFEIT_GRACE_MS during an active match forfeits (sweeper checks `disconnected_at`); explicit leave also forfeits. Both-disconnect → the first to return resumes; if the deadline passes first, draw rules apply.
6. **Draw:** the sweeper finishes matches whose `ends_at` passed with no winner (draw, both −10).
7. **Restart safety:** all state is in Postgres; the sweeper runs on boot + every few seconds, so a server restart cannot lose or orphan a match. Sockets are just broadcast channels.

## Challenge selection (F6 repeat rule)

Prefer published challenges that NEITHER player solved (accepted submit) in their last REPEAT_AVOID_LAST_N matches; difficulty filter from the room. Fallback when few challenges exist: exclude only the single most recent match's challenge for each player; final fallback: any published challenge. Deterministic order (random among eligible) so friends can't predict the pick.

## Points math (D5, owner-confirmed 2026-10-29)

| Outcome | Seat A | Seat B |
|---|---|---|
| Win | +29…31 | −29…31 (same swing) |
| Draw | −10 | −10 |
| Forfeit | +10 (stayer) | −10 (leaver) |

## Match screen + result (extends the owner design; shown to owner before final)

- **`/match/:id`** — dark-half workbench (same editor component as practice), cream half = statement + samples; top strip: countdown (from `ends_at`, server-authoritative), opponent presence + progress (tests passed / attempts), FORFEIT warning after grace. Refresh restores challenge, code (latest own submit), and time left from the server.
- **Result overlay** on the same page when finished: VICTORY. / DEFEAT. / DRAW. / FORFEIT., the point delta (+30 / −30 style), and a rematch CTA (new room, same players) + back to /duel.

## API

| Method | Path | Notes |
|---|---|---|
| POST | `/api/duels/rooms/:code/start` | host only; both ready → creates match (also pushed via socket) |
| GET | `/api/matches/:id` | participant-only; full match state (challenge via visibleTests, ends_at, players, own latest code) |
| POST | `/api/matches/:id/submit` | body `{ language, sourceCode }`; judged; may finish the match |
| GET | `/api/matches/:id/socket-token` | one-time socket auth token (see F05) |
| GET | `/api/matches` | own history (F07) |

Errors: 403 not a participant, 404 unknown, 409 match not active (e.g. submitting after end), 429 judge rate limit.

## Test checklist (PLAN gates)

- [x] Both players get the same challenge and the same `ends_at` *(one authoritative match row serves both seats; soak verified every round)*
- [x] First passing submission wins; loser loses the swing *(f05 matrix + all 10 soak rounds: +29…31 / −same, applied exactly once)*
- [x] Two near-simultaneous passes produce exactly one winner (forced concurrency test) *(f06 engine test: conditional update)*
- [x] Time expiry with no solver → draw, both −10 *(f06 engine test)*
- [x] Closing a tab past the 30 s grace forfeits (stayer +10, leaver −10) *(f06 engine test)*
- [x] Refresh mid-match restores challenge, code, and time left *(match detail: challenge + `ends_at` + own latest submission; verified at API layer)*
- [x] Server restart mid-match does not lose the match (sweeper resumes/finishes) *(restart gate: kill + reboot mid-match → draw finished with correct points, 6/6)*
- [x] Points never below zero — n/a by design: D5 says no floor; verify negative points render and persist *(f06 engine test: loser went negative and persisted)*
- [x] Duel submissions never leak code or outputs to the opponent *(progress event carries counts only; detail leak checks both directions)*

*(Verified 2026-10-30: `f05-api-test.ts` 48/48, `f06-engine-test.ts` 17/17, `f06-soak-test.ts` 52/52, restart gate 6/6.)*
