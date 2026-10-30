# F10 — Launch hardening (safe to send to strangers)

Status: spec (2026-10-30)
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

- [ ] Spam of submits, rooms, signups, and bot matches is throttled (429s with
      clear errors; limits verifiable in tests)
- [ ] Errors are logged with match, user, and submission IDs (a forced error
      shows all three in the logs)
- [ ] Production secrets set, none in git (env audit against `.env.example`)
- [ ] Restoring from a backup works (rehearsed on the Neon branch, documented)
- [ ] Landing page, terms, privacy reachable signed-out; feedback form saves
- [ ] You are comfortable sending the link to strangers (owner's final call)
