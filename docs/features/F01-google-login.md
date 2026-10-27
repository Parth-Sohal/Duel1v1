# F01 — Google login and session

Status: planned
Branch: feature/F01-google-login
Depends on: F00

## Goal

A player can sign in with Google, stay signed in across refreshes, and sign out. The server — never the browser — decides who the player is.

## Scope

- In: Google Identity Services button on the web app, `POST /api/auth/google` (verify ID token, find-or-create user, create session, set cookie), `GET /api/auth/me`, `POST /api/auth/logout`, cookie-auth middleware for protected routes, `users` + `sessions` tables (migration 0001), login page UI.
- Out (not now): profile editing and public profiles (F02), bot users, email/password login, rate limits beyond basics.

## UI

- Login page (from the owner's design): Google sign-in button, arena branding.
- Header (from the owner's design): avatar + display name when signed in, sign-out control; plain "Sign in" link when not.

## Behavior

- Web loads Google Identity Services and sends the ID token to `POST /api/auth/google`.
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
- No secrets in git; `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` added to `.env.example`. `SESSION_SECRET` removed from `.env.example` (not needed — DB-backed sessions, no signed JWT).

## Test checklist

- [ ] New Google account creates a user; a returning account reuses the row
- [ ] Refresh keeps you signed in; logout ends the session
- [ ] Protected page redirects when signed out
- [ ] A forged or expired Google token is rejected with 401
- [ ] A stale/deleted session (logout, or row deleted) invalidates the cookie
- [ ] Sessions store only token hashes (inspect DB row)
- [ ] Cookie flags correct in production (secure, httpOnly, sameSite=lax)
- [ ] Login page and header match the design at desktop and mobile width
- [ ] Lint and build pass

## Sign-off

- Tested on: —
- Issues found and fixed: —
- Follow-ups moved to backlog: —
