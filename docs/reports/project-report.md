# Project Report

One living report for the whole project. Update it at the end of every iteration, after testing and before starting the next one.

---

## 1. Project snapshot

| Item | Value |
|---|---|
| Project | Coding Arena |
| Goal | 1v1 timed coding duels, built as a real product |
| Stack | Next.js (Vercel), Node + Fastify + Socket.IO (Render), PostgreSQL (Neon), Judge0 (later) |
| Method | Iterations: build one, test it, report, then start the next |
| Current iteration | Iteration 1 — Accounts (not started) |
| Live URLs | Web: https://duel1v1.vercel.app · Server: https://duel1v1.onrender.com |
| Last updated | 2026-10-27 |

## 2. Decisions made so far

| # | Decision | Reason | Date |
|---|---|---|---|
| 1 | Build as a product, with the AI coding tool doing most of the building and the owner reviewing and testing | Speed and shipping | 2026-10-26 |
| 2 | One game server, no Redis or load balancer in v1 | Simpler; not needed at launch scale | 2026-10-26 |
| 3 | Judge0 for running code | Sandboxing is hard; don't build it | 2026-10-26 |
| 4 | PostgreSQL as the only database | Relational data and transactions | 2026-10-27 |
| 5 | Challenge tests stored as `jsonb` in each challenge version | Variable number of tests per challenge, one record to load | 2026-10-27 |
| 6 | Friend rooms and bot opponent before random matchmaking | Avoid the empty-queue problem | 2026-10-26 |
| 7 | Launch languages: JavaScript and Python; C++ and Java in Iteration 5 | Tests are language-independent; two languages keeps per-language verification manageable | 2026-10-27 |

## 3. Open decisions

| # | Decision | Needed before | Default |
|---|---|---|---|
| D1 | Product name | Iteration 0 | "Coding Duel" |
| D2 | AI coding tool | Iteration 0 | none chosen |
| D4 | Judge0 hosted or self-hosted | Iteration 2 | Hosted |
| D5 | Points and draw rule confirmed | Iteration 3 | +1 / −1, draw no change |
| D6 | Bot matches count toward points | Iteration 4 | Decide in iteration 4 |

## 4. Iteration overview

| Iteration | Theme | Features | Status |
|---|---|---|---|
| 0 | Foundation | F0 setup and deploy | **Done** (2026-10-27) |
| 1 | Accounts | F1 login, F2 profile | Not started |
| 2 | Practice mode | F3 challenges, editor, run code | Not started |
| 3 | Friend duels | F4 rooms, F5 match engine, F6 history | Not started |
| 4 | Soft launch | F7 bot and daily challenge, F8 launch hardening | Not started |
| 5 | Growth | F9 matchmaking, F10 AI analysis, F11 UI polish, F12 C++ and Java | Not started |

## 5. Iteration reports

### Iteration 0 — Foundation

Dates: 2026-10-26 → 2026-10-27
Features: F00
Status: passed

#### What was built
- npm-workspaces monorepo: `apps/web` (Next.js + TS), `apps/server` (Fastify + Socket.IO + TS), `packages/shared`
- Game server skeleton: `GET /health` liveness probe incl. database check; CORS configured; graceful shutdown
- Drizzle + PostgreSQL tooling; first migration (`pgcrypto` extension + the six schema enums)
- Environment config with fail-fast validation; `.env.example`; secrets git-ignored
- Prettier + ESLint (web) wired up; docs tree per `DOCUMENT_STRUCTURE.md`
- Deployed: web on Vercel, server on Render (Free tier) with Neon `DATABASE_URL`

#### Test results
| Feature | Test | Result | Notes |
|---|---|---|---|
| F00 | `npm install` at root installs all workspaces | pass | lockfile committed |
| F00 | Web runs locally, page renders | pass | port 3000 |
| F00 | `GET /health` returns OK | pass | `{"status":"ok"}` |
| F00 | DB connect + first migration | pass | enums + `pgcrypto` applied |
| F00 | No secrets in git | pass | `git check-ignore` verified |
| F00 | Lint passes | pass | after eslint ignore fix |
| F00 | Deployed and reachable | pass | both URLs verified 2026-10-27 |

#### Issues found
| # | Issue | Severity | Fixed? | Notes |
|---|---|---|---|---|
| 1 | Web ESLint linted Next.js build output (`.next/`, `next-env.d.ts`) | low | yes | `ignores` added to `apps/web/eslint.config.mjs` |
| 2 | Generated migration lacked `pgcrypto` | low | yes | added before first apply, pre-history |

#### Security and fairness checks
- [x] Hidden tests not exposed in any response — n/a yet (no challenges served)
- [x] Rate limits working — n/a yet
- [x] No secrets in git
- [x] Server decides all outcomes — no outcomes yet; server-authoritative design kept

#### Works on
- [x] Desktop  - [x] Mobile width (placeholder page)

#### Changes to plan or architecture
- Product name finalized to **Coding Arena** (decision 001)
- Build tooling recorded: OpenCode agent + Drizzle ORM + npm workspaces (decision 002)

#### Decision: go to the next iteration?
yes

#### Carried to backlog
- Render free tier sleeps (~15 min idle, ~30-60 s cold start) — may matter for duel timers later

## 6. Risk register

| Risk | Likelihood | Impact | Mitigation | Status |
|---|---|---|---|---|
| Empty queue at launch | High | High | Friend rooms, bot, daily challenge | Planned |
| Sandbox escape or abuse | Low | Severe | Judge0, no network, limits | Planned |
| Run and AI costs grow | Medium | Medium | Rate limits and caps | Planned |
| Scope creep | High | Medium | Iteration gates and backlog | Active |
| Not enough quality challenges | Medium | High | Hand-verify each with reference solution | Planned |
| Hidden-test leak | Low | High | Single filter function, tests for it each iteration | Planned |

## 7. Iteration report template

Copy this block into section 5 at the end of each iteration.

```markdown
### Iteration N — Theme

Dates: start → end
Features: Fxx, Fyy
Status: passed | passed with known issues | failed

#### What was built
- ...

#### Test results
| Feature | Test | Result | Notes |
|---|---|---|---|
| Fxx | description | pass / fail | |

#### Issues found
| # | Issue | Severity | Fixed? | Notes |
|---|---|---|---|---|

#### Security and fairness checks
- [ ] Hidden tests not exposed in any response
- [ ] Rate limits working
- [ ] No secrets in git
- [ ] Server decides all outcomes

#### Works on
- [ ] Desktop  - [ ] Mobile width

#### Changes to plan or architecture
- ...

#### Decision: go to the next iteration?
yes | no, because ...

#### Carried to backlog
- ...
```

## 8. Backlog

Ideas parked until after the current iteration: Redis and load balancer, job queue, Elo ratings, more languages, Facebook login, user-created challenges, tournaments, payments.
