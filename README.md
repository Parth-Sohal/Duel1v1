# Coding Arena

Two players get the same coding challenge and race to solve it in 10 minutes. First to pass all tests wins a point; the other loses one.

## What is in this repo

| Path | What it is |
|---|---|
| `apps/web` | Next.js frontend (Next.js + TypeScript) |
| `apps/server` | Node game server (TypeScript, REST + Socket.IO, match referee) |
| `packages/shared` | Types and constants shared by both apps |
| `docs/` | Project docs: description, architecture, data model, features, decisions, reports |
| `seed/challenges/` | Challenge content: statement, tests, reference solution |
| `scripts/` | Utilities (seed scripts, checks) |

Read `PLAN.md` for what we build and in what order; `DOCUMENT_STRUCTURE.md` explains where everything lives.

## Requirements

- Node.js 20+ (tested with 24)
- npm 10+
- A PostgreSQL database (Neon connection string) for the server

## Setup (fresh clone)

1. Install everything:

   ```bash
   npm install
   ```

2. Create the server env file: copy `.env.example` to `apps/server/.env` and fill in `DATABASE_URL` (your Neon connection string).

3. Apply database migrations:

   ```bash
   npm run db:migrate
   ```

## Run locally

```bash
# Terminal 1 — web app on http://localhost:3000
npm run dev:web

# Terminal 2 — game server on http://localhost:4000
npm run dev:server
```

Check `GET http://localhost:4000/health` — it returns `{"status":"ok", ...}` including database connectivity.

## Useful commands

| Command | What it does |
|---|---|
| `npm run db:generate` | Generate SQL migrations from `apps/server/src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to the database in `DATABASE_URL` |
| `npm run db:studio` | Open Drizzle Studio to inspect the database |
| `npm run lint` | Lint all workspaces |
| `npm run build` | Build all workspaces |

## Rules of the project

- The server is the referee: the browser displays, it never decides winners, scores, or time.
- Player code never runs on the game server — only in the Judge0 sandbox.
- Hidden test cases never leave the server.
- No secrets in git: `.env` files are ignored; `.env.example` lists the names.
