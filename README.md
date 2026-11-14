# Coding Arena

Two players get the same coding challenge and race to solve it in 10 minutes. The first submission that passes every test wins the match; the other player loses the same points. The **server is the referee** — browsers display state, they never decide winners, scores, or time.

**Live:** [duel1v1.vercel.app](https://duel1v1.vercel.app) · API: [duel1v1.onrender.com/health](https://duel1v1.onrender.com/health)

## What players can do

- **Practice** — 40 hand-checked challenges in JavaScript, Python, Java and C++, run or submit through Judge0, with sample-test feedback while hidden tests stay server-side.
- **Friend duels** — create a room, share an 8-character invite code, ready up, and play a live 1v1 with server-owned time.
- **Anyone matchmaking** — join the real queue and the server pairs you with the next compatible human. No bots, no invented opponents.
- **KERN bot** — practice against the house bot through the same match engine. Bot duels move no points and count no stats.
- **Daily challenge** — the same challenge for everyone each day, with a 14-day streak bar.
- **Rankings** — a public ladder built from real `users.points`, with last-five form and your own rank when signed in.
- **Profiles and history** — editable display name, avatar upload, public profiles, and full match history with point deltas.
- **AI code review** — opt-in hints and complexity feedback on your own code when the server has a Gemini key configured.

## Architecture at a glance

```text
          Browser (Next.js on Vercel)
   pages · editor · countdown · Socket.IO client
        │                                  │
        │ /api/* same-origin proxy         │ Socket.IO (direct, one-time token)
        ▼                                  ▼
   ┌─────────────────────────────────────────────────┐
   │       Game server (Fastify + Socket.IO)         │
   │  auth · rooms · match engine · queue · judge    │
   │  points · leaderboard · daily · AI · sweeper    │
   └──────┬────────────┬─────────────┬───────────────┘
          ▼            ▼             ▼
    Neon Postgres   Judge0       Gemini API
    (all durable    (sandbox     (optional AI
     state)          code run)    review)
```

The web app lives on Vercel; the game server lives on Render because it needs long-lived WebSocket connections. PostgreSQL (Neon) holds all durable state, so the game server can restart without losing a match.

**Why the split traffic path:** browser calls to `/api/*` are rewritten by Next.js to `API_ORIGIN`, which keeps the session cookie first-party (Safari blocks third-party cookies). Live sockets connect directly to `NEXT_PUBLIC_GAME_WS_URL` after the browser trades the session for a short-lived, one-time socket token.

### Components

| Component | Technology | Responsibility |
|---|---|---|
| Web app | Next.js 15, React 19, TypeScript, Tailwind CSS 4 | Pages, editor, countdown display, socket client. Decides nothing |
| Game server | Node, Fastify 5, Socket.IO 4, Drizzle ORM | Auth, rooms, match engine, timer, judging, points, queue, leaderboard, rate limits |
| Database | PostgreSQL (Neon) | Users, sessions, challenges, rooms, matches, submissions, reviews, events |
| Code runner | Judge0 (hosted CE endpoint) | Runs submitted code against tests in a sandbox; player code never runs on the game server |
| AI review | Google Gemini | Hints, complexity, and quality suggestions on opt-in code reviews |
| Identity | Google OAuth + email/password accounts | Verified server-side; session stored as a secure, HTTP-only cookie |
| Hosting | Vercel (web), Render (server), Neon (database) | Production deployment |

### The arc of one duel

1. **Entry** — a player creates a friend room, joins the ANYONE queue, or seats KERN. In every case the server creates a normal `matches` row; only quick matches have `room_id = NULL`.
2. **Match creation** — one transaction picks a published challenge, stores `ends_at = now + 10 min`, locks a randomized point swing, and seats both players. The challenge pick avoids what either player solved in their last 3 matches, with fallbacks when the pool is thin.
3. **Live play** — the browser counts down to `ends_at`, but the server is the clock. Socket.IO pushes presence, progress, and results; a 4-second REST poll is the fallback when a socket event is missed.
4. **Submission** — the browser sends code to the game server, which loads the challenge version's tests and sends a batch to Judge0. Hidden tests never appear in any browser response.
5. **Finish** — the first accepted submission wins through a conditional update inside one transaction: winner, points, and history change together. Exactly one winner survives near-simultaneous passes.
6. **Fallbacks** — a 5-second sweeper (also run on boot) finishes draws at the deadline, forfeits players gone past the 30-second grace, closes expired rooms, and executes KERN's plan. Restarting the server cannot strand a match.

### Request path (REST)

```text
Browser → Next.js /api/* rewrite → Fastify route
        → auth preHandler (session cookie, hashed lookup)
        → service function → Drizzle → PostgreSQL
        → JSON response
```

The browser never receives hidden tests, another player's code, or private profile fields. Expensive operations are rate-limited and logged with `userId`, `matchId`, and `submissionId` where relevant.

### Live path (Socket.IO)

```text
Browser → GET /api/duels/socket-token (session cookie)
        → Socket.IO connect with one-time token
        → room:<id> / match:<id> channels
        → room_state · match_started · progress · match_ended · room_closed
```

The client emits `room:join`, `room:ready`, `room:leave`, `match:start`, and `match:join`; the server emits `room_state`, `room_error`, `room_closed`, `match_started`, `progress`, and `match_ended`. Match state is re-sent on reconnect because the database — not the socket — is authoritative.

### Random matchmaking (ANYONE)

```text
POST /api/duels/matchmaking  → enter queue (idle | searching | matched)
GET  /api/duels/matchmaking  → heartbeat + status poll
DELETE /api/duels/matchmaking → leave queue

every 2 s: pairing pass → compatible pair → create normal match → both clients navigate
```

- One entry per player; `ANY` pairs with every difficulty, while two concrete difficulties must match. The match uses the concrete side.
- No self-pairing, no duplicate live duels, and the repeat rule still applies.
- Silent entries prune after 30 seconds; a search caps at 5 minutes; matched results stay recoverable for 5 minutes.
- Paired players are reserved as `pairing` while the database insert runs, so a slow insert cannot make the UI report a false `idle`.
- The queue is process memory behind a small `MatchmakingQueue` interface. Match rows are durable, so running more than one game server only requires moving the queue to Redis — no match-engine change.

### Practice and judging

```text
POST /api/challenges/:slug/run|submit
  → validate size and rate limit
  → load challenge version + tests
  → batch to Judge0
  → compare returned values (JS JSON.stringify ≡ Python tight json.dumps ≡ Java/C++ harness JSON)
  → visible tests: input/expected/actual shown
  → hidden tests: only "test N of M failed"
```

Player code is wrapped in a function-call harness: the player writes a named function and returns the answer, and the harness calls it with JSON arguments. Java and C++ use a typed signature (numbers are 64-bit `long` / `long long`) but the same JSON contract. Code runs only in the Judge0 sandbox with CPU, memory, process, and output limits; network access is blocked.

### Leaderboard

`GET /api/leaderboard` is public with optional auth. It ranks eligible humans by real `users.points` (ties: wins, then display name, then id), returns the top 30 plus the signed-in viewer's own rank even outside the top 30, and attaches last-five W/L/D form from finished human matches. Bots and players with no finished human duel are excluded.

### Daily challenge and KERN

- The daily pick is deterministic: FNV-1a over `day:salt`, cached in `daily_challenges` on first request, so a restart or clock skew cannot change today's challenge. The pool is the published challenge set, with no repeats while fresh entries exist.
- KERN's plan (win, draw, or a visible failing attempt) is chosen once at match start and stored on the match row; the sweeper executes it. No Judge0 calls, no submissions, no points, no stats.

### AI code review

Opt-in only. The server sends Gemini the challenge statement, visible sample tests, and the player's own code — never hidden tests or another player's code. Player code is fenced and marked as untrusted data, output is parsed defensively, and a durable 3-per-player-per-UTC-day cap lives in `ai_reviews`. Without `GEMINI_API_KEY` the feature stays off and the web UI hides it.

## Points and rules

| Event | Points |
|---|---|
| Win | Winner gains a random 29–31; loser pays the same |
| Draw (time up, nobody solved) | Both lose 10 |
| Forfeit (gone past 30 s grace) | Stayer gains 10; leaver loses 10 |
| Bot duel | No change, no stats |

- Points are **floored at 0**: a player pays only what they have; a winner still takes the full swing.
- The server stores `ends_at` and owns the clock; the browser only displays the countdown.
- Ties on submission are broken by server arrival time, not by which judge result returned first.
- Challenge versions are immutable; a match points to the exact version used.

## Data model

| Table | Holds |
|---|---|
| `users`, `sessions`, `credentials`, `avatars` | Accounts, hashed session tokens, email/password hashes, uploaded photos |
| `challenges`, `challenge_versions` | Slug, metadata, immutable statement/tests/starter code |
| `rooms` | Friend-room state, code, seats, readiness, difficulty |
| `matches`, `match_players` | One authoritative match row: challenge version, `ends_at`, status, result, swing; per-seat progress |
| `submissions` | Practice and duel submissions with judged status and code |
| `daily_challenges` | The cached challenge for each UTC day |
| `ai_reviews` | Durable AI usage rows for the daily cap |
| `events`, `feedback` | Analytics events and player feedback |

Full schema and rules: [`docs/data-model.md`](docs/data-model.md).

## Repository layout

| Path | What it is |
|---|---|
| `apps/web` | Next.js app: landing, login, practice, daily, duel launcher, lobby, match workbench, leaderboard, profiles |
| `apps/server` | Fastify + Socket.IO referee: routes, services, match engine, judging, queue, sweeper |
| `packages/shared` | Shared types, constants, point rules, and queue contracts |
| `apps/server/src/db` | Drizzle schema, database connection, and queries |
| `apps/server/drizzle` | SQL migrations, one set per feature |
| `seed/challenges/` | Challenge authoring format and seed content notes; definitions live in `apps/server/scripts/seed-data*.ts` |
| `apps/server/scripts/` | Seed, publish, verification, and per-feature test gates |
| `docs/` | Description, architecture, data model, feature specs, decisions, reports, UI references |
| `PLAN.md` | What we build and in what order |

## Requirements

- Node.js 20+ (tested with 24)
- npm 10+
- PostgreSQL (a Neon connection string works)

## Setup (fresh clone)

1. Install everything:

   ```bash
   npm install
   ```

2. Create the env files:

   ```bash
   cp apps/server/.env.example apps/server/.env
   cp apps/web/.env.example apps/web/.env.local
   ```

   Fill in `DATABASE_URL` in `apps/server/.env`. Everything else is optional for local play:

   | Variable | Where | Default / purpose |
   |---|---|---|
   | `DATABASE_URL` | server | Required PostgreSQL connection string |
   | `PORT` | server | `4000` |
   | `CORS_ORIGIN` | server | `http://localhost:3000` |
   | `GOOGLE_CLIENT_ID` | both | Enables Google sign-in (email/password still works without it) |
   | `JUDGE0_API_URL` | server | Defaults to the free hosted `https://ce.judge0.com` |
   | `DAILY_SALT` | server | Any non-empty string; names the deterministic daily pick |
   | `GEMINI_API_KEY` | server | Enables AI review; absent means the feature stays off |
   | `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | server / web | Enables error tracking; absent means Sentry never loads |
   | `OWNER_EMAILS` | server | Comma-separated emails allowed to read analytics/feedback |
   | `API_ORIGIN` | web | Defaults to `http://localhost:4000`; the `/api/*` proxy target |
   | `NEXT_PUBLIC_GAME_WS_URL` | web | Defaults to `http://localhost:4000`; direct socket origin |

3. Apply database migrations:

   ```bash
   npm run db:migrate
   ```

4. Seed the challenge pool (first run only, optional but needed for practice and duels):

   ```bash
   cd apps/server
   npx tsx scripts/f04-seed-challenges.ts
   npx tsx scripts/f04-publish.ts all
   ```

   The loader freezes each reference solution through Judge0, verifies all four language references agree, and inserts new slugs only — re-running it is safe and leaves existing challenges and submissions untouched.

## Run locally

```bash
# Terminal 1 — web app on http://localhost:3000
npm run dev:web

# Terminal 2 — game server on http://localhost:4000
npm run dev:server
```

Check `GET http://localhost:4000/health` — it returns `{"status":"ok", ...}` including database connectivity. Then open `http://localhost:3000`.

## Useful commands

| Command | What it does |
|---|---|
| `npm run db:generate` | Generate SQL migrations from `apps/server/src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to the database in `DATABASE_URL` |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run lint` | Lint all workspaces |
| `npm run build` | Build all workspaces |

Feature gates live in `apps/server/scripts/` and are run from that folder, for example:

```bash
cd apps/server
npx tsx scripts/challenge-verify.ts        # every published challenge × 4 languages through real Judge0
npx tsx scripts/f12-verify.ts              # F12: Java + C++ references on every stored test
npx tsx scripts/f12-upgrade-versions.ts    # F12: dry-run the four-language version upgrade
npx tsx scripts/f09-matchmaking-test.ts    # queue, pairing, repeat rule, leaderboard
cd ../..
npx tsx apps/web/scripts/f12-editor-check.ts  # F12: tokenizer, keyword hues, auto-pairing
```

## Documentation

| Document | Covers |
|---|---|
| [`PLAN.md`](PLAN.md) | Iterations, feature order, test gates, progress log |
| [`docs/project-description.md`](docs/project-description.md) | What the product is and why |
| [`docs/architecture.md`](docs/architecture.md) | Deeper design: components, match lifecycle, security, deployment |
| [`docs/data-model.md`](docs/data-model.md) | Tables, constraints, and rules |
| [`docs/features/`](docs/features/) | One spec per feature with scope, API, and sign-off |
| [`docs/reports/project-report.md`](docs/reports/project-report.md) | Status, test results, incidents, deployment notes |
| [`DOCUMENT_STRUCTURE.md`](DOCUMENT_STRUCTURE.md) | Where everything lives |

## Rules of the project

- The server is the referee: the browser displays; it never decides winners, scores, or time.
- Player code never runs on the game server — only in the Judge0 sandbox.
- Hidden test cases never leave the server.
- No secrets in git: `.env` files are ignored; `.env.example` lists the names.
