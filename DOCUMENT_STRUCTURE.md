# Document and Project Structure

How this project's files and documents are organized, so anyone (you, me, an AI coding tool) can find things and know where new things go.

---

## 1. The documents and what each one is for

| File | Purpose | Updated when |
|---|---|---|
| `README.md` | What the project is and how to run it | Setup changes |
| `PLAN.md` | What we build and in what order, as iterations with test gates | An iteration starts, finishes, or the plan changes |
| `DOCUMENT_STRUCTURE.md` | This file: where everything lives and how to write docs | The structure changes |
| `docs/project-description.md` | What the product is, who it's for, rules, scope, risks | The product scope or rules change |
| `docs/architecture.md` | System design: components, match lifecycle, security, deployment | The design changes |
| `docs/data-model.md` | Database tables, test-case format, key rules | The schema changes |
| `docs/reports/project-report.md` | Status, decisions, risks, and one test report per iteration | End of every iteration |
| `docs/features/Fxx-name.md` | One spec per feature | Before building it, and after sign-off |
| `docs/decisions/NNN-title.md` | One short record per important decision (why we chose X) | A decision is made |
| `docs/ui/` | UI design files and notes you provide | You share a design |
| `CHANGELOG.md` | What shipped and when | Each feature sign-off |

Rule of thumb: **the description says why, the plan says what and when, architecture says how, feature specs say exactly what "done" means, and the report says what actually happened.**

## 2. Project folder layout

```text
coding-duel/
├── README.md
├── PLAN.md
├── DOCUMENT_STRUCTURE.md
├── CHANGELOG.md
├── .env.example            # variable names only, never real secrets
├── .gitignore
│
├── docs/
│   ├── project-description.md
│   ├── architecture.md
│   ├── data-model.md
│   ├── reports/            # project-report.md
│   ├── features/           # F00-setup.md, F01-login.md, ...
│   ├── decisions/          # 001-use-judge0.md, 002-no-redis-v1.md, ...
│   └── ui/                 # design files, exports, notes per screen
│
├── apps/
│   ├── web/                # Next.js frontend
│   │   ├── app/            # pages and routes
│   │   ├── components/     # reusable UI pieces
│   │   ├── lib/            # helpers, API client, socket client
│   │   ├── styles/         # global styles, design tokens
│   │   └── public/         # images, icons, fonts
│   │
│   └── server/             # Node game server
│       ├── src/
│       │   ├── routes/     # REST endpoints (auth, profile, challenges)
│       │   ├── sockets/    # WebSocket events (rooms, matches)
│       │   ├── services/   # business logic (match engine, judge, ratings)
│       │   ├── db/         # connection, queries, migrations
│       │   ├── middleware/ # auth check, rate limits, error handling
│       │   └── config/     # env loading, constants
│       └── tests/
│
├── packages/
│   └── shared/             # types and constants used by both apps
│
├── scripts/                # seed challenges, utilities
└── seed/
    └── challenges/         # one file per challenge (statement, tests, reference solution)
```

Placement rules:
- **Business rules (who wins, scoring, timer) live only in `apps/server/src/services/`.** Never in the frontend.
- **Anything both apps need (types, event names, constants) lives in `packages/shared/`.**
- **Secrets live in `.env` files that are never committed.** `.env.example` lists the names.
- **Hidden test cases live only on the server side** (`seed/` and the database), never in `apps/web/`.

## 3. Naming conventions

- Folders and files: `kebab-case` (`match-engine.ts`)
- React components: `PascalCase` (`MatchTimer.tsx`)
- Variables and functions: `camelCase`
- Database tables and columns: `snake_case` (`match_players`, `ends_at`)
- Feature specs: `Fxx-short-name.md` matching the ID in `PLAN.md` (features are grouped into iterations)
- Decision records: `NNN-short-title.md`, numbered in order
- Branches: `feature/Fxx-short-name`
- Commits: short imperative sentence, with the feature ID (`F03: add run endpoint`)

## 4. Feature spec template

Copy this into `docs/features/Fxx-name.md` before building each feature.

```markdown
# Fxx — Feature name

Status: not started | in progress | tested | signed off
Branch: feature/Fxx-name
Depends on: Fyy

## Goal
One or two sentences: what can a player do after this feature?

## Scope
- In: ...
- Out (not now): ...

## UI
- Design file: docs/ui/<file>
- Screens: ...
- Notes: states to cover (loading, empty, error)

## Behavior
Step-by-step description of how it works, including edge cases.

## API / events
- REST: METHOD /path — purpose
- Socket events: name — direction — payload

## Data
Tables or fields added or changed.

## Rules and safety
Anything the server must enforce (limits, validation, hidden data).

## Test checklist
- [ ] ...
- [ ] ...

## Sign-off
- Tested on: date, by whom
- Issues found and fixed: ...
- Follow-ups moved to backlog: ...
```

## 5. Decision record template

```markdown
# NNN — Decision title

Date: YYYY-MM-DD
Status: accepted | replaced by NNN

## Context
What problem or choice came up?

## Decision
What we chose.

## Why
Reasons, and what we gave up.

## Revisit when
The condition that should make us reconsider (for example: "more than one game server").
```

## 6. UI design intake

When you share a design file for a feature:
1. Put the file in `docs/ui/` named after the feature (`F02-profile.png`, `F05-match-screen.fig`, ...).
2. Add a short note in the feature spec: which screens it covers, and any states not shown (loading, error, empty).
3. Shared look-and-feel rules (colors, fonts, spacing) go in `docs/ui/design-tokens.md` once, and the code reads them from `apps/web/styles/` so every screen stays consistent.

## 7. Changelog format

```markdown
## [date] F03 — Challenges and practice mode
- Added: challenge list, editor, Run via Judge0, rate limit
- Fixed: ...
- Known issues: ...
```

## 8. How we keep docs honest

- An iteration is not finished until its test gate has run and its report is written in `docs/reports/project-report.md`.
- A feature is not signed off until its spec, `PLAN.md` status, `README.md`, and `CHANGELOG.md` are updated.
- If the code and `docs/architecture.md` disagree, fix whichever is wrong the same day.
- Short and current beats long and stale.
