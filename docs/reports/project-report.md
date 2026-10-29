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
| Current iteration | Iteration 2 - Practice mode (built + tested + owner-signed-off; merging to main) |
| Live URLs | Web: https://duel1v1.vercel.app · Server: https://duel1v1.onrender.com |
| Last updated | 2026-10-28 |

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
| 8 | Email + password accounts in Iteration 1, simple version (no email verification) | Owner-approved scope addition; real accounts without an email provider | 2026-10-28 |
| 9 | Avatar uploads stored as base64 bytes in our own database | No third-party storage service; works on free tiers; photos are ≤256×256 and size-capped | 2026-10-28 |
| 10 | An upload always wins over the Google photo | The player owns their picture; Google sign-in only fills an empty avatar | 2026-10-28 |
| 11 | Judging style: **function in, answer out** | The player writes a named function and RETURNS the answer; the server wraps their code so the judge calls it with JSON arguments and compares the returned value. Replaced the original stdin/stdout plan (2026-10-29, owner decision) | 2026-10-29 |

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
| 1 | Accounts | F1 login, F2 profile, F2b avatar upload, F3 email login | **Done** (2026-10-28) |
| 2 | Practice mode | F3 challenges, editor, run code | Built + tested (2026-10-29) |
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

### Iteration 1 — Accounts

Dates: 2026-10-27 → 2026-10-28
Features: F01 Google login, F02 profile, F02b avatar upload (added), F03 email + password login (added)
Status: passed

#### What was built
- **F01 Google login:** OAuth redirect flow (`response_type=id_token`) with `state` CSRF guard; server verifies the token, creates the user on first sign-in, reuses the row after; 30-day session cookie (server stores only the SHA-256 token hash); logout deletes the session row and clears the cookie; UI v2 shipped 10 owner-reported fixes (overlap, nav collision, AA contrast, hierarchy, CTA, empty states)
- **F02 profile:** `GET/PATCH /api/me` (display-name edit, 2–30 chars validated server-side), `GET /api/users/:id` (public fields only — email/google_id provably never serialized), profile page with inline name editor + live header sync, public profile `/u/[id]` with a designed not-found, header avatar chip; Google photo refresh picks up photo changes at sign-in (display name stays player-owned)
- **F02b avatar upload (owner-requested addition):** `PUT/DELETE /api/me/avatar`, `avatars` table (migration 0003, base64 bytes in our own DB), public `GET /api/users/:id/avatar` with a versioned cache-busting URL; the client center-crops to 256×256 JPEG on canvas before upload and the server still re-validates (data-URL shape, MIME allowlist, magic bytes, 150 KB cap); uploads win over the Google photo
- **F03 email + password login (owner-approved addition, simple version):** `POST /api/auth/register` (auto sign-in) + `POST /api/auth/login`; scrypt hashing (`node:crypto`, salted, params stored in the hash string, timing-safe compare); `credentials` table (migration 0002); rate limiting — 8 failed logins per 15 min per email and per IP → 429; login-page email form with Sign in / Create account toggle; same session/profile as Google sign-in

#### Test results
| Feature | Test | Result | Notes |
|---|---|---|---|
| F01 | Live Google sign-in end-to-end | pass | redirect flow, account reuse on return |
| F01 | Session persists across refresh | pass | |
| F01 | Logout deletes session row + cookie | pass | |
| F01 | DB stores only SHA-256 token hash | pass | 64 hex chars, never the raw token |
| F02 | Name edit API matrix (400/401/200/404) | pass | trim + length validation server-side |
| F02 | Live edit round-trip + header sync | pass | |
| F02 | Public profile exposes no private fields | pass | no email/google_id in any response |
| F02 | Responsive 375 / 768 / 1440 | pass | no overflow or overlap |
| F02b | 14/14 avatar API matrix | pass | upload, serve bytes, version bump, renamed non-image 400, oversize 413, no-auth 401, unknown id 404, remove → 404 |
| F02b | Live UI round-trip (upload → remove → re-upload) | pass | letter block returns; version busts cache |
| F02b | Confirmed in real use | pass | a live account uploaded its own logo; serves publicly |
| F02b | Responsive 375 / 768 / 1440 with photo | pass | zero horizontal overflow |
| F03 | 20-check API matrix | pass | validation, 409 dup, generic 401s, rate limit, no plaintext in DB |
| F03 | Live form round-trip (sign in / create) | pass | |
| All | Lint + production build | pass | tsc + eslint + `next build` green |

#### Issues found
| # | Issue | Severity | Fixed? | Notes |
|---|---|---|---|---|
| 1 | `next/image` lazy loading never painted avatars (no request issued, even in-viewport) | medium | yes | avatars are 3–4 KB and always above the fold → `loading="eager"` in `Avatar` |
| 2 | Oversize avatar returned 400 instead of the spec'd 413 | low | yes | parser now distinguishes `invalid` vs `too_large` |
| 3 | `DELETE` with `content-type: application/json` and no body rejected by Fastify | low | yes (test) | harness bug — product behavior correct; fixed in the test script |
| 4 | Stale httpOnly session cookie in the test browser blocked JS cookie seeding | low | yes (harness) | cleared via the app's own logout; not a product issue |

#### Security and fairness checks
- [x] Hidden tests not exposed in any response — n/a yet (no challenges served)
- [x] Rate limits working — login rate limit (8 / 15 min per email and per IP) verified
- [x] No secrets in git — `git check-ignore` verified; secrets only in `.env.local`
- [x] Server decides all outcomes — sessions validated server-side on every request; the browser is never trusted (avatar uploads re-validated: MIME allowlist, magic bytes, size cap)
- [x] Passwords stored only as salted scrypt hashes; session tokens only as SHA-256 hashes

#### Works on
- [x] Desktop  - [x] Mobile width (375 / 768 / 1440, profile + login verified)

#### Changes to plan or architecture
- Iteration 1 scope grew by owner decision: F03 email + password (simple version) and F02b avatar upload — both built and tested inside this iteration, no other features displaced
- Avatars stored in our own database (base64) instead of a third-party storage service — free-tier friendly, revisit if avatars grow
- Google photo refresh logic now distinguishes local uploads (never overwritten) from Google-hosted URLs

#### Decision: go to the next iteration?
yes — Iteration 2 (practice mode: challenges, editor, run/submit via Judge0)

#### Carried to backlog
- Verify cookie `Secure` flag at production deploy (this iteration is local-tested; deploy step pending)
- Production env for the accounts work: Vercel needs `NEXT_PUBLIC_GOOGLE_CLIENT_ID` + `API_ORIGIN=https://duel1v1.onrender.com`; Render needs `GOOGLE_CLIENT_ID`
- Email verification + password reset (needs an email provider); account linking
- Redis-backed rate limiting if we ever scale past one server instance
- Crop/zoom UI and object-storage migration if avatars grow beyond small squares

### Iteration 2 - Practice mode

Branch: `feature/F04-practice-mode` (F04, `docs/features/F04-practice-mode.md`)
Status: passed

#### What was built
- **Judging model (decision 11, revised by owner):** the player writes a named function and **returns** the answer. The server composes their code with a per-language harness (`composeSource`): the harness reads a JSON array of call arguments from stdin, calls the function, and prints the return value as one JSON line; the last stdout line is compared against the frozen answer. Serialization is byte-identical across JS (`JSON.stringify`) and Python (`json.dumps` with tight separators).
- **Executor:** Judge0, free public CE endpoint `https://ce.judge0.com` (decision D4, no key) — env-only swap to self-hosted ("option 2") or a keyed endpoint later. Player code only ever runs in the judge sandbox; the server never executes it.
- **Data:** migrations 0004 (`challenges`, `challenge_versions`, `submissions`) + 0005 (`entry_functions` jsonb per version). Versions are immutable; `current_version` names the live one.
- **APIs:** list (with per-player solved/attempts), detail (visible tests only), run (visible samples, not saved), submit (all tests, saved, hidden redacted), own-history. All cookie-authed.
- **Rate limit:** 20 Run+Submit per user per 5 minutes (in-memory, same pattern as login limiter).
- **UI:** `/practice` (protocol block + challenge roster with solved markers, empty/offline states) and `/practice/[slug]` (statement + sample arguments/expected on cream; workbench on dark — JS/PY chips with per-language scratchpads, monospace editor with tab indent, RUN/SUBMIT, expandable per-test results with error tracebacks; hidden tests sealed to pass/fail). PRACTICE added to the header nav.
- **Seeds:** 8 original challenges (no copied wording), each with reference solutions in JS + Python and frozen expected answers; owner signed off and all published.

#### Test results

| Area | Test | Result | Notes |
|---|---|---|---|
| API | Full practice matrix | 35/35 pass | `f04-api-test.ts` (auth, list/detail, hidden-test leak checks, run/submit verdicts, history, validation, rate limit) |
| Seeds | Reference solutions in JS + Python | 82/82 pass | Both languages agree on every frozen answer; nothing hand-typed |
| UI | Server-rendered practice round-trip | 21/21 pass | `f04-ui-smoke.ts` through the real web proxy incl. a judged run |
| Gates | Infinite loop → time limit; 1 GB touched allocation → OOM kill; outbound network from a submission blocked | pass | Verified empirically through the real judge |
| Build | Server `tsc`, web `next build`, lint | pass | Production build green |

#### Issues found
| # | Issue | Severity | Fixed | Notes |
|---|---|---|---|---|
| 1 | Free public Judge0 endpoint has load spikes: correct solutions intermittently judged as `time_limit` | medium | yes | Time limit raised to 5 s base CPU (Python ×1.5) + 1 s `cpu_extra_time` grace; a false TLE is worse than a slow honest verdict. If the endpoint degrades long-term: self-host (option 2) or free RapidAPI key — env-only |
| 2 | Python syntax errors surface as `runtime_error` (NZEC), not `compile_error` | low | yes (UX) | Interpreted languages: expected; `stderr`/tracebacks now shown to the player in test rows |
| 3 | Next dev webpack cache corrupted after a large refactor (`Cannot find module './346.js'`) | low | yes | Dev-only; cleared `.next` + restart. Also the reason the production build gate matters |

#### Security and fairness checks
- [x] Hidden tests never exposed — detail API, run/submit results, SSR HTML, and stored submissions all verified; hidden tests carry only `pass/status/hidden`
- [x] Player code runs only in the Judge0 sandbox; network access from submissions is blocked (verified empirically)
- [x] Server decides all outcomes — verdicts from the judge + server-side answer comparison; the browser never computes pass/fail
- [x] Rate limits working — 21st judge call in a 5-minute window → 429
- [x] No secrets in git — the public CE endpoint needs no key; templates updated

#### Works on
- [x] Desktop - [x] Fluid layout (clamped headlines, collapsing grids, overflow-safe code blocks; live browser check + responsive-class audit)

#### Changes to plan or architecture
- **Decision 11 revised by owner:** stdin/stdout replaced by function-in/answer-out (players write `function name(args) { return answer; }`); harness, data shape (`{ args, expected, hidden }`), and all 8 seeds re-authored
- Time limit raised from 2 s to 5 s base CPU for the shared free endpoint (see issue 1)

#### Decision: go to the next iteration?
yes — Iteration 3 (friend duels)

#### Carried to backlog
- Challenge authoring UI (backlog "CREATE"); difficulty calibration with real players
- Batched judge submissions (one judge call per submission instead of per test) if latency matters
- Practice history panel on the detail page (API exists: GET `/:slug/submissions`)
- Redis-backed rate limiting when scaling past one server instance

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
