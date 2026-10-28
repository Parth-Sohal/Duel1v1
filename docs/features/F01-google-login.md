# F01 — Google login and session

Status: tested (2026-10-28) — production cookie check pending deploy
Branch: feature/F01-google-login
Depends on: F00

## Goal

A player can sign in with Google, stay signed in across refreshes, and sign out. The server — never the browser — decides who the player is.

## Scope

- In: Google Identity Services button on the web app, `POST /api/auth/google` (verify ID token, find-or-create user, create session, set cookie), `GET /api/auth/me`, `POST /api/auth/logout`, cookie-auth middleware for protected routes, `users` + `sessions` tables (migration 0001), login page UI.
- Out (not now): profile editing and public profiles (F02), bot users, email/password login, rate limits beyond basics.

## UI

- Login page (owner brutalist design, 2026-10-27): split 7/5 layout, "SIGN IN." hero, dark auth portal with a custom primary Google button, protocol card, rules ticker.
- Header (owner design): logo `{ duel }`, SKILL MAP nav, user chip when signed in, SIGN IN link when not; mobile collapses to a menu.

## Behavior

- Web redirects the player to Google's OAuth authorize endpoint (`response_type=id_token`) from a real primary button (native hover/focus states); Google returns to `/auth/callback` with the ID token in the URL fragment.
- A per-login random `state` is stored in `sessionStorage` and verified in the callback (login-CSRF guard).
- Web sends the ID token to `POST /api/auth/google`.
- Server verifies the token **with Google** (JWKS, `aud` = our client ID, unexpired). Profile fields in the request body are never trusted.
- Find-or-create `users` row keyed on `google_id`; first login creates the user with `display_name` from Google (clamped to 2–30 chars) and `avatar_url` from the Google picture.
- Server creates a session row: random 32-byte token, **only its SHA-256 hash** stored in `sessions.token_hash`; sets `expires_at = now() + 30 days`.
- Cookie: name `arena_session`, HTTP-only, `secure` in production, `sameSite=lax`, path `/`.
- `GET /api/auth/me` returns the signed-in user's public fields or 401.
- `POST /api/auth/logout` deletes the session row and clears the cookie.
- Protected pages redirect to `/login` when `me` returns 401; the Socket.IO handshake will accept the same cookie (wired for F04, middleware ready now).

## API / events

| Method | Path | Auth | Response |
|---|---|---|---|
| POST | `/api/auth/google` | none | 200 `{ user }` · 401 invalid token |
| GET | `/api/auth/me` | cookie | 200 `{ user }` · 401 |
| POST | `/api/auth/logout` | cookie | 204 |

`user` = `{ id, displayName, avatarUrl, points, wins, losses, draws }` — no email after login response.

## Data

Migration 0001 creates `users` and `sessions` exactly per `docs/data-model.md` §4 (indexes included).

## Rules and safety

- Session token never stored raw; hash only. Cookie HTTP-only (not readable by JS).
- Email is stored for uniqueness but never exposed to other players.
- Token verification failure → 401, logged with a request ID, no user row touched.
- Login-CSRF: the OAuth `state` is random per login and verified in the callback.
- Google Console (Web application client) must list the redirect URIs:
  `http://localhost:3000/auth/callback` and `https://duel1v1.vercel.app/auth/callback`.
- No secrets in git; `GOOGLE_CLIENT_ID` (server) and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (web) added to `.env.example`. `SESSION_SECRET` and the client secret are not needed (ID-token verification uses Google's public JWKS).

## Test checklist

- [x] New Google account creates a user; a returning account reuses the row (2 accounts → exactly 2 rows across ~7 sign-ins)
- [x] Refresh keeps you signed in; logout ends the session (verified 2026-10-28: refresh persists, logout deletes the `sessions` row + clears cookie, profile redirects to login)
- [x] Protected page redirects when signed out (`/profile` → `/login`; `/` routes by session)
- [x] A forged or expired Google token is rejected with 401
- [x] A stale/deleted session (logout, or row deleted) invalidates the cookie (`/api/auth/me` → 401 after logout)
- [x] Sessions store only token hashes (DB probe: `token_hash` = 64 hex chars, never a JWT)
- [ ] Cookie flags correct in production (secure, httpOnly, sameSite=lax) — **verify at deploy** (local dev intentionally omits `secure`)
- [x] Login page and header match the design at desktop and mobile width (375/768/1440: no overflow, no overlap, clamp headlines)
- [x] Lint and build pass

## Sign-off

- Tested on: 2026-10-28 (live Google sign-in, redirect flow)
- Issues found and fixed: UI v2 pass fixed 10 owner-reported issues (layout overlap, nav collision, contrast, hierarchy, stat row, primary CTA — commit ee8a2d8). Auth switched from GIS iframe to OAuth redirect flow for real hover/focus states.
- Follow-ups moved to backlog: verify cookie `Secure` flag at production deploy.
