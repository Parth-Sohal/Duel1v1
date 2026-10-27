# Screens

What each designed screen contains, what data it needs, and what is in or out of v1. Screenshots are in `docs/ui/screens/`. Style rules are in `README.md` and values in `design-tokens.md`.

Legend for the "v1" column: **Yes** = in the planned iteration; **Later** = needs data or features that are not planned yet.

## 1. Header (all pages)

Across both halves: logo `{ duel }`, nav items, and the user chip `NAME / RATING`.

| Nav item in the design | Meaning | Status |
|---|---|---|
| PLAY | Start a duel | Iteration 3 (practice in 2) |
| SKILL MAP | The player's profile | Iteration 1 |
| LEAGUES | Seasons and leaderboard | Later |
| CREATE | Create your own challenge | Backlog |
| LIVE ARENA (accent color) | Watch live duels | Backlog |
| User chip | Name and rating; links to the profile | Iteration 1 |

Rule: show only items that exist. In v1 the header has the logo, the profile link, Play once it exists, and the user chip.

## 2. Play screen (`play-1-choose-format.png`, `play-2-start-duel.png`)

**Left half, "STEP 1 / CHOOSE A FORMAT"**
- Headline "PICK A DUEL."
- Four numbered format rows: Bug Hunt (selected, "TODAY", 10+5 min), Speed Duel (10 min), Optimize (12 min), Async Challenge (24 h).
- Difficulty: EASY, MEDIUM, HARD.
- Opponent: RIVAL, ANYONE, KERN BOT.
- Note: "Best of three rounds. Every round, KERN plants a fresh bug. Rating changes only when the match ends."
- Footer: "MATCHED BY SKILL GAP / NEXT ROUND".

**Right half, "STEP 2 / WHO YOU WILL FACE"**
- Headline "YOUR MATCH."
- Radar scan with "SEARCHING 00:49" and "LIVE".
- Candidate list with rating and "% FIT" (for example AMAN 1438 / 94% FIT).
- Table: YOU vs opponent, FORMAT, CLOCK, DIFFICULTY, HEAD TO HEAD.
- Full-width "START DUEL" button.
- Footer: "STARTS WHEN BOTH PLAYERS ARE READY".

**How it maps to our product**

| Design element | v1 behavior |
|---|---|
| Format list | **Speed Duel** is our game ("Same problem. Fastest correct solution wins.", 10 min). Show it as the only format. Bug Hunt, Optimize, and Async Challenge are later formats. The "TODAY" badge fits the daily challenge (Iteration 4). |
| Clock | "10 MIN" for Speed Duel (no extra "+5") |
| "Best of three rounds" | Does **not** apply to Speed Duel: one problem per match. Change the copy to "One problem. First correct solution wins. Rating changes only when the match ends." |
| Difficulty | Supported: `challenges.difficulty` exists. The match picks a challenge of that difficulty (still avoiding recent ones). |
| Opponent: RIVAL | Friend duel through an invite link (Iteration 3) |
| Opponent: KERN BOT | Bot opponent (Iteration 4) |
| Opponent: ANYONE | Random matchmaking (Iteration 5, F9) |
| Radar and "% FIT" | Only needed for matchmaking. For a friend duel, replace the right half with a waiting state: "WAITING FOR YOUR RIVAL." with the invite link and ready status. Add the radar in Iteration 5. |
| Head to head | Derivable from match history between two players; no new table |
| Footer captions | Keep, adapted to the real rules |

## 3. Profile / Skill Map (`profile-1-top.png`, `profile-2-skill-map-rivals.png`)

**Left half**
- Eyebrow "PLAYER PROFILE", headline = player name.
- Chips: rank title (filled, e.g. "BUG HUNTER II"), "RATING 1,438", "118 WINS / 96 LOSSES".
- Skill map: six-axis radar (Recursion, Graphs, Dyn. Prog, Strings, Edge Cases, Debug Speed), solid polygon now and dashed polygon 30 days ago.
- "NOW VS 30 DAYS AGO" list with value and change per skill.
- Footer: "SKILL MAP UPDATES AFTER EVERY DUEL".

**Right half**
- "LAST 20 WEEKS", headline "12 DAY STREAK." with a block cursor.
- Heatmap of 20 weeks by 7 days; line with day detail ("WEEK 10 · SUN — 4 DUELS PLAYED") and totals ("214 DUELS / 12 DAY BEST STREAK").
- Rivals: name, note, head-to-head score, REMATCH.
- Badges: "3 OF 8 EARNED" (First Blood, No Hints, One-Char Fix, 15 Day Streak with progress).
- Footer: "DASHED LINE IS 30 DAYS AGO".

| Element | Data needed | Plan |
|---|---|---|
| Name, avatar | `users` | Iteration 1 |
| Rating, wins, losses | `users` (rating decision D7) | Iteration 1 shows the values; they change from Iteration 3 |
| Rank title | Mapping from rating to a title (decision D8) | Iteration 3 or later; before that, show no title |
| Streak and heatmap | Daily counts of matches and practice runs (derived by query, no new table) | After Iteration 3 |
| Rivals and head to head | Match history between pairs (query) | After Iteration 3 |
| Rival notes ("His weak spot: edge cases") | Generated text | Later; v1 shows only score and REMATCH |
| Skill map and 30-day comparison | Per-skill scores from challenge `tags` and results, plus a stored snapshot every day or week to compare with 30 days ago | New table (for example `skill_snapshots`); Iteration 5 or later. The design's "Edge Cases" and "Debug Speed" belong to Bug Hunt; for Speed Duel use tag-based skills (recursion, graphs, dynamic programming, strings, and so on). |
| Badges | `badges` and `user_badges` tables, award rules | Later |

**Iteration 1 profile (what we build first):** the left half with name, chips (rating, wins and losses, no rank title yet) and, under it, an empty state in the same style. The right half shows empty states with the same headline style, for example "NO DUELS YET." with a line telling the player what unlocks the streak, rivals, and badges. Do not show fake data.

## 4. Leagues (`leagues-1-top.png`, `leagues-2-college-clash.png`)

**Left half**
- "SEASON 04 / STACK LEAGUE", headline "23 DAYS LEFT.", progress bar "DAY 67 OF 90".
- Four tier cards: BYTE (bottom), WORD (drop zone), STACK (you are here), KERNEL (next).
- Rule text: top 5 move up, bottom 5 drop.
- "COLLEGE CLASH / THIS WEEK": your club versus another club with weekly points, contributors, and a two-tone bar.

**Right half**
- "STACK LEAGUE / TOP 30" with "UPDATES LIVE".
- Table: rank, player, last five results (filled square = win, hollow = loss), rating.
- Dashed "PROMOTION LINE" after rank 5; your row highlighted with a "YOU" tag.
- Call to action: "10 POINTS FROM THE PROMOTION LINE." and a "FIND A DUEL" button.

| Element | Data needed | Plan |
|---|---|---|
| Leaderboard (rank, player, rating, last five) | Ratings and recent match results (queries) | Iteration 5 (F9) |
| Seasons, tiers, promotion and relegation | `seasons`, tier per player per season, end-of-season job | Later; big feature |
| College Clash (clubs, weekly points) | `clubs`, membership, weekly totals | Later; fits the student audience well, so worth planning after launch |
| "Points from the promotion line" call to action | Derived from the leaderboard | With leaderboard |

## 5. Screens still to design

These do not appear in the screenshots and need the same visual language:

| Screen | Iteration | Notes |
|---|---|---|
| Login | 1 | **Designed 2026-10-27** (owner HTML mockup): brutalist split 7/5, "SIGN IN." hero, rules block, languages chips, dark auth portal with custom Google button, protocol card, rules ticker. GitHub sign-in and guest mode are shown in the mockup but not built (F01 is Google only). Sample stats in the mockup (duels running, latency, countdown, rating bands) are omitted per the no-sample-data rule. |
| Practice (code editor) | 2 | Problem statement on one half, editor and results on the other; monospace, hairline rules |
| Room lobby | 3 | Invite link, both players' ready status |
| Live match | 3 | Countdown timer, editor, opponent status, live event feed |
| Result | 3 | Win or loss headline, rating change, test results, play again |
| Match history | 3 | Table in the same style as the leaderboard |

Show each of these to the owner before it is built.

## 6. Decisions this design raises

| # | Decision | Recommendation |
|---|---|---|
| D7 | Rating system. The design shows a rating like 1,438 and "rating changes only when the match ends". The plan currently says winner +1, loser −1. | Use a simple Elo-style rating (start 1,000, K = 32). It matches the design, needs about ten lines of code, and the data model already stores points before and after each match. Decide before Iteration 3. |
| D8 | Rank titles (for example "BUG HUNTER II"): names and rating bands | Define a short ladder before Iteration 3, or show no title until then |
| D9 | Light and dark halves: final design or a theme switch | **Decided 2026-10-27: split layout is final, no theme switch.** |
| D10 | Mobile layout | **Decided 2026-10-27: halves stack on mobile (cream first), nav collapses to a menu.** |

## 7. Build rule for the AI coding tool

For Iteration 1, build only: the split shell, the header (logo, profile link, user chip), the login screen, and the profile left half plus empty states. Use the colors and fonts in `design-tokens.md`. Do not build leagues, skill map, badges, clubs, or the play screen yet, and do not use sample data.
