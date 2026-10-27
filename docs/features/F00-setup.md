# F00 — Project setup and foundation

Status: tested (local gate passed; deployment pending owner accounts)
Branch: feature/F00-setup
Depends on: none

## Goal

An empty but running monorepo: anyone can clone it, follow the README, and get the web app and the game server (with `/health` and a database connection) running locally.

## Scope

- In: repo layout matching `DOCUMENT_STRUCTURE.md`, Next.js web app, Node game server skeleton with `/health`, Drizzle + PostgreSQL connection and migration tooling, environment config, lint and format, `.env.example`, README, CHANGELOG.
- Out (not now): deployment, auth, challenges, any UI beyond the placeholder home page.

## UI

- None. Placeholder home page only.

## Behavior

- `npm install` at the root installs all workspaces (`apps/web`, `apps/server`, `packages/shared`).
- `npm run dev --workspace apps/web` starts the web app on port 3000.
- `npm run dev --workspace apps/server` starts the game server on port 4000 with a `GET /health` endpoint returning `{ "status": "ok" }`.
- `npm run db:migrate` applies migrations to the database in `DATABASE_URL`.
- Iteration 0 migration creates the `pgcrypto` extension and the schema enums (per `docs/data-model.md` §7).

## API / events

- REST: `GET /health` — liveness probe, no auth.

## Data

- First migration only: `CREATE EXTENSION pgcrypto` and enums `difficulty`, `room_status`, `match_status`, `match_result`, `submission_kind`, `submission_status`. Tables arrive with their iterations.

## Rules and safety

- No secrets in git; `.env.example` lists variable names only.
- No business logic outside `apps/server/src/services/` (none yet).

## Test checklist

- [x] Fresh `npm install` works from a clean clone (verified on this machine; remote clone pending — repo not pushed yet)
- [x] Web app runs locally and shows a page
- [x] Game server runs locally and `GET /health` returns OK
- [x] Server connects to the database; first migration applies
- [x] No secrets in git; `.env.example` lists the variable names
- [x] Lint passes (web ESLint config updated to ignore `.next/` build output)

## Sign-off

- Tested on: 2026-10-27
- Issues found and fixed:
  - Web ESLint was scanning Next.js build artifacts (`.next/**`, `next-env.d.ts`) and failing with ~100 errors. Fixed by adding `ignores` to `apps/web/eslint.config.mjs`.
  - First migration lacked `CREATE EXTENSION pgcrypto` required by `F00`; added to `drizzle/0000_lean_luckman.sql` before applying.
- Follow-ups moved to backlog:
  - Deployment to Vercel/Railway (needs owner accounts) — last open item of the Iteration 0 gate.
