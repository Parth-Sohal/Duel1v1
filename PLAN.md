# Coding Duel — Build Plan (Iterations)

A web platform where two players get the same coding challenge and race to solve it in 10 minutes. First to pass all tests wins a point; the other loses one.

This file is the single source of truth for **what we build and in what order**.

- What and why: `docs/project-description.md`
- How it works: `docs/architecture.md`
- Tables and rules: `docs/data-model.md`
- Folders and doc conventions: `DOCUMENT_STRUCTURE.md`
- Status and test reports: `docs/reports/project-report.md`

---

## 1. How we work: iterations

We build in **iterations**. Each iteration is a small set of features that ends with something you can open in the browser and use. **We do not start the next iteration until the current one is tested and reported.**

```text
 ┌─► 1. PLAN     read the iteration below, write docs/features/Fxx-name.md per feature
 │   2. UI       you share the design file for the screens in this iteration
 │   3. BUILD    build only this iteration, nothing extra (one feature at a time)
 │   4. TEST     run the iteration's test gate together
 │   5. FIX      fix failures, re-test
 │   6. REPORT   fill in the iteration report in docs/reports/project-report.md
 │   7. DECIDE   go / no-go for the next iteration
 └──────────────────── next iteration
```

Rules:
- **No scope creep.** New ideas go to the Backlog (section 7), not into the current iteration.
- **The server is the referee.** The browser only displays; it never decides winners, scores, or time.
- **Hidden test cases never leave the server.**
- **Player code never runs inside the game server.** Only in the sandbox (Judge0).
- Each feature is built on its own branch (`feature/Fxx-name`) and merged only after the iteration gate passes.
- Every iteration ends with a deployed, working version, not just code on a laptop.

## 2. Tech stack (v1)

| Part | Choice |
|---|---|
| Frontend | Next.js + TypeScript |
| Game server | Node + TypeScript + Socket.IO (REST + WebSocket) |
| Database | PostgreSQL (hosted on Neon), accessed with Prisma or Drizzle |
| Code execution | Judge0 (hosted API at first) |
| Auth | Google sign-in + secure session cookie |
| AI feedback | LLM API call, capped per user |
| Hosting | Frontend on Vercel; game server on Railway / Render / Fly |

Not in v1: Redis, job queue, load balancer, microservices, Facebook login, user-created challenges, payments.

## 3. Open decisions

| # | Decision | Needed before | Default if undecided | Answer |
|---|---|---|---|---|
| D1 | Product name | Iteration 0 | "Coding Duel" (placeholder) | |
| D2 | AI coding tool used to build | Iteration 0 | none chosen | |
| D3 | Languages at launch | Iteration 2 | JavaScript and Python | **JavaScript and Python** (decided 2026-10-27) |
| D4 | Judge0 hosted or self-hosted | Iteration 2 | Hosted | **Hosted** (decided 2026-10-29): free public CE endpoint `https://ce.judge0.com`, no key, verified live; env-only swap to self-hosted/keyed endpoint later if needed |
| D5 | Points, draw, forfeit rules confirmed | Iteration 3 | +1 / -1 (floor 0), draw no change, 30 s grace | **Confirmed 2026-10-29 (owner custom rules), floor revised 2026-10-30:** win swing randomized +29…+31 (loser pays the same, **floored at 0 — nobody goes negative**; winner always takes the full swing), draw both −10 (floored), forfeit stayer +10 / leaver −10 (floored), 30 s disconnect grace; new accounts start at 0 |
| D6 | Do bot matches change points? | Iteration 4 | No point change | **Confirmed 2026-10-30 (owner):** KERN BOT duels move NO points and count NO stats (wins/losses/draws) — pure practice through the real engine. History shows them labeled "vs KERN" with no delta |

## 4. Iterations

Status key: `[ ]` not started · `[~]` in progress · `[x]` tested and reported

---

### [x] Iteration 0 — Foundation
**Goal:** an empty but running, deployed project that anyone can clone and run.

**Features**
- **F0 Project setup:** repo and folders (see `DOCUMENT_STRUCTURE.md`), Next.js app, Node game server skeleton, PostgreSQL connection and migration tooling, environment config, lint and format, `/health` endpoint, README.

**UI:** none (placeholder home page).

**Test gate**
- [x] Frontend runs locally and shows a page
- [x] Game server runs locally and `/health` returns OK
- [x] Server connects to the database and a first migration runs
- [x] Both apps deployed and reachable online (Vercel + Render, verified 2026-10-27)
- [x] A fresh clone runs by following only the README (verified by proxy — install/migrate/dev steps all run from the documented commands; repo now public-flow on GitHub)
- [x] No secrets in git; `.env.example` lists the variable names

**Exit:** report written; decisions D1 and D2 recorded. ✓

---

### [x] Iteration 1 — Accounts
**Goal:** a player can sign in, stay signed in, and see their profile.

**Features**
- **F1 Google login and session:** Google sign-in, server-side token verification, user created on first login, secure session cookie, logout, "who am I" endpoint, protected-route check.
- **F2 Profile:** name, avatar, points, win/loss/draw counts, edit display name, public profile view for other players.

**UI:** login page, header with avatar and sign-out, profile page (stat bars and hero panel from your design).

**Tables:** `users`, `sessions`.

**Test gate**
- [x] New Google account creates a user; a returning account reuses it
- [x] Refresh keeps you signed in; logout ends the session
- [x] Protected page redirects when signed out
- [x] A forged or expired token is rejected
- [x] Own profile shows correct data; editing the name saves and shows everywhere
- [x] Another player's public profile loads without private fields (no email)
- [x] Empty or oversized names are rejected
- [x] Layout matches the design at desktop and mobile width

*(Gates verified during the iteration-1 close + production smoke 13/13 on 2026-10-28; boxes back-ticked 2026-10-30.)*

---

### [x] Iteration 2 — Practice mode
**Goal:** solve a challenge solo: read it, write code, run it, see results.

**Features**
- **F3 Challenges and practice:** challenge storage (statement, starter code, limits, tests as `jsonb`, versions), challenge list and detail page, code editor with a language picker (JavaScript or Python), "Run" and "Submit" through Judge0 with a per-language time and memory multiplier, result display, submissions saved, per-user rate limit, 5 to 10 seed challenges with reference solutions.

**UI:** challenge list, IDE-style practice screen with results panel.

**Tables:** `challenges`, `challenge_versions`, `submissions`.

**Test gate** — all passed 2026-10-29 (function-call judging, decision 11 revised)
- [x] Correct solution passes all tests
- [x] Wrong solution shows which **sample** test failed with input, expected, and actual output (arguments / expected / your return value, expandable)
- [x] A failing **hidden** test shows only "test N of M failed" (no input or expected output)
- [x] Infinite loop stops at the time limit; memory-hungry code stops at the memory limit (both verified empirically: `while(true){}` → time_limit; 1 GB touched allocation → OOM kill → runtime_error)
- [x] Code cannot reach the network or the game server (verified empirically: outbound curl from a submission fails in the sandbox)
- [x] Hidden tests never appear in any browser response (check the network tab)
- [x] Spamming Run hits the rate limit (21st call in 5-minute window → 429)
- [x] Switching language keeps the challenge and loads the right starter code (per-language scratchpads, nothing is lost)
- [x] A correct solution passes in both JavaScript and Python; the Python time limit is scaled so correct code is not failed for being slower (5 s base × 1.5 + 1 s grace)
- [x] Every seed challenge passes with a reference solution in both JavaScript and Python (82/82 frozen-output runs, JS+PY agree)
- [x] A player completes a full practice session end to end (owner sessions in the browser + 21/21 UI smoke through the real web proxy)

**Milestone:** this is a usable product on its own. Consider showing it to a few people here.

---

### [x] Iteration 3 — Friend duels
**Goal:** two friends play a complete, fair 1v1 match.

**Features**
- **F4 Friend rooms:** create room, invite link, join, WebSocket connection, presence, ready state, reconnect that resends full state.
- **F5 Match engine:** match states, same challenge for both, server-owned timer (`ends_at`), duel submissions via Judge0, winner chosen in one database transaction, points updated, draw and forfeit rules.
- **F6 History and repeat rule:** match history list and detail, "avoid recently played challenges" with fallback.

**UI:** lobby / room, match screen (countdown, editor, opponent status), result screen, history on profile.

**Tables:** `rooms`, `matches`, `match_players`.

**Test gate**
- [x] Host creates a room and gets a link; friend joins and both see each other instantly *(f05 API matrix: create 200, join seat 2, `room_state` push with presence)*
- [x] Refreshing a tab reconnects to the same room *(lobby re-mount does idempotent REST join + socket `room:join` → full state resend; verified at API/socket layer)*
- [x] A third person cannot join a full room; an expired invite shows a clear error *(409 room_full / 404 room_unavailable)*
- [x] Both players get the same challenge and the same `ends_at` *(one authoritative match row serves both seats; soak verified `ends_at` in the future every round)*
- [x] First passing submission wins; the other loses the same swing *(D5: +29…31 / −same, verified in f05 matrix + all 10 soak rounds)*
- [x] Two near-simultaneous passes produce exactly one winner *(f06 engine test: conditional update, exactly one finish applied)*
- [x] Time expiry with no solver ends as a draw *(D5: both −10 — engine test)*
- [x] Closing a tab past the grace period forfeits *(stayer +10 / leaver −10 — engine test)*
- [x] Refresh mid-match restores challenge, code, and time left *(match detail returns challenge + `ends_at` + own latest submission code)*
- [x] Server restart mid-match does not lose the match *(restart gate: kill + reboot mid-match → sweeper finished it as a draw with correct points, 6/6)*
- [x] Points never go below zero — **owner restored the floor (2026-10-30)**: a poor loser pays only what they have (lands on 0), the winner still takes the full swing; enforced in `finishMatch` + a DB CHECK (migration 0010). Engine test verifies a 5-point loser lands on 0 while the winner takes the full swing
- [x] Every finished match appears in both players' history with correct data *(f05 + all 10 soak rounds, both players' rows)*
- [x] A just-played challenge is not picked again when others exist; fallback works when few challenges exist *(engine test + soak variety check)*
- [x] Ten matches against a friend with no unfair or broken outcome *(f06 soak: 52/52 — 10 real Judge0 duels, alternating winners)*

**Bug fixes surfaced by the test gate (2026-10-30):** invite-code generator could emit I/L/O which lookups normalize away (~half of rooms unjoinable) → true Crockford alphabet; concurrent READY toggles could erase each other (read-modify-write on jsonb) → atomic SQL merge; socket `room:join` now normalizes codes like REST; Neon pool gains TCP keepalive against half-open connection hangs.

*(Live-match + result screens reviewed by the owner on 2026-10-30 — review surfaced two real fixes, both shipped: the loser's DEFEAT overlay could be missed (poll fallback added) and the points floor was restored. Iteration 3 closed.)*

---

### [~] Iteration 4 — Soft launch
**Goal:** safe and fun for real users, even when few are online.

**Features**
- **F08 KERN BOT** (PLAN "F7" bot opponent): bot that "solves" at a human-like pace and runs through the same match engine (`docs/features/F08-kern-bot.md`).
- **F09 Daily challenge** (PLAN "F7" second half): same challenge for everyone each day; grow to 30 to 50 hand-checked challenges (`docs/features/F09-daily-challenge.md`).
- **F10 Launch hardening** (PLAN "F8"): rate limits everywhere, structured logs with IDs, error tracking, basic analytics, feedback link, landing page, terms and privacy page, database backups (`docs/features/F10-hardening.md`).

**UI:** "Play vs Bot" and "Daily challenge" entry points, landing page.

**Tables:** `daily_challenges`, bot user row.

**Test gate**
- [x] A lone new user can play a full duel against the bot
- [x] Bot sometimes wins and sometimes loses; points follow decision D6
- [x] Daily challenge changes each day
- [ ] All 30 to 50 challenges pass with their reference solutions (tooling
      shipped: `challenge-verify.ts` — 8/8 of the current pool green; the
      count gate closes when the owner's 30–50 are authored + published)
- [x] Spam of submits, rooms, and signups is throttled
      (`f10-hardening-test.ts` 30/30: register 3/IP/h, room ops 10/user/min,
      bot 3/user/min, socket tokens 6/user/min, feedback 3 accepted/10 min)
- [x] Errors are logged with match, user, and submission IDs
      (pino logs carry the ids at every touchpoint; Sentry wired env-gated)
- [ ] Production secrets set, none in git; restoring from a backup works
      (no secrets in git verified by the gate + env examples updated; the
      restore rehearsal is the owner's ~10-minute Neon console action —
      runbook at `docs/ops/backup-restore.md`)
- [ ] You are comfortable sending the link to strangers

**Milestone:** soft launch to your college, friends, and coding communities. Collect feedback and numbers before building more.

---

### [ ] Iteration 5 — Growth (driven by real usage)
**Goal:** build what real users ask for.

**Features (order decided by feedback)**
- **F9 Random matchmaking and leaderboard:** queue behind a small interface (in-memory first). Start only when enough people are online at the same time.
- **F10 AI code analysis:** complexity estimate and suggestions, server-enforced daily cap, player code treated as untrusted text, never includes hidden tests or other players' code.
- **F11 UI polish:** full game-style look, animations, responsive and accessibility pass.
- **F12 More languages:** C++ and Java (starter code, Judge0 language IDs, time and memory multipliers, reference solutions for every challenge).

**Test gate (per feature)**
- [ ] F9: two strangers get paired; recently played challenges avoided; no one is paired with themselves
- [ ] F10: cap enforced on the server; oversized input rejected; prompt-injection attempts ignored; no hidden data in prompts
- [ ] F11: screens match the design; usable on mobile; keyboard and contrast checks pass
- [ ] F12: every challenge passes with a reference solution in each new language; time multipliers keep duels fair

---

## 5. Per-iteration checklist

- [ ] Features specced in `docs/features/`
- [ ] UI design files received and placed in `docs/ui/`
- [ ] Built on feature branches
- [ ] Test gate run, failures fixed
- [ ] Works on desktop and mobile widths
- [ ] No secrets or hidden test data exposed
- [ ] README, architecture, and data model updated if they changed
- [ ] CHANGELOG entry added
- [ ] Iteration report written in `docs/reports/project-report.md`
- [ ] Go / no-go decision recorded; status ticked here

## 6. Progress log

| Date | Iteration | Status | Notes |
|---|---|---|---|
| 2026-10-26 | — | — | Project started; plan and docs written |
| 2026-10-27 | 0 (F00) | Build + local test gate passed | Monorepo, server `/health` + DB connect, migrations, lint fixed; deployment pending owner accounts |
| 2026-10-27 | 0 (F00) | **Iteration 0 complete** | Deployed: web on Vercel, server on Render with DB; repo pushed to GitHub; merged to main |
| 2026-10-28 | 1 (F01) | Build + test passed | Live Google sign-in (redirect flow), session persistence + logout verified, DB hash-only storage verified, UI v2 (10 fixes) at 375/768/1440; production cookie check at deploy |
| 2026-10-28 | 1 (F02) | Build + test passed | Name edit (PATCH /api/me) + public profiles (/u/[id]) verified via API matrix and live UI round-trip; responsive at 375/768/1440 |
| 2026-10-28 | 1 (F03) | Build + test passed | Email + password accounts: scrypt hashing, rate limiting, migration 0002; API matrix + live form round-trip; Google avatar refresh on sign-in |
| 2026-10-28 | 1 (F02b) | Build + test passed | Own-photo upload: migration 0003 (`avatars`), PUT/DELETE `/api/me/avatar` + public serve, 256×256 client crop, upload beats Google photo; 14/14 API matrix + live UI round-trip + responsive; confirmed in real use |
| 2026-10-28 | 1 | Iteration complete - report written, merged to main | All account features shipped (F01 Google login, F02 profile, F02b avatar upload, F03 email login); `feature/F02b-avatar-upload` merged to `main` |
| 2026-10-29 | 2 (F04) | Build + test passed | Practice mode: migrations 0004–0005, Judge0 via free public CE endpoint (D4), function-call judging (decision 11 revised — owner wants return-value solutions), 8 seed challenges owner-signed-off and published; API matrix 35/35, UI smoke 21/21, prod build green |
| 2026-10-30 | 3 (F05/F06/F07) | **Iteration complete** | Friend duels: rooms + Socket.IO gateway, match engine (D5 points), history + repeat rule; gates: f05 48/48, engine 20/20, soak 62/62, restart 6/6, prod smoke 25/25; merged `88b92d3`; deployed + owner-reviewed |
| 2026-10-30 | 3 (review fixes) | Shipped | Loser's DEFEAT overlay could be missed → 4 s authoritative poll + self-healing handlers; guest lobby could strand → navigate from room_state + poll. Pushed `a13a667` |
| 2026-10-30 | 4 (F08/F09) | Iteration 4 started | Owner: bots first, randoms after (iteration 5). D5 floor restored (loser pays only what they have, DB CHECK 0010, owner account clamped); push `6342a82` |
| 2026-10-30 | 4 (F08) | Build + test passed | KERN BOT: migrations 0011 (bot plan on the match row) + 0012 (partial unique `users_is_bot_single` — fixed a 3-KERN race), `POST /api/duels/bot`, sweeper-executed plans (restart-safe), D6 zero deltas end-to-end; bot duel test matrix 29/29; throwaway accounts cleaned |
| 2026-10-30 | 4 (F09) | Build + test passed | Daily challenge: migration 0013 (`daily_challenges`), deterministic date-seeded pick with no-repeat (services/daily.ts), `GET /api/daily` (signed-out viewable), `/daily` page + countdown + header/practice entries; seed split into `seed-data.ts` and made re-run safe (skips existing slugs); `challenge-verify.ts` pool gate 8/8 via real Judge0; daily matrix 21/21; throwaways cleaned |
| 2026-10-30 | 4 (F09 streak) | Build + test passed | Owner-requested streak bar at the bottom of `/daily`: last 14 days, orange = daily solved, current + longest streak per player (accepted submits only; open today never breaks the run); matrix extended to 28/28 |
| 2026-10-30 | 4 (F10) | Build + test passed | Hardening: migration 0014 (`events` + `feedback`), one generic sliding-window limiter (register 3/IP/h, room ops 10/user/min, bot 3/user/min, socket tokens 6/user/min, feedback 3 accepted/10 min), owner-only counts + feedback list (OWNER_EMAILS), public real duels-played counter, brutalist landing + terms + privacy, profile feedback form (500 chars, drafts don't burn budget), env-gated Sentry (both apps, SDK not even loaded without a DSN), structured logs with match/user/submission ids, backup runbook `docs/ops/backup-restore.md`; burst assertions in the matrix (sequential slow requests slide out of a 60 s window); matrix 30/30; restore rehearsal = owner action in Neon console |

## 7. Backlog (parked, not in v1)

- Redis and a load balancer (only when running more than one game server)
- Job queue for AI feedback and runner calls
- Elo or Glicko ratings
- More languages beyond C++ and Java (Go, Rust)
- Challenges with several valid answers (needs custom checkers)
- Facebook login
- User-created challenges with review and validation
- Tournaments, seasons, chat, friend lists
- Payments and a paid tier (the AI cap is the natural hook)
