# F12 — Java, C++ and editor intelligence

**Iteration 5 feature. Status: in build (branch `feature/F12-more-languages`).**

Real Java and C++ support in practice and duels, four visibly distinct keyword
colours (JS / Python / Java / C++), and auto-completing brackets and quotes.
The workbench layout and brutalist styling stay exactly as they are.

## Owner decisions

| Decision | Choice |
|---|---|
| Judge runtimes | **Java 91 (JDK 17.0.6)**, **C++ 105 (GCC 14.1.0)** — probed live on the public Judge0 box |
| Static-language contract | **Typed function-call harness** — the player writes a named function; no stdin/stdout parsing |
| Numeric type | **64-bit everywhere** (`long` in Java, `long long` in C++) — challenge values exceed 32 bits |
| Storage | **New immutable challenge versions** (`v1 → v2`) that add the Java/C++ maps; no mutation of v1 |
| Fair timing | Base 5 s × multiplier: JS 1.0, Python 1.5, Java 1.5, C++ 1.0 |
| Editor | Dependency-free overlay `<pre>` highlighter behind a transparent textarea; pairing handled in one pure function |

## Scope

### In
- Migration `0016_sturdy_karnak.sql`: `java` and `cpp` added to the `language` enum
- Shared language model: `LANGUAGES`, `JUDGE0_LANGUAGE_IDS`, `LANGUAGE_LABELS`,
  `FunctionParamType`, `FunctionSignature`, `EntryPoint`, `entryName`,
  `entrySignature`, `RUN_TIME_MULTIPLIERS`
- `judge-harness.ts`: dependency-free JSON reader + serializer preludes for Java and C++
- `judge.ts`: composes prelude + player code + generated `main`, applies the
  per-language time limit
- All 40 published challenges: Java/C++ signatures, starter code and a working
  reference solution each (`seed-data-f12-a/b/c/d.ts`, merged in `seed-data-f12.ts`)
- `f12-upgrade-versions.ts`: creates the four-language v2 versions, preserves
  tests/statements/limits, repoints `challenges.current_version`
- Workbench: JAVA and C++ chips, per-language scratchpads, syntax highlighting,
  bracket/quote auto-pairing, pair-aware Backspace, Tab indent
- Practice, duels, daily challenge and AI review all accept the two new languages
  through the shared `entryFunctionsOf` validation

### Out
- stdin/stdout-style problems (the arena grades a function's return value)
- More languages beyond these four
- Per-challenge, per-language time limits (the multiplier is global)
- Server-side execution of anything outside Judge0's sandbox

## Harness contract

The player writes **one function**; the server wraps it:

```
Java : class Solution { static <ret> name(<params>) { … } }
C++  : <ret> name(<params>) { … }
```

Supported parameter/return types: `number`, `string`, `boolean`, `number[]`,
`string[]`, `number[][]`. In Java `number` is `long` (arrays `long[]`,
`long[][]`); in C++ it is `long long` (`vector<long long>`, nested vectors).
The generated wrapper:

1. parses the test arguments from stdin as JSON,
2. calls the player's function with typed arguments,
3. serializes the return value as compact JSON on stdout.

The stored `expected` answer is the same compact JSON, so all four languages
compare byte-for-byte against the frozen value. The last non-empty stdout line
is the answer, so stray player prints do not break grading. Java receives the
prelude imports plus the `Main` class support; C++ receives `<bits/stdc++.h>`,
`using namespace std` and the `arena` namespace.

Validation is centralised in `services/challenges.ts` → `entryFunctionsOf`:
practice run/submit, duel run/submit, daily challenge and AI review all reject a
language the current version does not define, and static languages require a
well-formed typed signature.

## Storage and versioning

`challenge_versions` rows are immutable: submissions and in-flight matches
reference a version id. F12 therefore does **not** edit v1. Instead
`f12-upgrade-versions.ts` inserts `version + 1` with the same statement, tests,
frozen `expected` values, time and memory limits, plus the Java/C++ additions to
`entry_functions` and `starter_code`, then moves `challenges.current_version`.

The script is idempotent and defaults to a dry run:

```powershell
cd apps/server
npx tsx scripts/f12-upgrade-versions.ts           # report only
npx tsx scripts/f12-upgrade-versions.ts --apply   # write v2 + repoint
```

Existing JS/Python submissions keep pointing at v1 and remain valid; new runs
use v2.

## Web editor

- **Chips** — JS / PY / JAVA / C++; a language is disabled when the current
  version has no entry function or starter code for it.
- **Scratchpads** — switching languages never discards typed code.
- **Highlighting** — `lib/highlight.ts` tokenizes keywords, strings, comments and
  numbers per language. Keyword hues are distinct: JS orange, Python yellow,
  Java blue, C++ purple. Literals/comments share one palette. The `<pre>` layer
  is `aria-hidden`; the textarea keeps the real text and caret.
- **Pairing** — `lib/editor.ts` is a pure key-edit function:
  - `(`, `[`, `{`, `"`, `'`, `` ` `` insert the closing character; with a
    selection, the selection is wrapped and stays selected inside the pair.
  - Typing a closer over an auto-inserted closer moves past it.
  - Backspace between a matching pair deletes both characters.
  - Brackets/quotes inside a string or comment are literal (no pairing).
  - Tab inserts two spaces.

## Verification

| Gate | Command | Result |
|---|---|---|
| Java references vs frozen answers (all tests) | `$env:F12_LANGS='java'; npx tsx scripts/f12-verify.ts` | **40/40 challenges, 201 judge calls** |
| C++ references vs frozen answers (all tests) | `$env:F12_LANGS='cpp'; npx tsx scripts/f12-verify.ts` | **40/40 challenges, 201 judge calls** |
| Four-language pool gate after upgrade | `npx tsx scripts/challenge-verify.ts` | **40/40 published versions × 4 languages** |
| Editor tokenizer + pairing | `npx tsx apps/web/scripts/f12-editor-check.ts` | **20/20** |
| Version upgrade plan | `npx tsx scripts/f12-upgrade-versions.ts` | **40 planned, 0 missing** |
| Version upgrade applied | `npx tsx scripts/f12-upgrade-versions.ts --apply` | **40 v2 versions created** |
| Server build | `npm run build --workspace apps/server` | pass |
| Web typecheck / lint / build | `npx tsc --noEmit`, `npm run lint`, `npm run build` in `apps/web` | pass |

Hidden tests never leave the server: run/submit redact hidden inputs and expected
values exactly as before, and the Java/C++ wrappers change only how code executes,
not what is returned to the browser.

## Build note

While validating this branch the web build exposed a packaging regression in
`@sentry/nextjs@11.10.0` / `@sentry/server-utils@11.10.0`: their published
tarballs omit files the SDK imports (`common/traceMetaTags.js`,
`orchestrion/config/node-cron.js`, `utils/runtime.js`). Both packages are
upgraded to **11.12.0**, whose tarballs contain those files. This is a
build-unblock patch upgrade, not a new feature dependency; Sentry stays
env-gated and a no-op without a DSN.
