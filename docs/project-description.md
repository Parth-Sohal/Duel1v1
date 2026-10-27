# Project Description — Coding Duel

> Working name. Final product name is an open decision (see `PLAN.md`).

## 1. One-line summary

A web platform where two players get the same coding challenge and race to solve it within 10 minutes. The first to pass all tests wins a point and the other loses one.

## 2. The idea

Coding practice platforms are solitary and slow. Coding Duel borrows the head-to-head feel of competitive games (such as Clash Royale): short matches, a clear winner, visible progress, and a reason to come back for one more round. A match takes at most 10 minutes, so it fits into a break.

## 3. Who it's for

- Students and early-career developers preparing for coding interviews who want practice that feels like a game.
- Friends and classmates who want to challenge each other.
- Casual competitive programmers who want quick matches without a long contest.

## 4. Core loop

```text
Sign in → pick a mode (practice / friend duel / bot) → get a challenge
      → write code → submit → server tests it → win/lose → points update
      → review match (and AI feedback) → play again
```

## 5. Product rules (v1)

| Rule | Value |
|---|---|
| Match length | 10 minutes, timer owned by the server |
| Players per match | 2 |
| Challenge | One challenge per match, same for both players |
| Win condition | First submission that passes **all** tests |
| Points | Winner +1, loser −1, never below 0 |
| Time up, nobody solved | Draw, no point change |
| Disconnect | 30-second grace period, then forfeit |
| Repeat rule | A challenge played recently is avoided if others are available |
| Languages (launch) | JavaScript and Python (C++ and Java later) |
| AI feedback | Complexity estimate and suggestions, limited per user per day |

These are defaults. Changes are recorded in `docs/decisions/`.

## 6. MVP scope

**In:**
- Google sign-in and a player profile (points, win/loss record, history)
- Challenge library (30 to 50 hand-checked problems at launch)
- Practice mode with an IDE-style editor
- Friend rooms through invite links, live 1v1 matches
- Bot opponent and a daily challenge, so a lone player still has fun
- AI analysis of the player's own code, with a usage cap
- Game-style UI (dark panels, yellow accent, stat bars) from the supplied design files

**Out (not in v1):**
- Random matchmaking and rankings (added once enough players are online)
- User-created challenges
- Tournaments, seasons, chat, friend lists
- Facebook login, payments, mobile apps
- Redis, job queues, load balancers (added only when traffic requires them)

## 7. Principles

1. **The server is the referee.** The browser displays; it never decides winners, scores, or time.
2. **Player code never runs on the game server.** It runs only in a sandbox.
3. **Hidden tests never leave the server.**
4. **Small and shippable.** Each iteration produces something that works end to end.
5. **Simple first.** One game server, one database, managed services.

## 8. Success measures

- A new player completes a first practice challenge within 5 minutes of arriving.
- Two friends can complete a full duel with no unfair or broken outcome.
- Zero leaked hidden tests and zero sandbox escapes.
- After soft launch: share of players who return within 7 days, number of matches per active player, share of matches that finish rather than abandon.

## 9. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Empty queue at launch | Players leave | Friend rooms, bot opponent, daily challenge; matchmaking later |
| Running strangers' code | Security | Judge0 sandbox, no network, strict limits |
| Cost from code runs and AI calls | Budget | Per-user rate limits and caps, enforced on the server |
| Cheating (hidden tests, copied solutions) | Fairness | Hidden tests server-only, varied challenge pool, plagiarism checks later |
| Too much scope | Never ships | Iteration gates, backlog for new ideas |
| Weak challenge content | Poor experience | Hand-verify every challenge with a reference solution |

## 10. Glossary

- **Challenge:** a coding problem with a statement, starter code, limits, and tests.
- **Version:** an immutable snapshot of a challenge; matches point to the exact version used.
- **Room:** a private space where a host and a friend meet before a match.
- **Match:** one timed 1v1 game.
- **Submission:** a piece of code sent for testing, in practice or in a match.
- **Judge0:** the sandboxed service that runs submitted code against the tests.
- **Referee:** the game server logic that controls matches.
