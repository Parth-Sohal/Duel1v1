# Data Model

Database: **PostgreSQL** (hosted on Neon). Access from TypeScript through an ORM with migrations (Prisma or Drizzle).

## 1. Why PostgreSQL

- **The data is relational.** Users play matches, matches use challenges, submissions belong to both. Foreign keys keep this consistent.
- **Transactions.** Deciding a winner and updating both players' points must succeed or fail together.
- **Safe concurrency.** When two players pass at almost the same moment, a conditional update (`WHERE winner_id IS NULL`) lets exactly one win.
- **Flexible where needed.** `jsonb` columns hold variable-length data (like a challenge's tests) without a separate table.
- **Good fit for growth.** Leaderboards, history, and analytics are plain SQL. Redis can be added later without changing the database.

Not chosen: MongoDB (weaker for relational data and multi-document consistency), SQLite (awkward for a hosted concurrent server), Firebase (harder to enforce referee rules and run history queries).

## 2. Entity overview

```text
users ──< sessions
  │
  ├──< match_players >── matches >── challenge_versions >── challenges
  │                         │
  │                         └── rooms
  │
  ├──< submissions >── (match_id optional, challenge_version_id)
  │
  └──< ai_reviews >── submissions

daily_challenges ── challenges
```

`<` = one-to-many. A submission's `match_id` is null in practice mode.

## 3. Challenge tests: variable length, stored as `jsonb`

Each challenge version has a `tests` column holding an array. A challenge can have 5 tests or 50; nothing in the schema changes.

```json
[
  { "args": [[2, 7, 11, 15], 9], "expected": "[0,1]", "hidden": false },
  { "args": [[3, 2, 4], 6],      "expected": "[1,2]", "hidden": false },
  { "args": [[3, 3], 6],         "expected": "[0,1]", "hidden": true  }
]
```

Rules:
- `args` is the JSON array of arguments passed to the player's entry function; `expected` is the compact JSON serialization of its return value. The harness prints that value as the last non-empty stdout line, and the server compares the two strings byte-for-byte.
- Entry points and starter code are stored per language in `entry_functions` and `starter_code`: `javascript`, `python`, `java`, `cpp`. In JS/Python an entry point is a function name; Java/C++ store a typed signature (F12), with `number` mapping to 64-bit `long` / `long long`.
- Tests are ordered by array position. "Test 3 of 12" means index 2 of 12.
- A version is **immutable**. Changing a statement or any test creates a new version (copy, then edit). Old matches keep pointing at the exact version they used.
- **Hidden tests never leave the server.** One server function, `visibleTests(tests)`, returns only the tests with `hidden: false`. Browser responses must only be built through that function.
- Validate the `tests` shape when a version is created (array, non-empty, each item has an array `args`, a string `expected`, and a boolean `hidden`, with at least one non-hidden sample). Validate `entry_functions` and `starter_code` keys against the supported languages.
- Keep each test small. If a challenge ever needs very large inputs, move them to file storage and keep a reference in the test object. Not needed for v1.

## 4. Schema (PostgreSQL)

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- Enums
CREATE TYPE difficulty        AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE room_status       AS ENUM ('open', 'full', 'in_match', 'closed');
CREATE TYPE match_status      AS ENUM ('waiting', 'active', 'finished');
CREATE TYPE match_result      AS ENUM ('win', 'draw', 'forfeit');
CREATE TYPE submission_kind   AS ENUM ('run', 'submit');
CREATE TYPE ai_context        AS ENUM ('practice', 'duel');
CREATE TYPE submission_status AS ENUM (
  'queued', 'running', 'accepted', 'wrong_answer', 'time_limit',
  'memory_limit', 'runtime_error', 'compile_error', 'internal_error'
);
CREATE TYPE language          AS ENUM ('javascript', 'python', 'java', 'cpp'); -- F12: java + cpp (0016)

-- Players ------------------------------------------------------------
CREATE TABLE users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id    text UNIQUE,                       -- null for bot users
  email        text UNIQUE,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 30),
  avatar_url   text,
  points       integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  wins         integer NOT NULL DEFAULT 0,
  losses       integer NOT NULL DEFAULT 0,
  draws        integer NOT NULL DEFAULT 0,
  is_bot       boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
-- Exactly one bot row (KERN)
CREATE UNIQUE INDEX users_is_bot_single ON users (is_bot) WHERE is_bot;

-- Store a hash of the session token, never the raw token
CREATE TABLE sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- Manual accounts and uploaded avatars --------------------------------
CREATE TABLE credentials (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,                       -- salted scrypt hash, never the password
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE avatars (
  user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mime       text NOT NULL,
  data       text NOT NULL,                          -- base64, ≤256×256 and size-capped
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Challenges ---------------------------------------------------------
CREATE TABLE challenges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE,
  title           text NOT NULL,
  difficulty      difficulty NOT NULL,
  tags            text[] NOT NULL,
  current_version integer NOT NULL DEFAULT 1,        -- names the live challenge_versions row
  is_published    boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE challenge_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id    uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  version         integer NOT NULL,
  statement       text NOT NULL,
  entry_functions jsonb NOT NULL,                    -- { javascript, python, java, cpp }; Java/C++ hold typed signatures (F12)
  starter_code    jsonb NOT NULL,                    -- { javascript, python, java, cpp }
  time_limit_ms   integer NOT NULL,
  memory_limit_mb integer NOT NULL,
  tests           jsonb NOT NULL,                    -- { args, expected, hidden }[] — see section 3
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, version)
);

CREATE TABLE daily_challenges (
  day                  date PRIMARY KEY,
  challenge_version_id uuid NOT NULL REFERENCES challenge_versions(id) ON DELETE CASCADE,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Product events and feedback (F10) -----------------------------------
CREATE TABLE events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       text NOT NULL,                          -- signup | match_started | submit | daily_view | feedback
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  match_id   uuid,
  meta       jsonb NOT NULL DEFAULT '{}',            -- coarse facts only, no PII
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_type_created_idx ON events (type, created_at);

CREATE TABLE feedback (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Rooms and matches --------------------------------------------------
CREATE TABLE rooms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code text NOT NULL UNIQUE,
  host_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guest_id    uuid REFERENCES users(id) ON DELETE SET NULL, -- null = open seat
  status      room_status NOT NULL DEFAULT 'open',
  difficulty  difficulty,                             -- null = ANY
  ready_state jsonb NOT NULL DEFAULT '{}',            -- { "<userId>": true }
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE INDEX rooms_host_idx ON rooms (host_id);

CREATE TABLE matches (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id              uuid REFERENCES rooms(id) ON DELETE SET NULL, -- null = matchmaking/bot
  challenge_version_id uuid NOT NULL REFERENCES challenge_versions(id) ON DELETE RESTRICT,
  status               match_status NOT NULL DEFAULT 'waiting',
  result_type          match_result,                  -- null until finished
  winner_id            uuid REFERENCES users(id) ON DELETE CASCADE, -- null until decided; stays null for a draw
  swing_points         integer,                       -- D5 random 29..31 locked at start
  is_bot_match         boolean NOT NULL DEFAULT false,
  bot_will_solve       boolean,                       -- F08 plan; null for human matches
  bot_solve_at         timestamptz,
  started_at           timestamptz,
  ends_at              timestamptz,                   -- server-owned deadline (start + 10 min)
  finished_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'finished' OR result_type IS NOT NULL),
  CHECK (result_type <> 'win' OR winner_id IS NOT NULL)
);
CREATE INDEX matches_room_idx ON matches (room_id);

CREATE TABLE match_players (
  match_id        uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seat            integer NOT NULL CHECK (seat IN (1, 2)),
  points_before   integer NOT NULL,
  points_after    integer,
  disconnected_at timestamptz                         -- for the forfeit grace period
);

-- Submissions --------------------------------------------------------
CREATE TABLE submissions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id         uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  challenge_version_id uuid NOT NULL REFERENCES challenge_versions(id) ON DELETE CASCADE,
  kind                 submission_kind NOT NULL,
  language             language NOT NULL,             -- javascript | python | java | cpp
  status               submission_status NOT NULL,
  passed               integer NOT NULL,
  total                integer NOT NULL,
  results              jsonb NOT NULL,                -- redacted per-test outcome, see below
  source_code          text NOT NULL,
  judge_latency_ms     integer,
  match_id             uuid REFERENCES matches(id) ON DELETE SET NULL, -- null = practice
  created_at           timestamptz NOT NULL DEFAULT now()  -- server clock, used for tie-breaks
);
CREATE INDEX submissions_user_created_idx  ON submissions (user_id, created_at);
CREATE INDEX submissions_match_created_idx ON submissions (match_id, created_at);

-- AI feedback --------------------------------------------------------
CREATE TABLE ai_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id  uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  submission_id uuid REFERENCES submissions(id) ON DELETE SET NULL, -- null for editor-scratch reviews
  context       ai_context NOT NULL,                  -- practice | duel
  language      language NOT NULL,
  verdict       jsonb NOT NULL,                       -- parsed review JSON
  model         text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_reviews_user_created_idx ON ai_reviews (user_id, created_at);
```

### Per-test results (`submissions.results`)

Stored by test position, so "passed 7/12" and "failed test 8" are easy:

```json
[
  { "pass": true,  "status": "accepted",     "hidden": false,
    "args": [[2, 7, 11, 15], 9], "expected": "[0,1]", "stdout": "[0,1]" },
  { "pass": false, "status": "wrong_answer", "hidden": true,
    "stderr": "Traceback..." }
]
```

When building a response for the browser: for tests with `hidden: false`, include `args`, `expected`, and actual `stdout`; for hidden tests, include only `pass`, `status`, and `hidden` (plus a traceback when one exists). Never include hidden `args` or `expected`.

## 5. Key rules the database helps enforce

**One winner per match.** One conditional update inside a transaction:

```sql
BEGIN;
UPDATE matches
   SET status = 'finished', result_type = 'win',
       winner_id = $winner, finished_at = now()
 WHERE id = $match AND status = 'active' AND winner_id IS NULL
RETURNING id;
-- No row returned: someone already won. Stop, change nothing.
-- Row returned: update both players' points, wins/losses, and
-- match_players.points_before/points_after in the same transaction.
COMMIT;
```

**Points never go negative.** `CHECK (points >= 0)` (re-added in migration 0010) backs the app rule: the loser/draw/forfeit delta is clamped to what the player actually has (`−min(penalty, points_before)`), while the winner always takes the full swing.

**Tie-break by arrival time.** Rank competing passes by `submissions.created_at`, not by when the code runner finished.

**Recent-challenge rule needs no extra table.**

```sql
SELECT cv.challenge_id
  FROM match_players mp
  JOIN matches m             ON m.id  = mp.match_id
  JOIN challenge_versions cv ON cv.id = m.challenge_version_id
 WHERE mp.user_id = $user
 ORDER BY m.created_at DESC
 LIMIT 200;
```

Pick a random published challenge not in either player's list; if none is left, fall back to any published challenge.

**AI cap.** Count `ai_reviews` for the user since the start of the day before allowing a new request.

**Timer survives restarts.** On startup, find `matches` with `status = 'active'`: if `ends_at` has passed, finish as a draw; otherwise resume.

## 6. Deliberately left out of v1

- Separate rating-history table (`match_players.points_before/after` records every change)
- Friends list, chat, notifications
- Tournaments and seasons
- User-created challenges (would need `author_id` and a review status)
- Payments and subscriptions

## 7. Migrations by iteration

| Iteration | Migration |
|---|---|
| 0 | extensions, enums, migration tooling |
| 1 | `users`, `sessions` |
| 2 | `challenges`, `challenge_versions`, `submissions` |
| 3 | `rooms`, `matches`, `match_players`, history indexes |
| 4 | `daily_challenges`, bot user row |
| 5 | `ai_reviews` + `ai_context` (0015); `java`/`cpp` values on the `language` enum (0016, F12) |

Each table is created in the migration for the iteration that needs it, so the database grows with the build. Never edit an applied migration; add a new one.
