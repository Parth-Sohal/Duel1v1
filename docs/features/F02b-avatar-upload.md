# F02b — Avatar upload

Status: shipped (2026-10-28, dev-verified)
Branch: feature/F02b-avatar-upload (created from feature/F03-email-login)
Depends on: F02 (profile)

## Goal

A player can upload their own profile photo from their device — replacing the Google picture or the letter block — and remove it again.

## Scope

- In: `PUT /api/me/avatar` (upload), `DELETE /api/me/avatar` (remove), `GET /api/users/:id/avatar` (serve, public), `avatars` table (migration 0003), client-side resize to a 256×256 square before upload, CHANGE PHOTO / REMOVE controls on the profile.
- Out (not now): cropping UI (auto center-crop only), multiple images, server-side image processing, third-party storage (S3/Cloudinary) — the database stores the bytes; revisit if avatars grow beyond small squares.

## Behavior

- The browser center-crops the chosen file to 256×256 on a `<canvas>` and uploads it as a JPEG data URL (~10–40 KB). The server re-validates everything: data-URL shape, allowed MIME (jpeg/png/webp), magic bytes, size cap — the client is never trusted.
- Upload stores the bytes in `avatars` (base64 text, one row per user) and points `users.avatar_url` at `/api/users/{id}/avatar?v={unix}` — the version keeps caches honest after re-uploads.
- `DELETE` removes the row and nulls `avatar_url` (the letter block returns).
- Precedence: an upload always wins over the Google photo. Google sign-in only fills the avatar when there is **no local upload** (never overwrites one).
- Serving: `GET /api/users/:id/avatar` is public (avatars are public profile data, same as a Google-hosted URL), correct `Content-Type`, short cache.

## API

| Method | Path | Auth | Response |
|---|---|---|---|
| PUT | `/api/me/avatar` | cookie | 200 `{ user }` · 400 invalid image · 401 · 413 too large |
| DELETE | `/api/me/avatar` | cookie | 200 `{ user }` · 401 |
| GET | `/api/users/:id/avatar` | none | 200 image bytes · 404 no avatar / unknown id |

## Data

Migration 0003 adds `avatars`: `user_id` uuid PK → users (cascade), `mime` text, `data` text (base64), `updated_at`. Photos are ≤ 256×256 and capped at ~150 KB decoded, so rows stay small.

## Rules and safety

- Magic-byte check (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF…WEBP`) — a renamed text file is rejected.
- Size cap enforced after base64 decode; oversize → 413.
- No image processing on the server; bytes are stored and served back with the validated MIME type only.
- Public profile pages get the avatar through the same public URL — no private fields involved.

## Test checklist

- [x] Upload via the profile page shows the photo immediately (and after refresh)
- [x] Re-upload replaces the photo (versioned URL, no stale cache)
- [x] Remove brings back the letter block
- [x] Non-image data (renamed text file), wrong MIME, oversize → 400/413
- [x] `GET /api/users/:id/avatar` returns image bytes; unknown id → 404
- [x] Google photo does not overwrite an upload at next sign-in (code-guarded: the refresh skips any local `/api/...` URL; first real re-sign-in with an upload — account "Khatarnak" — pending natural observation)
- [x] Public profile shows the uploaded avatar
- [x] Layout matches the design at desktop and mobile width (375 / 768 / 1440, zero horizontal overflow)
- [x] Lint and build pass (tsc + eslint clean; `next build` green)

## Sign-off

- Tested on: 2026-10-28 (dev, branch `feature/F02b-avatar-upload`) — 14/14 API matrix checks (`scripts/f02b-api-test.ts`), live UI round-trip in the browser (upload → remove → re-upload → version bump), public profile SSR check, responsive iframe probes.
- Issues found and fixed:
  - `DELETE` with a `content-type: application/json` header and no body was rejected by Fastify's parser — test-harness bug, fixed in the test script (product behavior was correct).
  - `next/image` lazy loading never fired for avatar `<img>`s in the test browser (zero network entries, even in-viewport). Avatars are 3–4 KB and always above the fold, so `Avatar` now renders `loading="eager"`.
- Follow-ups moved to backlog: crop/zoom UI, object storage migration if avatars grow.
