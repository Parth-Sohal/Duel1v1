# F04 — Practice mode (challenges, editor, run/submit)

Status: spec (2026-10-29)
Branch: feature/F04-practice-mode
Depends on: F01 (sessions, auth)
PLAN reference: Iteration 2, "F3 Challenges and practice" (this doc = that feature)

## Goal

A player picks a challenge, reads it, writes code in a browser editor, runs it against the visible tests, submits against everything, and sees results. Solo practice — the warm-up before duels.

## Scope

- In: `challenges` + `challenge_versions` + `submissions` tables (migration 0004), challenge list + detail APIs, Run and Submit through Judge0, per-language time/memory limits, submissions saved, per-user rate limit, 8 seed challenges with reference solutions in **both** JavaScript and Python.
- Out (not now): creating challenges from the UI (backlog "CREATE"), scoring/points from practice (points change with duels, iteration 3+), editor autocomplete/linting (plain textarea-based editor, v1), custom time limits per player.

## Judging (decision 011 + D4)

- **stdin/stdout.** Player code reads stdin, prints stdout. Language-agnostic; every test is `{ input, expected, hidden }`.
- **Executor: Judge0.** D4 decided: **hosted, free public CE endpoint** (`https://ce.judge0.com`, no key) — verified live 2026-10-29 (Node 18 program, stdin `3 4 5` → `12`, accepted). Config lives in env: `JUDGE0_API_URL`, optional `JUDGE0_API_KEY`. If the public endpoint ever becomes a bottleneck, we self-host (owner's "option 2") or swap to a keyed endpoint — **env change only, zero code rewrite**. The server is the only caller; the browser never talks to Judge0.
- Player code only ever executes inside Judge0's sandbox. The server never executes player code itself.
- Language map (Judge0 CE ids): JavaScript → 93 (Node.js 18.15.0), Python → 100 (3.12.5).
- Limits (per-language multiplier): base 2 s CPU / 128 MB. JavaScript ×1, Python ×1.5 time (≈3 s). Memory uniform 256 MB.
- Verdict mapping: exact stdout match after trailing-whitespace trim → pass. Judge0 status → `accepted | wrong_answer | time_limit | memory_limit | runtime_error | compile_error | internal_error` (existing `submission_status` enum).

## Run vs Submit

| | RUN | SUBMIT |
|---|---|---|
| Tests | visible only | visible + hidden |
| Saved | no | yes (`submissions`) |
| Verdict | per-test results shown immediately | per-test results + status; best result marks the challenge solved |
- v1 runs the submission once per test case and aggregates (simple, correct); batching is a later optimization.

## Hidden tests (risk-register rule)

- Stored in `challenge_versions.tests` as jsonb: `[ { input, expected, hidden } ]` — visible 2–3, hidden 3–7 (edge cases: empty, single, max size, duplicates, negatives).
- **One filter function** strips hidden tests server-side; nothing else serializes a version. Hidden tests never leave the server — the browser only ever gets pass/fail for them, never input or expected output.

## Expected outputs

Never hand-typed. Each challenge ships a reference solution (JS + Python); the authoring script runs the reference through Judge0 on each input and **freezes** the outputs into the version jsonb. The owner eyeballs inputs/outputs per challenge before it ships. Gate: every seed challenge passes with the reference in **both** languages.

## API

All cookie-authed.

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/challenges` | — | `{ challenges: [{ slug, title, difficulty, tags, solved, attempts }] }` |
| GET | `/api/challenges/:slug` | — | `{ challenge: { slug, title, difficulty, tags, version, statement, starterCode: {javascript, python}, timeLimitMs, memoryLimitMb, visibleTests } }` · 404 unknown |
| POST | `/api/challenges/:slug/run` | `{ language, sourceCode }` | per-test results (visible only), not saved |
| POST | `/api/challenges/:slug/submit` | `{ language, sourceCode }` | per-test results (all) + status; saved |
| GET | `/api/challenges/:slug/submissions` | — | the player's own recent submissions for this challenge |

Errors: 400 invalid language/empty/oversized code (cap `MAX_CODE_LENGTH`), 404 unknown slug, 429 rate limited, 502 judge unavailable.

## Rate limits (server-side, in-memory)

- Run + Submit: **20 submissions per user per 5 minutes** (429 with a clear message). In-memory single-instance, same pattern as the login limiter; Redis comes with the scaling backlog.
- Code cap: `MAX_CODE_LENGTH` (50 000 chars, already in shared).

## Data (migration 0004)

- `challenges`: `id` uuid pk, `slug` text unique, `title` text, `difficulty` (existing enum), `tags` text[] , `current_version` integer, `is_published` boolean, timestamps. Only published challenges are listed.
- `challenge_versions`: `id` uuid pk, `challenge_id` FK → challenges (cascade), `version` integer, `statement` text, `starter_code` jsonb `{ javascript, python }`, `time_limit_ms` integer, `memory_limit_mb` integer, `tests` jsonb, `created_at`. Unique `(challenge_id, version)`. Fixing a problem creates version n+1; running versions never mutate.
- `submissions`: `id` uuid pk, `user_id` FK → users (cascade), `challenge_id` FK, `challenge_version_id` FK, `kind` (existing enum run|submit), `language` (new enum `javascript|python`), `status` (existing enum), `passed` integer, `total` integer, `results` jsonb (per-test, hidden inputs redacted to `hidden: true`), `source_code` text, `judge_latency_ms` integer, `created_at`. Indexed `(user_id, created_at desc)`.
- Solved state = derived from `submissions` (latest accepted submit per challenge) — no extra table.

## UI (brutalist system, per docs/ui/README)

- **List `/practice`** — split layout. Cream half: huge "PRACTICE." headline + a short protocol block (languages, limits). Dark half: challenge rows — `01 TITLE` monospace, difficulty chip, tags, solved marker in orange; hairline rules between rows. Empty state: "NO CHALLENGES YET." Loading + error states in style.
- **Detail `/practice/[slug]`** — statement on the cream half (title, difficulty, statement, visible tests shown as INPUT/EXPECTED blocks, monospace). Dark half: editor (language chips JS / PYTHON, monospace, tab-key indent), RUN + SUBMIT (orange) buttons, results panel below — per-test rows `TEST 1 PASS` / `FAIL` with your output vs expected on visible tests, hidden tests shown only as pass/fail. Header nav gains PLAY... no — only items that exist: PRACTICE + profile chip.
- Follows every rule in README §3 (one accent, no shadows, square corners, real data only, loading/empty/error everywhere).

## Seed challenges (8, original wording)

Classic-flavored originals — no copied statements (copyright): two-pointers pair-sum, string parsing, hashmap first-duplicate, sliding-window max sum, stack bracket validation, simple DP climb, array rotation, digit/number puzzle. Each: statement, starter code (JS+PY), 2–3 visible + 3–7 hidden tests, reference solution (JS+PY). Owner signs off per challenge.

## Test checklist (from PLAN gates)

- [ ] Every seed challenge passes with its reference solution in **both** JavaScript and Python
- [ ] A player completes a full practice session end to end (list → read → run → submit → solved) — via API **and** the real UI
- [ ] Hidden tests never reach the browser (verified: response bodies + redacted stored results)
- [ ] Wrong solution → correct per-test verdicts; timeout and runtime-error paths verified
- [ ] Rate limit fires at 21st submission in window; code-cap 400
- [ ] Layout matches design at 375/768/1440; lint and build pass
- [ ] No secrets in git (public endpoint needs no key; env template updated)
