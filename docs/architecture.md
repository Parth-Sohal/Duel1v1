# Architecture

Status: v1 design, agreed. Update this file whenever the code and the design diverge.

## 1. Overview

One web app, one game server, one database, and two outside services. The game server is the **referee**: it owns matches, timers, winners, and points.

```text
        PLAYER A                              PLAYER B
      (browser: Next.js)                   (browser: Next.js)
            │  ▲                                │  ▲
   REST     │  │ WebSocket            REST      │  │ WebSocket
            ▼  │                                ▼  │
        ┌───────────────────────────────────────────┐
        │            GAME SERVER (Node + TS)         │
        │   REST API · Socket.IO · match engine      │
        └──────┬───────────────┬──────────────┬─────┘
               ▼               ▼              ▼
          PostgreSQL        Judge0         LLM API
        (all data)       (sandbox)       (AI feedback)
```

## 2. Components

| Component | Technology | Responsibility |
|---|---|---|
| Web app | Next.js + TypeScript | Pages, editor, match screen, profile. Displays state; decides nothing |
| Game server | Node + TypeScript, Socket.IO | Auth check, rooms, matches, timer, submissions, points, rate limits |
| Database | PostgreSQL (Neon) | Users, challenges, matches, submissions, AI reviews |
| Code runner | Judge0 (hosted) | Runs submitted code against tests in a sandbox |
| AI feedback | LLM API | Complexity estimate and suggestions, after a match or on request |
| Hosting | Vercel (web), Railway/Render/Fly (server) | The game server needs long-lived WebSocket connections, so it can't run on Vercel |

## 3. Communication

- **REST (HTTPS):** login, profile, challenge list, history, starting a run. Request and response.
- **WebSocket (Socket.IO):** live match events pushed by the server: opponent joined, match started, opponent submitted, result.

Event names and payload types live in `packages/shared/` so both apps use the same definitions.

## 4. Authentication

```text
Browser ─ Google sign-in ─► Google ─ identity token ─► Browser
Browser ─ token ─► Game server ─ verify with Google ─► ✔
Game server ─ find or create user, set session cookie ─► Browser
```

- The server verifies the token itself and never trusts profile data sent by the browser.
- A secure, HTTP-only session cookie identifies the player afterwards. JWT is optional and not required.
- The WebSocket connection is authenticated with the same session.

## 5. Match lifecycle

```text
waiting ──► active ──┬──► finished (win)
                     ├──► finished (draw: time up, nobody solved)
                     └──► finished (forfeit: player gone past grace period)
```

1. Host creates a room and shares the invite link; a friend joins.
2. When both are ready, the server creates the match and picks one challenge that neither player has played recently.
3. The server stores `ends_at = start + 10 min` and sends the challenge and `ends_at` to both players.
4. Browsers count down to `ends_at`; the server is the clock that counts.
5. A submission is saved with a server timestamp (`received_at`) and sent to Judge0.
6. When a submission passes all tests, the server runs **one transaction**: set the winner only if there is none yet, then update both players' points and history.
7. The server pushes the result to both players.

### Rules the server enforces

- **Tie-break:** the submission that reached the server first wins, not the one whose test finished first.
- **Draw:** at `ends_at` with no winner, the match ends in a draw with no point change.
- **Forfeit:** a player disconnected for more than 30 seconds forfeits.
- **Reconnect:** the server resends full match state (challenge, time left, status, own code).
- **Restart safety:** match state lives in PostgreSQL. On startup, expired active matches are finished and running ones resume.

## 6. Code execution

- Judge0 runs the code; the game server never does.
- Tests are loaded for the challenge version, sent as a batch, and each is graded with the challenge's time and memory limits.
- No network access from the sandbox; limits on CPU time, memory, processes, and output size.
- Output comparison ignores trailing whitespace and blank lines at the end.
- Challenges with several valid answers are excluded from v1 (they would need custom checkers).

## 7. Data

Full schema in `docs/data-model.md`. Key points:

- PostgreSQL with transactions for winner and points updates.
- Challenge tests are stored as `jsonb` inside each challenge version, so a challenge can have any number of tests.
- Challenge versions are immutable; matches point to the exact version used.
- The "avoid the last 200 matches" rule is a query, not a separate table.

## 8. Security

| Concern | Control |
|---|---|
| Untrusted code | Judge0 sandbox only |
| Hidden tests leaking | Filtered in one server function; hidden tests never in any browser response; failures on hidden tests show only "test N of M failed" |
| Cost abuse | Per-user rate limits on runs; server-enforced daily AI cap |
| Forged identity | Server-side token verification; secure cookies |
| Prompt injection in AI feedback | Player code treated as untrusted text; no hidden tests or other players' code in the prompt; input size cap |
| Secrets | Environment variables only; `.env.example` lists names; nothing in git |
| Input abuse | Validation on display names, code size (50,000 characters), and request rates |

## 9. Observability

- Structured logs with `match_id`, `user_id`, and `submission_id` on every match, submission, and runner event.
- Error tracking on both apps.
- Basic analytics: sign-ups, practice runs, matches started and finished, drop-off points.

## 10. Deployment

- Web app on Vercel; game server and database on managed hosting.
- Separate development and production environments with their own databases.
- Database changes only through migrations, one set per feature.

## 11. What is deliberately not here (yet)

| Not in v1 | Add when |
|---|---|
| Redis | A second game server is needed, or queue and rate-limit data outgrow Postgres |
| Load balancer | More than one game server instance (needs sticky sessions or the Socket.IO Redis adapter) |
| Job queue | AI feedback or runner calls need retries and back-pressure |
| Microservices | Never, unless a clear team or scaling boundary appears |

To keep that door open now: match state in the database, matchmaking behind a small interface, stateless server, and the timer stored as `ends_at`.

## 12. Future shape (if it grows)

```text
Players ─► Load balancer ─► Game server 1 ┐
                          ─► Game server 2 ├─► Redis (queue + match events)
                          ─► Game server 3 ┘        │
                                                    ▼
                                              Postgres + Judge0 pool
```

## 13. Related documents

- `docs/project-description.md`: what and why
- `docs/data-model.md`: tables and rules
- `PLAN.md`: iterations and feature order
- `docs/reports/project-report.md`: status and iteration test reports
