# Backup & restore runbook (F10)

Status: runbook (2026-10-30)
Owner action required: the restore rehearsal itself — everything else is already in place.

## What we have

- **Database:** a single Neon PostgreSQL instance (free plan), referenced by
  `DATABASE_URL` in apps/server and by the Neon integration on Render.
- **Backups:** Neon free plan keeps **point-in-time restore (PITR) history for
  6 hours** and a daily snapshot window — history restores any moment in the
  last 6 hours to a new branch. This is our backup. Nothing is stored on our
  machines, so nothing on our machines can be lost.
- **What else exists:** the full schema is reproducible from git
  (`apps/server/drizzle/` migrations, applied in order) and the app data that
  matters (challenges, players, submissions, matches, events, feedback) lives
  only in Neon.

## What to do when something breaks

### 1. Stop the bleeding

- Render → the server service → **Suspend** (or it keeps writing to a broken DB).
- If the cause was a bad deploy: Render keeps the previous deploy — roll back
  from the deploy list first, decide about the DB after.

### 2. Restore (Neon console, ~5 minutes)

1. Neon console → the project → **Time travel / restore**.
2. Pick a timestamp **before** the damage (if unsure, pick the last moment the
   game was known-good — e.g. right before the bad deploy).
3. Restore target: **new branch** (never overwrite the original until the new
   one is verified). Neon names it something like `restore-2026-10-30`.
4. Copy the new branch's connection string.

### 3. Verify before cutover

Against the restored branch (psql or Neon's SQL editor):

```sql
SELECT count(*) FROM users;            -- player rows intact?
SELECT count(*) FROM matches;          -- history intact?
SELECT max(created_at) FROM submissions;  -- how fresh is the data?
SELECT count(*) FROM daily_challenges;    -- daily picks intact?
```

Then point a local server at it and play one practice submit end-to-end.

### 4. Cutover

- Render → server → Environment → set `DATABASE_URL` to the restored branch's
  pooled connection string → save (this restarts the service).
- Unsuspend the service. Play one duel. Done.

### 5. Afterward

- Once confident, the old branch can be deleted (or kept a day as insurance).
- Restore the old `DATABASE_URL` naming conventions — everything else in the
  stack reads the one variable.

## The rehearsal (owner action, ~10 minutes)

The plan above is only proven if it has been walked through once. In the Neon
console:

1. Note the current `duels_played`-ish counts (`SELECT count(*) FROM events;`).
2. Run a restore to a new branch from ~1 hour ago.
3. Compare counts, then delete the restored branch.

If that worked, this runbook is proven. No data was touched in production.

## Limits to know

- **6-hour PITR window** on the free plan: a corruption noticed 7 hours later
  is only restorable to 6 hours ago (one hour of writes lost). If the arena
  ever becomes something worth more, the first paid Neon tier extends PITR to
  7 days — that is the upgrade to buy.
- **Render disk is disposable:** logs and env vars live there, but no durable
  state. Nothing on Render needs backing up; redeploying from git rebuilds it.
- **Secrets are not in the DB:** `DATABASE_URL`, `GOOGLE_CLIENT_ID`, Judge0 —
  all env vars. Documented in `apps/server/.env.example`. If the project were
  lost entirely, a fresh clone + env vars + migrations rebuilds everything.
