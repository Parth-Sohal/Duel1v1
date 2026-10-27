# UI Notes

How the interface should look and where the design comes from. Read this before building any screen.

## 1. Source of the design

- **Primary source:** the owner's "{ duel }" design screens: Play, Profile / Skill Map, and Leagues. Screenshots are in `docs/ui/screens/`.
- **Secondary source:** the "Traceoff" AI Studio export (fonts, libraries, content ideas). Keep it in `docs/ui/reference/traceoff/` as reference only. See `traceoff-reference.md`.
- **Not designed yet:** login, practice (code editor) screen, room lobby, live match screen, result screen, match history. These must be extended in the same style and shown to the owner before they are finalized.
- **The earlier "yellow accent" description is replaced.** The screenshots use an orange-red accent (about `#FF4D1C`) on cream and near-black. Follow the screenshots.

## 2. The look in one paragraph

A **split-screen layout**: a cream panel on the left and a near-black panel on the right, joined by one navigation bar that runs across both, with a small orange marker where the two halves meet. Huge condensed uppercase headlines that end in a period ("PICK A DUEL.", "NIPUN.", "23 DAYS LEFT."), small spaced-out monospace labels, thin rules between rows, a faint dotted-grid background, and a single orange accent used for the main action and the key numbers. Terse, confident copy.

## 3. Rules for every screen

1. Use the split layout on desktop: primary content on the cream half, live or secondary content on the dark half.
2. One orange accent only. Use it for the main button, the active state, and key numbers. Never add a second accent color and never use gradients.
3. Headlines: condensed display font, uppercase, ending with a period. Labels and data: monospace, uppercase, letter-spaced. Descriptions: small monospace or sans text.
4. Hairline rules (1 px) separate rows. Avoid shadows and rounded corners; panels are flat with square corners.
5. Selected state is a solid fill (near-black on cream, off-white on dark). Unselected is outlined.
6. Only show real data. No fake counters or sample names in production screens. When there is no data yet, show an empty state in the same style (for example "NO DUELS YET.").
7. Only show navigation items that exist. Do not add links to features that are not built.
8. Every screen needs loading, empty, and error states.
9. The browser only displays what the server says (timer, scores, winner, rating).
10. Check text contrast, especially the small gray labels on both backgrounds.
11. Mobile: the designs show desktop only. Proposed behavior: the two halves stack (cream first, then dark) with the nav collapsing to a menu. Confirm with the owner before building.

## 4. Where each screen lives in the plan

| Screen | Iteration | Notes |
|---|---|---|
| Header and split shell | 1 | Shown on every page |
| Login | 1 | Not designed; extend the style |
| Profile (top part) | 1 | Name, rank chip, rating, wins and losses; other panels show empty states |
| Practice screen | 2 | Not designed; extend the style |
| Play screen (format, difficulty, opponent, match panel) | 3 | Friend duels first; bot in 4; matchmaking in 5 |
| Room lobby, match screen, result screen, history | 3 | Not designed |
| Skill map, streak heatmap, rivals | 3 to 5 | Needs match data (see `screens.md`) |
| Leagues and leaderboard | 5 or later | Needs ratings and seasons |
| Badges, clubs ("College Clash") | Later | Backlog |

Full per-screen detail, the data each one needs, and what is in or out of v1: `screens.md`.

## 5. Files in this folder

```text
docs/ui/
├── README.md               # this file
├── design-tokens.md        # fonts, colors, layout values, components
├── screens.md              # each designed screen: parts, data needed, scope
├── traceoff-reference.md   # what the Traceoff export contains
├── screens/                # the design screenshots
│   ├── play-1-choose-format.png
│   ├── play-2-start-duel.png
│   ├── profile-1-top.png
│   ├── profile-2-skill-map-rivals.png
│   ├── leagues-1-top.png
│   └── leagues-2-college-clash.png
└── reference/
    └── traceoff/           # the full export, reference only
```

## 6. Still needed from the owner

- Confirm light and dark panels in one layout is the intended final design (and not a theme switch).
- Designs or approval for the screens not designed yet (login, practice, match, result).
- Mobile behavior (section 3, rule 11).
- The decisions in `screens.md` section 6 (rating system, rank titles).
