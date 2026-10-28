# Changelog

## [2026-10-28] F02 — Profile (built + tested, local)
- Added: `GET /api/me`, `PATCH /api/me` (display-name edit, server-side 2–30 validation, `updated_at` bump), `GET /api/users/:id` (public fields only, 404 unknown/bad id)
- Added: profile page avatar + inline name editor (char counter, save/cancel, live header sync); public profile `/u/[id]` (read-only, designed not-found state); header avatar chip
- Verified: full API matrix (400 invalid names, 401 no cookie, 200 valid trim, 404 unknown) + live UI edit round-trip + responsive 375/768/1440 (no overflow/overlap)
- Refactor: single `publicUser` mapping in `services/users.ts` — email/google_id provably never serialized

## [2026-10-28] F01 — Google login and session (tested, local)
- Added: live Google sign-in via OAuth redirect flow (`response_type=id_token`), `/auth/callback` with `state` CSRF guard; GIS iframe replaced so the primary button has native hover/focus states
- Added: session persistence verified end-to-end — refresh keeps session, logout deletes the `sessions` row and clears the cookie, protected pages redirect when signed out
- Verified: DB stores only the SHA-256 token hash (64 hex chars, never the raw token); returning accounts reuse their user row (no duplicates)
- Fixed: UI v2 — 10 owner-reported issues (panel overlap, nav collision, AA contrast, hierarchy, stat row, primary CTA, designed empty states); responsive verified at 375/768/1440
- Pending: verify cookie `Secure` flag at production deploy

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
