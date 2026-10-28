# F03 — Email + password login

Status: built + tested (2026-10-28)
Branch: feature/F03-email-login (created from feature/F02-profile)
Depends on: F01 (sessions, users)

## Goal

A player can create an account with email and password — no Google needed — and sign in with it. Same sessions, same profile, same rules.

## Scope

- In: `POST /api/auth/register` (create account, auto sign-in), `POST /api/auth/login`, password hashing (scrypt via `node:crypto`, random salt, timing-safe compare), login rate limiting, `credentials` table (migration), email/password form on the login page (Sign in / Create account toggle).
- Out (not now): email verification + password reset (parked as follow-up — needs an email-sending provider), account linking (Google + email on one user), social logins beyond Google (backlog).

## UI

- Login page dark half: Google button, an "or continue with email" divider, then the email form with a SIGN IN / CREATE ACCOUNT toggle (display-name field appears only in create mode). Errors shown as sentence-case text, never vague.

## Behavior

- Register: `{ email, password, displayName }`. Email trimmed + lowercased, basic format check; password 8–200 chars; display name re-validated 2–30 (shared rule). Creates the `users` row (google_id null — manual player) + `credentials` row, then signs the player in (session + cookie, same as Google flow).
- Login: `{ email, password }`. Same generic error for unknown email and wrong password (no account enumeration): 401 `invalid_credentials`.
- Email already registered → 409 on register (unavoidable for signup UX; documented tradeoff).
- **Rate limit** (in-memory, per email and per IP): after 8 failed logins in 15 minutes → 429 with a clear message; successful login resets the count. Single-instance dev/prod is fine; Redis arrives with the scaling backlog item.
- Verified player lands on `/profile` exactly as with Google.

## API

| Method | Path | Auth | Response |
|---|---|---|---|
| POST | `/api/auth/register` | none | 200 `{ user }` + session cookie · 400 invalid input · 409 email taken |
| POST | `/api/auth/login` | none | 200 `{ user }` + session cookie · 401 invalid credentials · 429 rate limited |

## Data

Migration adds `credentials`: `id` uuid pk, `user_id` uuid unique FK → users (cascade), `password_hash` text, timestamps. The password is **never** stored — only the salted scrypt hash (`scrypt$N$r$p$salt$hash`, parameters recorded in the hash string so they can be strengthened later without a reset).

## Rules and safety

- Passwords hashed with scrypt (N=16384, r=8, p=1, 32-byte key, 16-byte random salt); constant-time comparison; no plain passwords or their hashes in any log.
- Password policy: 8–200 characters (length over composition rules — composition rules get gamed).
- Rate limiting is server-side; the client form is a convenience, not the guard.
- `credentials.user_id` is unique: one password per account.
- No new secrets required.

## Test checklist

- [x] Register creates the account and signs the player in (lands on /profile) — verified via API **and** through the real form (live UI round-trip)
- [x] Duplicate email → 409; weak/short password → 400; bad display name → 400; malformed email → 400
- [x] Login with the right password works; wrong password → 401 generic (identical body for unknown email — no account enumeration)
- [x] 8 failed attempts → 429; a successful login clears the count (per email AND per IP)
- [x] DB shows only the scrypt hash in `credentials` (`scrypt$16384$8$1$salt$key`, 32-byte key), never a password
- [x] Manual and Google accounts both work through the same session/profile pages
- [x] Layout matches the design at desktop and mobile width (375/768/1440: no overflow; signed-in users redirected away from /login as expected)
- [x] Lint and build pass

## Sign-off

- Tested on: 2026-10-28 (API matrix via scripts/f03-api-test.ts + live form round-trip in the browser)
- Issues found and fixed: test-harness accounting only (IP limiter counts failures across test steps, as designed). No product bugs.
- Follow-ups moved to backlog: email verification + password reset (needs an email provider), account linking (Google + email on one user), Redis-backed rate limiting for multi-instance.
