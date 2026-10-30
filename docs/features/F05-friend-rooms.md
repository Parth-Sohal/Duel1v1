# F05 — Friend rooms (create, invite, join, presence)

Status: spec (2026-10-29)
Branch: feature/F05-duels
Depends on: F01 (sessions), F04 (challenges for the match itself)
PLAN reference: Iteration 3, "F4 Friend rooms"

## Goal

Two friends get into the same room, see each other, ready up, and start a duel. Live connection: presence and ready state update instantly.

## Scope

- In: `rooms` table (migration 0006), `POST /api/duels/rooms` (create → invite code), `GET /api/duels/rooms/:code` (room state, poll fallback), Socket.IO gateway for live presence/ready/state events, ready toggle, host start (→ creates the match, F06), room expiry (ROOM_TTL_MS), reconnect resends full room state.
- Out (not now): matchmaking with strangers (backlog "ANYONE"), bot opponent (iteration 4, "KERN BOT"), spectator/live arena (backlog), chat, best-of-three rounds (design shows it; v1 = single duel per room).

## Invite codes

- 8-char base32 (Crockford alphabet, no I/L/O/U), generated server-side, unique.
- Link: `/duel/:code`. Room expires after ROOM_TTL_MS; joining an expired/unknown code → clear error. Codes are case-insensitive (uppercased on input).

## Socket auth (works cross-origin in production)

The session cookie lives on the web origin, so the browser cannot cookie-auth a direct socket to the game server (different domain on Vercel/Render). Instead: `GET /api/duels/socket-token` (cookie-authed) issues a one-time token (random, in-memory, userId-bound, SOCKET_TOKEN_TTL_MS, single use). The browser opens `io(GAME_WS_URL, { auth: { token } })`; the server validates the token, binds the socket to the userId, discards the token. Reconnect repeats the token dance. CORS allowlist = web origin.

## Socket events (server → client)

| Event | Payload | When |
|---|---|---|
| `room_state` | full room (players + presence + ready + status + matchId?) | on join, reconnect, and any change (authoritative resend) |
| `room_closed` | `{ reason }` | host left / expired / match started elsewhere |
| `match_started` | `{ matchId }` | host pressed start with both ready |

Client → server: `room:join { code }`, `room:ready { ready }`, `room:leave`, `match:start` (host only, both ready).

Presence rule: a socket disconnect marks the player disconnected; reconnect within the same room re-marks present. Room with no present players for 5 minutes → closed (sweeper).

## Server rules

- Max 2 players per room (join a full room → error `room_full`); the host is seat 1, the joiner seat 2.
- Ready toggles are per-player; start requires both present + ready.
- Starting creates the match (F06) and flips room status to `in_match`.
- Everything authoritative lives in Postgres; sockets only push. A refresh mid-room reconnects and gets `room_state` — no client-side truth.
- A player in an active match cannot join another room (`already_in_match`).

## UI (brutalist, extends the owner PLAY design)

- **`/duel`** — "PICK A DUEL." cream half: the one real format (SPEED DUEL — same problem, fastest correct solution wins, 10 MIN) + difficulty selector EASY / MEDIUM / HARD / ANY. Dark half "YOUR MATCH.": big CREATE ROOM button (orange), an invite-code join input, and a short rules block (10 min, fastest pass wins, D5 points). Nav gains PLAY (active on /duel, /duel/:code, /match/:id).
- **`/duel/:code`** — room lobby: both seats with presence dots (orange = live), ready toggles, invite link + COPY, difficulty shown; host START button enables when both ready; clear errors for full/expired rooms.

## Test checklist

- [x] Host creates a room and gets a link; friend joins and both see each other instantly (socket push) *(f05 API matrix)*
- [x] Refreshing a tab reconnects to the same room with full state *(lobby re-mount = idempotent REST join + socket `room:join` → full `room_state`; verified at API/socket layer)*
- [x] A third person cannot join a full room; expired/unknown invite → clear error *(409 `room_full` / 404 `room_unavailable`)*
- [x] A player in an active match cannot join another room *(409 `already_in_match`)*
- [x] Start requires both present + ready (host-only action) *(409 `not_both_ready` / 403 `host_only` / 200 with matchId)*
- [x] Socket token is one-time and short-lived; direct socket without a token rejected *(first use ok, reuse rejected, no-token rejected; TTL = `SOCKET_TOKEN_TTL_MS`)*

*(Verified 2026-10-30 against the real server + Neon: `npx tsx scripts/f05-api-test.ts` — 48/48.)*
