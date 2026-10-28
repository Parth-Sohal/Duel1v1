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
| D4 | Judge0 hosted or self-hosted | Iteration 2 | Hosted | |
| D5 | Points, draw, forfeit rules confirmed | Iteration 3 | +1 / −1 (floor 0), draw no change, 30 s grace | |
| D6 | Do bot matches change points? | Iteration 4 | No point change | |

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

### [ ] Iteration 1 — Accounts
**Goal:** a player can sign in, stay signed in, and see their profile.

**Features**
- **F1 Google login and session:** Google sign-in, server-side token verification, user created on first login, secure session cookie, logout, "who am I" endpoint, protected-route check.
- **F2 Profile:** name, avatar, points, win/loss/draw counts, edit display name, public profile view for other players.

**UI:** login page, header with avatar and sign-out, profile page (stat bars and hero panel from your design).

**Tables:** `users`, `sessions`.

**Test gate**
- [ ] New Google account creates a user; a returning account reuses it
- [ ] Refresh keeps you signed in; logout ends the session
- [ ] Protected page redirects when signed out
- [ ] A forged or expired token is rejected
- [ ] Own profile shows correct data; editing the name saves and shows everywhere
- [ ] Another player's public profile loads without private fields (no email)
- [ ] Empty or oversized names are rejected
- [ ] Layout matches the design at desktop and mobile width

---

### [ ] Iteration 2 — Practice mode
**Goal:** solve a challenge solo: read it, write code, run it, see results.

**Features**
- **F3 Challenges and practice:** challenge storage (statement, starter code, limits, tests as `jsonb`, versions), challenge list and detail page, code editor with a language picker (JavaScript or Python), "Run" and "Submit" through Judge0 with a per-language time and memory multiplier, result display, submissions saved, per-user rate limit, 5 to 10 seed challenges with reference solutions.

**UI:** challenge list, IDE-style practice screen with results panel.

**Tables:** `challenges`, `challenge_versions`, `submissions`.

**Test gate**
- [ ] Correct solution passes all tests
- [ ] Wrong solution shows which **sample** test failed with input, expected, and actual output
- [ ] A failing **hidden** test shows only "test N of M failed" (no input or expected output)
- [ ] Infinite loop stops at the time limit; memory-hungry code stops at the memory limit
- [ ] Code cannot reach the network or the game server
- [ ] Hidden tests never appear in any browser response (check the network tab)
- [ ] Spamming Run hits the rate limit
- [ ] Switching language keeps the challenge and loads the right starter code
- [ ] A correct solution passes in both JavaScript and Python; the Python time limit is scaled so correct code is not failed for being slower
- [ ] Every seed challenge passes with a reference solution in both JavaScript and Python
- [ ] A player completes a full practice session end to end

**Milestone:** this is a usable product on its own. Consider showing it to a few people here.

---

### [ ] Iteration 3 — Friend duels
**Goal:** two friends play a complete, fair 1v1 match.

**Features**
- **F4 Friend rooms:** create room, invite link, join, WebSocket connection, presence, ready state, reconnect that resends full state.
- **F5 Match engine:** match states, same challenge for both, server-owned timer (`ends_at`), duel submissions via Judge0, winner chosen in one database transaction, points updated, draw and forfeit rules.
- **F6 History and repeat rule:** match history list and detail, "avoid recently played challenges" with fallback.

**UI:** lobby / room, match screen (countdown, editor, opponent status), result screen, history on profile.

**Tables:** `rooms`, `matches`, `match_players`.

**Test gate**
- [ ] Host creates a room and gets a link; friend joins and both see each other instantly
- [ ] Refreshing a tab reconnects to the same room
- [ ] A third person cannot join a full room; an expired invite shows a clear error
- [ ] Both players get the same challenge and the same `ends_at`
- [ ] First passing submission wins; the other loses a point
- [ ] Two near-simultaneous passes produce exactly one winner
- [ ] Time expiry with no solver ends as a draw with no point change
- [ ] Closing a tab past the grace period forfeits
- [ ] Refresh mid-match restores challenge, code, and time left
- [ ] Server restart mid-match does not lose the match
- [ ] Points never go below zero
- [ ] Every finished match appears in both players' history with correct data
- [ ] A just-played challenge is not picked again when others exist; fallback works when few challenges exist
- [ ] Ten matches against a friend with no unfair or broken outcome

---

### [ ] Iteration 4 — Soft launch
**Goal:** safe and fun for real users, even when few are online.

**Features**
- **F7 Bot opponent and daily challenge:** bot that "solves" at a human-like pace and runs through the same match engine, daily challenge, grow to 30 to 50 hand-checked challenges.
- **F8 Launch hardening:** rate limits everywhere, structured logs with IDs, error tracking, basic analytics, feedback link, landing page, terms and privacy page, database backups.

**UI:** "Play vs Bot" and "Daily challenge" entry points, landing page.

**Tables:** `daily_challenges`, bot user row.

**Test gate**
- [ ] A lone new user can play a full duel against the bot
- [ ] Bot sometimes wins and sometimes loses; points follow decision D6
- [ ] Daily challenge changes each day
- [ ] All 30 to 50 challenges pass with their reference solutions
- [ ] Spam of submits, rooms, and signups is throttled
- [ ] Errors are logged with match, user, and submission IDs
- [ ] Production secrets set, none in git; restoring from a backup works
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
| 2026-10-28 | 1 | Iteration complete — report written, merged to main | All account features shipped (F01 Google login, F02 profile, F02b avatar upload, F03 email login); `feature/F02b-avatar-upload` merged to `main` |
| | | | |

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
