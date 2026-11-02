# F10 — Launch hardening (safe to send to strangers)

Status: built (2026-10-30); test matrix 30/30
Branch: feature/F10-hardening
Depends on: everything
PLAN reference: Iteration 4, "Launch hardening"

## Goal

The product survives real traffic and real abuse, and the owner can see what is
happening: rate limits everywhere, logs that answer "what happened in match X",
error tracking, a real landing page, legal pages, and proven backups.

## Scope

- In:
  - **Rate limits** (in-memory limiter utility, per key + window): register
    (per IP), room create/join/start (per user), bot matches (per user),
    socket tokens (per user), feedback (per user). The existing judge limiter
    (20/5 min) and login limiter (8/15 min) stay.
  - **Structured logs with IDs**: every match/user/submission touchpoint logs
    with `matchId`, `userId`, `submissionId` fields where known; request logs
    carry the Fastify request id. No PII beyond ids.
  - **Error tracking**: Sentry (free tier) in both apps — server errors with
    request context, web errors via the browser SDK. Wired through env vars;
    without a DSN the app runs exactly as today.
  - **Basic analytics**: an `events` table (signup, match_started, match_type,
    submit, daily_view, feedback) written server-side; an owner-only counts
    endpoint. No third-party analytics in v1.
  - **Feedback link**: header/footer button → small form (max 500 chars, rate
    limited) → `feedback` table. The owner reads them in the DB.
  - **Landing page**: brutalist hero — what the game is, PLAY (duel), PRACTICE,
    TODAY'S CHALLENGE, PLAY VS KERN; live "duels played" counter from events.
  - **Terms & privacy**: static honest pages (no ads, no tracking beyond the
    analytics above, accounts store email + display name).
  - **Backups**: Neon point-in-time restore; an ops runbook doc
    (`docs/ops/backup-restore.md`) + a verified restore rehearsal (the gate).
- Out (not now): third-party analytics, status page, Redis-backed limiters
  (single server until scale demands it), CSRF beyond SameSite cookies
  (already Lax + same-origin proxy).

## Test checklist (PLAN gates)

- [x] Spam of submits, rooms, signups, and bot matches is throttled (429s with
      clear errors; limits verifiable in tests)
      (`scripts/f10-hardening-test.ts`: register 3/IP/h, room ops 10/user/min,
      bot 3/user/min, socket tokens 6/user/min, feedback 3 accepted/10 min —
      each bursts past its limit and asserts the exact allowed + 429 split;
      rejected feedback drafts do NOT burn the budget — validation runs first)
- [x] Errors are logged with match, user, and submission IDs (a forced error
      shows all three in the logs)
      (pino logs carry `matchId`/`userId`/`submissionId` at every match and
      submission touchpoint; duel + practice judged logs verified during the
      gate; Fastify request ids ride along on every line)
- [x] Production secrets set, none in git (env audit against `.env.example`)
      (gate asserts `git check-ignore` on `.env` files and that only
      `.env.example` files are tracked; new vars documented:
      `OWNER_EMAILS`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `DAILY_SALT`)
- [ ] Restoring from a backup works (rehearsed on the Neon branch, documented)
      (runbook written at `docs/ops/backup-restore.md`; the rehearsal itself is
      an owner action in the Neon console — ~10 minutes, touches no prod data)
- [x] Landing page, terms, privacy reachable signed-out; feedback form saves
      (`/`, `/terms`, `/privacy` render 200 signed-out; feedback saves with a
      500-char cap; the owner reading list and counts endpoints 403 non-owners)
- [ ] You are comfortable sending the link to strangers (owner's final call)

## How it was built (implementation notes)

- **One generic limiter** (`services/rate-limit.ts`): a sliding-window factory
  keys an in-memory `Map`; five exported limiters share it. Same single-instance
  tradeoff as the existing login/judge limiters — Redis is the scaling backlog.
- **Events are fire-and-forget**: `recordEvent` swallows insert failures —
  analytics must never break gameplay. Events store ids + coarse facts only
  (`matchType`, `slug`, `method`); no PII beyond ids, no code, no IPs.
- **Owner guard**: `UserPublic` deliberately has no email, so the counts and
  feedback-list endpoints look the caller's email up from the DB and compare
  against `OWNER_EMAILS` (comma-separated). Non-owners get 403.
- **Sentry is env-gated twice over**: with no DSN the SDK is never even
  imported (`sendDefaultPii` removed from both inits — not in the SDK types;
  PII is off by default and nothing extra is attached). Server:
  `@sentry/node` via `services/observability.ts` + an `onError` hook + sweeper
  capture. Web: `instrumentation.ts` with `register`/`onRequestError`.
- **Landing counter is real**: `GET /api/stats/public` counts `match_started`
  events; the page shows `—` if the endpoint is down rather than a fake number.
  Signed-out visitors get the full landing + legal pages; signed-in users are
  redirected to `/profile`.
- **Test matrix** (`scripts/f10-hardening-test.ts`, 30 checks): exercises the
  real server + Neon. Burst assertions are made **concurrently** — with remote
  Neon latency, sequential slow requests can legitimately slide out of a 60 s
  window before reaching the cap; a burst models real abuse better anyway.
  Cleanup removes every row the gate created (events → match → users, FK-safe).
