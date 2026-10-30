# F08 — KERN BOT (a lone player can duel the bot)

Status: built + gated (2026-10-30, test matrix 29/29)
Branch: feature/F08-kern-bot
Depends on: F05 (rooms), F06 (match engine), F04 (challenges + judge)
PLAN reference: Iteration 4, "Bot opponent"; decision D6

## Goal

A user with nobody to play gets a full, real duel against KERN — the bot runs
through the exact same match engine (same challenge, same server-owned clock,
same sweeper, same result flow), so "solo play" is never a second code path
players can exploit.

## Decision D6 (owner-confirmed 2026-10-30)

KERN duels move **no points and count no stats** (wins/losses/draws unchanged).
They are practice through the real engine. History lists them labeled "vs KERN"
with no point delta.

## Scope

- In: a `users` row flagged `is_bot` (email/google_id NULL — KERN never signs
  in), `POST /api/duels/bot` (one call: create the bot room, seat KERN as
  guest, both ready, start the match via the normal `startMatch` — repeat rule
  picks the challenge, `ends_at` set, swing locked), bot brain columns on
  `matches` (`bot_will_solve`, `bot_solve_at`), the sweeper executes the bot's
  move (restart-safe: the plan lives in the DB, never in a timer), KERN's
  submission inserted directly (it IS the server's reference solution — no
  Judge0 call, no rate-limit cost), progress events before it solves, match
  finish with zero deltas, history/UI labeling, launcher button.
- Out (not now): matchmaking with strangers (iteration 5 "ANYONE"), bot
  difficulty settings in the UI, bot chat/trash talk, spectator mode.

## The bot brain (human-like pacing, decided at match start)

- `bot_will_solve` — rolled per difficulty so the bot is beatable:
  easy 0.35, medium 0.50, hard 0.65. Stored, never re-rolled.
- `bot_solve_at` = started_at + uniform(90 s … 7 min). If `bot_will_solve`,
  KERN submits the accepted reference solution at that moment (first pass →
  KERN wins, exactly like a player's conditional update). If not, KERN submits
  ONE wrong answer at a random moment in 2–4 min (the player sees progress:
  attempts 1, 0 tests passed) and never solves — the clock decides.
- The player's first accepted submit beats the bot regardless of `bot_solve_at`
  (match already finished → the bot's tick finds no active match).
- Sweeper pass (existing, every 5 s) gains one duty: for each active bot match
  past `bot_solve_at`, insert the bot's submission (directly, as the server's
  own code) and finish. This makes server restarts harmless — no in-memory
  state to lose.

## D6 in the engine

`finishMatch`: when `match.is_bot_match`, skip every user-stat update and force
all deltas to 0 (points_before = points_after recorded as usual). Result type
and winner are still recorded so the match resolves normally (forfeit/draw
included). The submit response and socket broadcasts carry the zero deltas, and
the UI hides the point delta line for bot matches.

## Privacy and fairness

- KERN's submission source is the REFERENCE solution — the F07 rule "a player
  never sees the opponent's code" must hold exactly as for humans (detail leak
  check extended to bot matches).
- A player in a live bot match cannot join a room or start another duel
  (`already_in_match` counts bot matches — they are matches).
- KERN cannot authenticate (no email/session path).

## Data (migration 0011)

- `matches`: `bot_will_solve boolean NULL`, `bot_solve_at timestamptz NULL`
  (NULL for every human match — no behavior change).
- Seed: ensure the KERN user row exists on boot (idempotent), `is_bot = true`.
- `users.is_bot` exists since migration 0002; `matches.is_bot_match` since 0008.

## UI

- `/duel` launcher: second primary action **PLAY VS KERN** (difficulty chips
  apply) → creates the match and navigates straight to `/match/:id`.
- Workbench: opponent card shows KERN (initial-based avatar works); progress
  line behaves exactly as with a human.
- Result overlay: bot-match variants ("KERN passed first." / "You out-coded
  KERN."), no "+30 pts" line (D6).
- History: "vs KERN" chip, no delta.

## Test checklist (PLAN gates + specifics)

Evidence: `apps/server/scripts/f08-bot-test.ts` — 29/29 against the local
server + shared Neon DB (2026-10-30). Race hardening while gating: the
select-then-insert in `ensureBotUser` created three KERN rows across
concurrent processes → partial unique index `users_is_bot_single`
(migration 0012) + insert-with-`onConflictDoNothing` re-read; duplicates
removed (one KERN row remains).

- [x] A lone new user can play a full duel against the bot (create → solve or
      lose → result overlay → history)
- [x] Bot sometimes wins and sometimes loses; points follow decision D6
      (zero deltas, no W/L/draw changes, either outcome)
- [x] The player's first accepted submit beats the bot regardless of the plan
- [x] Player disconnect past the grace → forfeit with no points moved
- [x] Server restart mid-bot-match: the bot still acts at `bot_solve_at`
      (sweeper reads the plan from the DB — the test writes the plan to the
      DB and the sweeper executes it, which is exactly the restart path)
- [x] KERN's reference solution never appears in any response to the player
- [x] A player in a live bot match cannot create a room or start another duel
      (`already_in_match`)
- [x] Repeat rule applies to bot matches (playing several bot duels does not
      repeat a challenge while alternatives exist)
- [x] Ending a bot match closes its room (no orphaned joinable rooms)
