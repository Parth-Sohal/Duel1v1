# Changelog

## [2026-10-28] F02b — Avatar upload (built + tested, local)
- Added: `PUT /api/me/avatar` (upload own photo) and `DELETE /api/me/avatar` (remove) — the client center-crops to a 256×256 JPEG on canvas before upload; the server still re-validates the data URL, MIME allowlist (jpeg/png/webp), magic bytes, and a 150 KB decoded cap (400 invalid / 413 too large)
- Added: `avatars` table (migration 0003, base64 bytes in our own DB — no third-party storage) and public `GET /api/users/:id/avatar` (correct Content-Type, 60 s cache, versioned `?v=` URL busts caches on re-upload)
- Added: profile-page CHANGE PHOTO / REMOVE controls (`AvatarEditor`); upload always wins over the Google photo — sign-in refresh skips any local `/api/...` avatar URL
- Fixed: `Avatar` renders images with `loading="eager"` — avatars are tiny (3–4 KB) and always above the fold; lazy loading never painted them in testing
- Verified: 14/14 API matrix (upload, serve bytes, re-upload bumps version, renamed non-image 400, oversize 413, no-auth 401, unknown id 404, public profile carries avatarUrl but never email, remove → 404) + live UI round-trip (upload → remove → letter block → re-upload) + responsive 375/768/1440 (zero overflow); confirmed in real use — a live account uploaded and its avatar serves publicly; lint + production build clean
- Parked: crop/zoom UI, object-storage migration if avatars grow

## [2026-10-28] F03 — Email + password login (built + tested, local)
- Added: manual accounts — `POST /api/auth/register` (auto sign-in) and `POST /api/auth/login`; scrypt password hashing (node:crypto, salted, params in the hash string, timing-safe compare); `credentials` table (migration 0002, one password per account)
- Added: login page email form with Sign in / Create account toggle (display name only in create mode); same 30-day session/profile as Google sign-in
- Added: server-side rate limiting — 8 failed logins per 15 min per email and per IP → 429; success clears the email count
- Verified: 20-check API matrix (validation, 409 dup, generic 401s, no plaintext password in DB, rate limit) + live form round-trip; lint + production build clean
- Parked: email verification + password reset (needs an email provider), account linking, Redis-backed rate limiting

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
