# F02 — Profile

Status: planned
Branch: feature/F02-profile (created from feature/F01-google-login)
Depends on: F01

## Goal

A player sees their own stats, can edit their display name, and can view another player's public profile — with no private data leaking.

## Scope

- In: own profile page (stats + hero panel), `PATCH /api/me` display-name editing, public profile page `/u/[id]`, `GET /api/users/:id` (public fields only), header avatar linking to own profile.
- Out (not now): match history list (F06), stats beyond points/wins/losses/draws, avatar upload (Google picture only in v1).

## UI

- Profile page (from the owner's design): hero panel with avatar, name, points; stat bars for wins / losses / draws.
- Edit mode: inline display-name field with character counter (2–30), save/cancel.
- Public profile: same layout, no edit controls, owner's design variant.

## Behavior

- `GET /api/me` (cookie) returns own profile including points and W/L/D.
- `PATCH /api/me` accepts `{ displayName }`; server trims, validates 2–30 chars after trim, rejects empty or oversized with 400 and a clear message; updates `updated_at`.
- `GET /api/users/:id` returns `{ id, displayName, avatarUrl, points, wins, losses, draws, createdAt }` — **no email, no session data**; 404 for unknown ids.
- Profile pages render server-side friendly (fetch through the server API, not client-only), so refresh always shows current data.

## API / events

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/api/me` | cookie | 200 `{ user }` · 401 |
| PATCH | `/api/me` | cookie | 200 `{ user }` · 400 invalid name · 401 |
| GET | `/api/users/:id` | cookie | 200 `{ user }` · 404 |

## Data

No new tables. Reads `users` only.

## Rules and safety

- Public profiles expose exactly the fields in the table above — email and `google_id` never leave the server.
- Display-name validation is server-side; the client field is a convenience, not the guard.
- Points/W-L/D are read-only here (written only by the match engine, F05).

## Test checklist

- [ ] Own profile shows correct data (name, avatar, points, W/L/D)
- [ ] Editing the name saves and shows everywhere (header, profile)
- [ ] Empty name, 1-char name, and 31+ char names are rejected with a clear error
- [ ] Another player's public profile loads without private fields (verify no `email` in the network tab)
- [ ] Unknown user id returns 404 (not a crash or empty page)
- [ ] Refresh shows current data (no stale cache)
- [ ] Layout matches the design at desktop and mobile width
- [ ] Lint and build pass

## Sign-off

- Tested on: —
- Issues found and fixed: —
- Follow-ups moved to backlog: —
