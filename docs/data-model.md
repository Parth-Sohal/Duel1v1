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
  { "input": "2 7 11 15\n9", "expected": "0 1", "hidden": false },
  { "input": "3 2 4\n6",     "expected": "1 2", "hidden": false },
  { "input": "3 3\n6",       "expected": "0 1", "hidden": true  }
]
```

Rules:
- `input` is what the program reads from stdin; `expected` is what it must print. Plain text, same format for every challenge and language.
- Tests are ordered by array position. "Test 3 of 12" means index 2 of 12.
- A version is **immutable**. Changing a statement or any test creates a new version (copy, then edit). Old matches keep pointing at the exact version they used.
- Output comparison ignores trailing whitespace and trailing blank lines.
- **Hidden tests never leave the server.** One server function, `getPublicChallenge(versionId)`, returns the statement, starter code, and only the tests with `hidden: false`. Browser responses must only be built through that function.
- Validate the `tests` shape when a version is created (array, non-empty, each item has string `input`, string `expected`, boolean `hidden`, at least one non-hidden sample).
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
CREATE TYPE submission_status AS ENUM (
  'queued', 'running', 'accepted', 'wrong_answer', 'time_limit',
  'memory_limit', 'runtime_error', 'compile_error', 'internal_error'
);

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

-- Store a hash of the session token, never the raw token
CREATE TABLE sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- Challenges ---------------------------------------------------------
CREATE TABLE challenges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text NOT NULL UNIQUE,
  title        text NOT NULL,
  difficulty   difficulty NOT NULL,
  tags         text[] NOT NULL DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE challenge_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id    uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  version         integer NOT NULL,
  statement_md    text NOT NULL,
  starter_code    jsonb NOT NULL DEFAULT '{}',    -- {"javascript": "...", "python": "..."}
  tests           jsonb NOT NULL                  -- see section 3
                  CHECK (jsonb_typeof(tests) = 'array' AND jsonb_array_length(tests) >= 1),
  time_limit_ms   integer NOT NULL DEFAULT 2000,
  memory_limit_kb integer NOT NULL DEFAULT 128000,
  is_current      boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, version)
);
-- At most one current version per challenge
CREATE UNIQUE INDEX one_current_version
  ON challenge_versions (challenge_id) WHERE is_current;

CREATE TABLE daily_challenges (
  day          date PRIMARY KEY,
  challenge_id uuid NOT NULL REFERENCES challenges(id)
);

-- Rooms and matches --------------------------------------------------
CREATE TABLE rooms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code text NOT NULL UNIQUE,
  host_id     uuid NOT NULL REFERENCES users(id),
  status      room_status NOT NULL DEFAULT 'open',
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

CREATE TABLE matches (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id              uuid REFERENCES rooms(id),
  challenge_version_id uuid NOT NULL REFERENCES challenge_versions(id),
  status               match_status NOT NULL DEFAULT 'waiting',
  result_type          match_result,                  -- null until finished
  winner_id            uuid REFERENCES users(id),     -- null until decided; stays null for a draw
  is_bot_match         boolean NOT NULL DEFAULT false,
  started_at           timestamptz,
  ends_at              timestamptz,                   -- server-owned deadline (start + 10 min)
  finished_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'finished' OR result_type IS NOT NULL),
  CHECK (result_type <> 'win' OR winner_id IS NOT NULL)
);
CREATE INDEX matches_status_ends_idx ON matches (status, ends_at);

CREATE TABLE match_players (
  match_id        uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id),
  seat            smallint NOT NULL CHECK (seat IN (1, 2)),
  points_before   integer,
  points_after    integer,
  disconnected_at timestamptz,                        -- for the forfeit grace period
  PRIMARY KEY (match_id, user_id),
  UNIQUE (match_id, seat)
);
CREATE INDEX match_players_user_idx ON match_players (user_id, match_id);

-- Submissions --------------------------------------------------------
CREATE TABLE submissions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES users(id),
  match_id             uuid REFERENCES matches(id),   -- null = practice mode
  challenge_version_id uuid NOT NULL REFERENCES challenge_versions(id),
  kind                 submission_kind NOT NULL,
  language             text NOT NULL,
  code                 text NOT NULL CHECK (char_length(code) <= 50000),
  status               submission_status NOT NULL DEFAULT 'queued',
  passed_count         integer,
  total_count          integer,
  results              jsonb,                         -- per-test outcome, see below
  runtime_ms           integer,
  memory_kb            integer,
  judge_token          text,                          -- reference id from the code runner
  received_at          timestamptz NOT NULL DEFAULT now(),  -- server clock, used for tie-breaks
  judged_at            timestamptz
);
CREATE INDEX submissions_match_idx ON submissions (match_id, received_at);
CREATE INDEX submissions_user_idx  ON submissions (user_id, received_at DESC);

-- AI feedback --------------------------------------------------------
CREATE TABLE ai_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id),
  submission_id uuid NOT NULL REFERENCES submissions(id),
  feedback      jsonb NOT NULL,                       -- {complexity, suggestions, ...}
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_reviews_user_day_idx ON ai_reviews (user_id, created_at);
```

### Per-test results (`submissions.results`)

Stored by test position, so "passed 7/12" and "failed test 8" are easy:

```json
[
  { "i": 0, "status": "accepted", "ms": 12, "kb": 9800 },
  { "i": 1, "status": "wrong_answer", "ms": 10, "kb": 9700 }
]
```

When building a response for the browser: for tests with `hidden: false`, include input, expected, and actual output. For hidden tests, include only the index and status.

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

**Points never go negative.** `CHECK (points >= 0)` backs up the app rule (`GREATEST(points - 1, 0)` for the loser).

**Tie-break by arrival time.** Rank competing passes by `submissions.received_at`, not by when the code runner finished.

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
| 5 | `ai_reviews`, leaderboard indexes |

Each table is created in the migration for the iteration that needs it, so the database grows with the build. Never edit an applied migration; add a new one.
