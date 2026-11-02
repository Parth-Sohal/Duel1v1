# Changelog

## [2026-10-30] Iteration 4 — Soft launch (KERN bot, daily challenge, hardening)
- Added: **KERN BOT** — `POST /api/duels/bot` seats the house bot for a lone player; the bot's plan is decided once at match start and stored on the match row (migrations 0011 + 0012 partial-unique `users_is_bot_single` fixing a 3-KERN race), executed by the sweeper — restart-safe, no Judge0 calls, no submissions. D6: no points, no stats, history labeled "vs KERN". Bot matrix 29/29
- Added: **daily challenge** — deterministic date-seeded pick (FNV-1a over `day:salt`, `DAILY_SALT` env) cached in `daily_challenges` (migration 0013) so restarts never change a day's pick; no repeats while fresh entries exist; `GET /api/daily` viewable signed-out; `/daily` page + countdown + header/practice entries; seed loader now skips existing slugs (was delete-and-reinsert, which cascaded real player submissions); pool gate 8/8 via real Judge0; daily matrix 21/21
- Added: **streak bar** (owner request) — last 14 days on `/daily`, orange = that day's daily solved (accepted submits only), current + longest streak; open-today-unsolved never breaks the run; `streaks: null` signed-out; matrix 28/28
- Added: **launch hardening** — migration 0014 (`events` + `feedback`); one generic sliding-window limiter for register (3/IP/h), room ops (10/user/min), bot duels (3/user/min), socket tokens (6/user/min), feedback (3 accepted/10 min — rejected drafts don't burn the budget, validation runs first); append-only analytics events (fire-and-forget, ids + coarse facts only); owner-only counts + feedback list (`OWNER_EMAILS` guard); public real duels-played counter; brutalist landing page + `/terms` + `/privacy` signed-out; profile feedback form (500-char cap); env-gated Sentry in both apps (no DSN → SDK never loads; `sendDefaultPii` removed — not in the SDK types, PII off by default); structured logs with `matchId`/`userId`/`submissionId` everywhere; backup runbook `docs/ops/backup-restore.md` (Neon PITR, 6 h free-plan window — rehearsal is an owner action); F10 matrix 30/30 (limits burst-tested concurrently — sequential slow requests legitimately slide out of a 60 s window)

## [2026-10-30] Review feedback: result overlays + points floor
- Fixed: the losing player could miss the DEFEAT overlay — it depended on a single socket event + a single fetch with no retry. MatchWorkbench now polls REST (authoritative) every 4 s while the duel is live and undecided, survives transient fetch failures, and computes the point delta from the match row when the deltas payload is absent. RoomLobby now navigates to the match from `room_state` (in_match + matchId), not only the `match_started` event, and polls while both players are seated
- Changed: **points are floored at 0** (owner decision, revises D5's "no floor") — a poor loser pays only what they have and lands on 0; the winner always takes the full +29…31 swing; draw/forfeit penalties floored the same way. `finishMatch` now returns the applied per-player deltas, which the submit response and all socket broadcasts use verbatim. DB guarantee re-added: `users.points >= 0` CHECK (migration 0010); the owner's account (−30 from review play) clamped to 0 retroactively
- Verified: engine test updated (floor rule: 5-point loser → 0, winner takes full swing, applied deltas clamped); soak asserts "loser pays what they have, never negative" per round; f05 matrix + prod smoke seed both players with 100 points so the full mirrored swing stays exercised

## [2026-10-30] F05/F06/F07 — Friend duels (built + tested)
- Added: friend rooms — `POST /api/duels/rooms` (8-char Crockford invite code, I/L/O-normalized, case-insensitive), member-only room state, join with `room_full`/`already_in_match` guards, leave, host start (REST + socket); migrations 0006–0009 (`rooms` + `guest_id`/`ready_state`/`difficulty`, `matches` + `swing_points`/CHECKs, `match_players`, `submissions.match_id`, winner FK → cascade)
- Added: Socket.IO gateway — one-time short-lived socket tokens (`GET /api/duels/socket-token`), presence dots, authoritative `room_state` resends, `match_started`/`progress`/`match_ended` broadcasts, disconnect grace marking
- Added: match engine — one transaction creates the duel (repeat-avoiding challenge pick, randomized swing locked at start, server-owned `ends_at`); first accepted submit wins via a conditional update (exactly one winner under concurrency); D5 points in the same transaction (win +29…31/−same, draw −10 both, forfeit +10/−10, no floor); sweeper on boot + every 5 s (draws, forfeits, expired rooms) so restarts never lose a match
- Added: history — `GET /api/matches` (own, newest first, active pinned, limit/offset) + participant-only detail (challenge via visible tests, before/after points, own latest code; opponent code never included)
- Added: UI — `/duel` launcher (PICK A DUEL + difficulty chips), `/duel/[code]` lobby (presence dots, ready toggles, COPY invite, host START), `/match/[id]` workbench (countdown, opponent progress, VICTORY./DEFEAT./DRAW./FORFEIT. overlay with delta), profile MATCH HISTORY block, PLAY nav link
- Fixed: invite-code generator could emit I/L/O (lookups normalize them → room unjoinable); concurrent READY toggles could erase each other (now an atomic jsonb merge); socket join now normalizes codes like REST; Neon pool gained TCP keepalive against half-open connection hangs
- Verified: `f05-api-test.ts` 48/48, `f06-engine-test.ts` 17/17, `f06-soak-test.ts` 52/52 (ten real Judge0 duels, alternating winners), restart gate 6/6; server tsc + lint green

## [2026-10-29] F04 — Practice mode (built + tested + owner-signed-off)
- Added: solo practice — `/practice` (challenge roster with solved markers) and `/practice/[slug]` (statement + samples on cream, workbench on dark: JS/PY language chips with per-language scratchpads, monospace editor with tab indent, RUN + SUBMIT, expandable per-test results); PRACTICE nav link added
- Added: judging model (decision 11, revised by owner) — the player writes a named function and **returns** the answer; the server's harness calls it with JSON arguments and compares the returned value (JS `JSON.stringify` ≡ Python tight `json.dumps`, so both languages agree byte-for-byte)
- Added: Judge0 execution via the free public CE endpoint `https://ce.judge0.com` (decision D4, no key; env-only swap to self-hosted later); player code only ever runs in the judge sandbox — network access from submissions verified blocked
- Added: 5 s base CPU limit (Python ×1.5) + 1 s grace — absorbs load spikes on the shared free endpoint; memory 256 MB (OOM kill verified); per-user rate limit 20 Run+Submit per 5 min
- Added: data — migrations 0004 (`challenges`, `challenge_versions`, `submissions`) + 0005 (`entry_functions`); immutable challenge versions; solved state derived from submissions
- Added: 8 original seed challenges (owner-signed-off and published) — pair-target-sum, reverse-words, first-duplicate, max-window-sum, bracket-check, climb-stairs, rotate-array, missing-number — each with reference solutions in JS + Python; expected answers frozen by running the references through the real harness (82/82, both languages agree)
- Verified: API matrix 35/35 (`f04-api-test.ts`: hidden-test leak checks, run/submit verdicts incl. time limit / runtime error / syntax error, rate limit, validation) + UI smoke 21/21 through the real web proxy + owner live sessions; hidden tests never reach the browser (detail, results, SSR HTML, stored submissions all redacted); lint + production build clean
- Parked: challenge authoring UI, batched judge calls, practice history panel (API exists), Redis-backed rate limiting

## [2026-10-28] F02b — Avatar upload (built + tested, local)
- Added: `PUT /api/me/avatar` (upload own photo) and `DELETE /api/me/avatar` (remove) — the client center-crops to a 256×256 JPEG on canvas before upload; the server still re-validates the data URL, MIME allowlist (jpeg/png/webp), magic bytes, and a 150 KB decoded cap (400 invalid / 413 too large)
- Added: `avatars` table (migration 0003, base64 bytes in our own DB — no third-party storage) and public `GET /api/users/:id/avatar` (correct Content-Type, 60 s cache, versioned `?v=` URL busts caches on re-upload)
- Added: profile-page CHANGE PHOTO / REMOVE controls (`AvatarEditor`); upload always wins over the Google photo — sign-in refresh skips any local `/api/...` avatar URL
- Fixed: `Avatar` renders images with `loading="eager"` — avatars are tiny (3–4 KB) and always above the fold; lazy loading never painted them in testing
- Verified: 14/14 API matrix (upload, serve bytes, re-upload bumps version, renamed non-image 400, oversize 413, no-auth 401, unknown id 404, public profile carries avatarUrl but never email, remove → 404) + live UI round-trip (upload → remove → letter block → re-upload) + responsive 375/768/1440 (zero overflow); confirmed in real use — a live account uploaded and its avatar serves publicly; lint + production build clean
- Parked: crop/zoom UI, object-storage migration if avatars grow

## [2026-10-28] F03 — Email + password login (built + tested, local)
- Added: manual accounts — `POST /api/auth/register` (auto sign-in) and `POST /api/auth/login`; scrypt password hashing (node:crypto, salted, params in the hash string, timing-safe compare); `credentials` table (migration 0002, one password per account)
- Added: login page email form with Sign in / Create account toggle (display name only in create mode); same 30-day session/profile as Google sign-in
- Added: server-side rate limiting — 8 failed logins per 15 min per email and per IP → 429; success clears the email count
- Verified: 20-check API matrix (validation, 409 dup, generic 401s, no plaintext password in DB, rate limit) + live form round-trip; lint + production build clean
- Parked: email verification + password reset (needs an email provider), account linking, Redis-backed rate limiting

## [2026-10-28] F02 — Profile (built + tested, local)
- Added: `GET /api/me`, `PATCH /api/me` (display-name edit, server-side 2–30 validation, `updated_at` bump), `GET /api/users/:id` (public fields only, 404 unknown/bad id)
- Added: profile page avatar + inline name editor (char counter, save/cancel, live header sync); public profile `/u/[id]` (read-only, designed not-found state); header avatar chip
- Verified: full API matrix (400 invalid names, 401 no cookie, 200 valid trim, 404 unknown) + live UI edit round-trip + responsive 375/768/1440 (no overflow/overlap)
- Refactor: single `publicUser` mapping in `services/users.ts` — email/google_id provably never serialized

## [2026-10-28] F01 — Google login and session (tested, local)
- Added: live Google sign-in via OAuth redirect flow (`response_type=id_token`), `/auth/callback` with `state` CSRF guard; GIS iframe replaced so the primary button has native hover/focus states
- Added: session persistence verified end-to-end — refresh keeps session, logout deletes the `sessions` row and clears the cookie, protected pages redirect when signed out
- Verified: DB stores only the SHA-256 token hash (64 hex chars, never the raw token); returning accounts reuse their user row (no duplicates)
- Fixed: UI v2 — 10 owner-reported issues (panel overlap, nav collision, AA contrast, hierarchy, stat row, primary CTA, designed empty states); responsive verified at 375/768/1440
- Pending: verify cookie `Secure` flag at production deploy

## [2026-10-27] Iteration 0 — complete
- Deployed: web on Vercel (https://duel1v1.vercel.app), game server on Render (https://duel1v1.onrender.com/health)
- Added: GitHub remote (main + feature/F00-setup); iteration report written
- Decision: go to Iteration 1 (Accounts)

## [2026-10-27] F00 — Project setup and foundation (local gate passed)
- Added: monorepo structure (`apps/web`, `apps/server`, `packages/shared`), docs restructured to the standard layout
- Added: Next.js web app, Node game server with `/health`, Drizzle migration tooling
- Added: first migration `drizzle/0000_lean_luckman.sql` — `pgcrypto` extension + six schema enums; applied to the database
- Fixed: web ESLint now ignores Next.js build output (`.next/`, `next-env.d.ts`); lint passes
- Known issues: deployment to Vercel/Railway pending (needs owner accounts)
