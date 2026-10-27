# Design Tokens

Shared look-and-feel values. The code reads these from `apps/web/styles/` so every screen stays consistent.

Status: **colors were sampled from the design screenshots** (`docs/ui/screens/`), so they are accurate to the pixel but not copied from source code. Fonts come from the Traceoff export. Sizes and spacing below are **estimates from the screenshots** and should be adjusted by eye against the designs.

## 1. Colors (sampled)

| Token | Value | Where it appears |
|---|---|---|
| `--cream` | `#EFECE6` | Left panel background |
| `--ink` | `#0D0D0D` | Right panel background |
| `--ink-raised` | `#111111` | Selected row and filled chips on the cream side; dark rows |
| `--ink-surface` | `#1D1D1D` | Empty heatmap cells, subtle dark surfaces |
| `--paper` | `#F5F3EE` | Highlighted card on the dark side (best match, "you" row); text on dark |
| `--accent` | `#FF4D1C` | Main button, key numbers, active nav, "TODAY" badge, progress bars, radar fill outline |
| `--accent-mid` | `#8F2F16` | Heatmap level 3 |
| `--accent-low` | `#4D1E12` | Heatmap level 2 |
| `--muted-light` | `#7A756D` | Secondary text on cream |
| `--muted-dark` | `#9F9F9F` | Secondary text on dark |
| `--rule-dark` | `#2C2C2C` | Hairline rules and outlines on dark |
| `--rule-light` | `#D5D1C9` (estimate) | Hairline rules on cream; confirm by eye |
| `--radar-fill` | accent at about 35% opacity on cream (looks like `#F5AF9A`) | Skill map polygon |

Heatmap scale, from no activity to most activity: `#1D1D1D`, `#4D1E12`, `#8F2F16`, `#FF4D1C`.

Rules: one accent only, no gradients, no purple. Check contrast of `--muted-light` and `--muted-dark` at small sizes.

## 2. Fonts (from the Traceoff export)

Loaded from Google Fonts: Anton, Barlow Condensed (600, 700, 800), IBM Plex Mono (400 to 700), Plus Jakarta Sans (400 to 700).

| Use in the design | Font (best match; confirm against the export's source if shared) |
|---|---|
| Huge headlines ("PICK A DUEL.", "NIPUN.") | Anton |
| Names in lists, card titles ("AMAN", "BUG HUNT"), big numbers | Barlow Condensed 700 to 800 |
| Labels, nav, table rows, captions, timers | IBM Plex Mono, uppercase, letter-spaced |
| Longer body text | Plus Jakarta Sans (the designs show little of it) |

## 3. Layout

| Item | Value |
|---|---|
| Desktop layout | Two equal halves: cream left, near-black right, full-height |
| Navigation | One bar across both halves; logo and primary nav left, secondary nav and user chip right |
| Divider marker | Small orange square (about 12 x 4 px) where the halves meet, under the nav and at the bottom rule |
| Content padding | About 40 px from the outer edge of each half |
| Background texture | Faint dotted grid on both halves |
| Footer line | Thin rule with a monospace caption on each half |
| Corner radius | 0 (square), except the round radar |
| Shadows | None |
| Rules | 1 px hairlines between list rows |

## 4. Type scale (estimates)

| Style | Size | Notes |
|---|---|---|
| Hero headline | 72 to 96 px | Anton, uppercase, ends with a period |
| Name or card title | 28 to 40 px | Barlow Condensed, uppercase |
| Big stat number | 24 to 32 px | Barlow Condensed |
| Eyebrow label | 11 to 12 px | IBM Plex Mono, uppercase, wide letter-spacing, muted color |
| Table row text | 12 to 13 px | IBM Plex Mono, uppercase |
| Description | 12 to 13 px | IBM Plex Mono or Plus Jakarta Sans, sentence case |

## 5. Components seen in the designs

| Component | Description |
|---|---|
| Nav bar | Logo `{ duel }`; items in mono caps; active item underlined (dark on cream, accent on dark); one item in accent color |
| User chip | `NAME / RATING` in mono caps, right-aligned |
| Eyebrow + headline | Small label above a huge headline |
| Format row | Number, big title, one-line description, duration at the right; selected row is solid near-black with an optional accent badge |
| Segmented buttons | Outlined boxes in a row; selected is solid fill |
| Primary button | Full-width block in accent color, mono caps, wide letter-spacing ("START DUEL") |
| Chip | Outlined box with mono caps text; filled version for the rank |
| Candidate row | Name, rating and "% FIT" at the right, thin progress bar below; best match is an off-white card |
| Radar scan | Concentric circles, an orange sweep wedge, dots for candidates |
| Key-value table | Label left (muted), value right, hairline between rows |
| Skill hexagon | Six-axis radar; solid accent polygon for now, dashed polygon for 30 days ago |
| Delta list | Metric name, big value, small change on the right; a big jump gets an accent badge |
| Heatmap | 20 weeks by 7 days, four activity levels |
| Rival row | Name, one-line note, head-to-head score, "REMATCH" action |
| Badge card | Earned (accent fill or outlined) and locked (dimmed, with progress like "12 OF 15") |
| Tier cards | Four boxes: outlined, outlined, solid dark ("you are here"), solid accent ("next") |
| Leaderboard row | Rank, name, last five results as squares, rating; dashed accent "PROMOTION LINE"; your row is off-white with an accent "YOU" tag |
| Split progress bar | Two-tone bar comparing two totals |
| Footer caption | Mono caps note under a rule |

## 6. Motion (suggestions, not in the screenshots)

Radar sweep rotating while searching, a blinking block cursor after the streak headline, short fades when panels update. Use the `motion` library and respect reduced-motion settings.

## 7. Libraries

| Need | Library |
|---|---|
| Styling | Tailwind CSS v4 |
| Icons | `lucide-react` (the designs show few icons) |
| Animation | `motion` |

Confirm in the first build that these install cleanly with the chosen Next.js version.
