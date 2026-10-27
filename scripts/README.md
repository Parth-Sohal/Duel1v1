# Scripts

Utilities. `scripts/seed-challenges.ts` (Iteration 2) will load `seed/challenges/`
into the database through the server's own validation path, never direct SQL.

## Conventions

- TypeScript, run with `npx tsx scripts/<name>.ts` from the repo root.
- A script must be safe to run twice (idempotent) if it writes to the database.
