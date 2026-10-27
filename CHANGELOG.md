# Changelog

## [2026-10-27] Iteration 0 — complete
- Deployed: web on Vercel (https://duel1v1.vercel.app), game server on Render (https://duel1v1.onrender.com/health)
- Added: GitHub remote (main + feature/F00-setup); iteration report written
- Decision: go to Iteration 1 (Accounts)

## [2026-10-27] F00 — Project setup and foundation (local gate passed)
- Added: monorepo structure (`apps/web`, `apps/server`, `packages/shared`), docs restructured to the standard layout
- Added: Next.js web app, Node game server with `/health`, Drizzle migration tooling
- Added: first migration `drizzle/0000_lean_luckman.sql` — `pgcrypto` extension + six schema enums; applied to the database
- Fixed: web ESLint now ignores Next.js build output (`.next/`, `next-env.d.ts`); lint passes
- Known issues: deployment to Vercel/Railway pending (needs owner accounts)
