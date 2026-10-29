/**
 * F04 seed (docs/features/F04-practice-mode.md): author 8 original challenges,
 * FREEZE the expected answers by running each reference solution (JavaScript
 * AND Python) through Judge0 with the real function-call harness, verify both
 * languages agree, then insert into the DB as UNPUBLISHED (owner signs off
 * before we publish).
 *
 * The player writes a FUNCTION and returns the answer; the server wraps their
 * code so the judge calls it with the test's arguments (JSON on stdin) and
 * compares the returned value. Expected outputs are never hand-typed —
 * "correct" is whatever a working reference function actually returns.
 * Run with: npx tsx scripts/f04-seed-challenges.ts
 */
import 'dotenv/config';
import { inArray } from 'drizzle-orm';
import { createDb } from '../src/db/index.js';
import { challengeVersions, challenges } from '../src/db/schema.js';
import { answerOf, composeSource, runOnce } from '../src/services/judge.js';

type SeedTest = { args: unknown[]; hidden: boolean };

type SeedChallenge = {
  slug: string;
  title: string;
  difficulty: 'easy' | 'medium';
  tags: string[];
  entryFunctions: { javascript: string; python: string };
  statement: string;
  starterCode: { javascript: string; python: string };
  reference: { javascript: string; python: string };
  tests: SeedTest[];
};

const CHALLENGES: SeedChallenge[] = [
  {
    slug: 'pair-target-sum',
    title: 'Pair Target Sum',
    difficulty: 'easy',
    tags: ['two-pointers', 'arrays'],
    entryFunctions: { javascript: 'pairTargetSum', python: 'pair_target_sum' },
    statement: `Write the function pairTargetSum(nums, target).

Exactly one pair of values in nums adds up to target. Return that pair as
[a, b], in the order the values appear when you scan the list from the left.

PARAMETERS
- nums: array of integers (2 <= length <= 2000, values up to ±10^9)
- target: integer

RETURNS
An array holding the two values, in order of appearance.`,
    starterCode: {
      javascript: `function pairTargetSum(nums, target) {
  // find the pair and return [a, b]
}
`,
      python: `def pair_target_sum(nums, target):
    # find the pair and return [a, b]
    pass
`,
    },
    reference: {
      javascript: `function pairTargetSum(nums, target) {
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) return [nums[i], nums[j]];
    }
  }
  return null;
}`,
      python: `def pair_target_sum(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [nums[i], nums[j]]
    return None`,
    },
    tests: [
      { args: [[1, 2, 3, 4], 7], hidden: false },
      { args: [[-5, 10, 3, 1, 8], 3], hidden: false },
      { args: [[-3, -7, -1], -10], hidden: true },
      { args: [[5, 5], 10], hidden: true },
      { args: [[2000000000, -2000000000, 300000000, -1000000000], 0], hidden: true },
    ],
  },
  {
    slug: 'reverse-words',
    title: 'Reverse Words',
    difficulty: 'easy',
    tags: ['strings'],
    entryFunctions: { javascript: 'reverseWords', python: 'reverse_words' },
    statement: `Write the function reverseWords(lines).

For each string in lines, return it with its words in reverse order,
separated by single spaces. Word splitting ignores repeated spaces.

PARAMETERS
- lines: array of strings (up to 100, each under 200 characters)

RETURNS
An array of strings, one per input line, words reversed.`,
    starterCode: {
      javascript: `function reverseWords(lines) {
  // reverse the words of each line
}
`,
      python: `def reverse_words(lines):
    # reverse the words of each line
    pass
`,
    },
    reference: {
      javascript: `function reverseWords(lines) {
  return lines.map((line) => line.trim().split(/\\s+/).filter(Boolean).reverse().join(' '));
}`,
      python: `def reverse_words(lines):
    return [' '.join(reversed(line.split())) for line in lines]`,
    },
    tests: [
      { args: [['hello world foo']], hidden: false },
      { args: [['one']], hidden: false },
      { args: [['a  b   c']], hidden: true },
      { args: [['x y', 'p q', 'last line here']], hidden: true },
      {
        args: [Array.from({ length: 50 }, (_, i) => `w${i} w${i + 1}`)],
        hidden: true,
      },
    ],
  },
  {
    slug: 'first-duplicate',
    title: 'First Duplicate',
    difficulty: 'easy',
    tags: ['hashmap'],
    entryFunctions: { javascript: 'firstDuplicate', python: 'first_duplicate' },
    statement: `Write the function firstDuplicate(nums).

Scan the list from left to right and return the FIRST value that appears a
second time. If no value ever repeats, return -1.

PARAMETERS
- nums: array of integers (1 <= length <= 100000)

RETURNS
The first repeated value, or -1.`,
    starterCode: {
      javascript: `function firstDuplicate(nums) {
  // a set of seen values is enough
}
`,
      python: `def first_duplicate(nums):
    # a set of seen values is enough
    pass
`,
    },
    reference: {
      javascript: `function firstDuplicate(nums) {
  const seen = new Set();
  for (const v of nums) {
    if (seen.has(v)) return v;
    seen.add(v);
  }
  return -1;
}`,
      python: `def first_duplicate(nums):
    seen = set()
    for v in nums:
        if v in seen:
            return v
        seen.add(v)
    return -1`,
    },
    tests: [
      { args: [[1, 2, 3, 4]], hidden: false },
      { args: [[3, 1, 3, 2, 1, 3]], hidden: false },
      { args: [[7, 7, 7, 7, 7]], hidden: true },
      { args: [[1, 2, 3, 1, 1]], hidden: true },
      { args: [[42]], hidden: true },
    ],
  },
  {
    slug: 'max-window-sum',
    title: 'Max Window Sum',
    difficulty: 'medium',
    tags: ['sliding-window', 'arrays'],
    entryFunctions: { javascript: 'maxWindowSum', python: 'max_window_sum' },
    statement: `Write the function maxWindowSum(nums, k).

Find the largest possible sum of any k consecutive values in nums.

PARAMETERS
- nums: array of integers (1 <= k <= length <= 100000, values in [-10000, 10000])
- k: the window size

RETURNS
The maximum window sum.`,
    starterCode: {
      javascript: `function maxWindowSum(nums, k) {
  // slide the window: add the entering value, drop the leaving one
}
`,
      python: `def max_window_sum(nums, k):
    # slide the window: add the entering value, drop the leaving one
    pass
`,
    },
    reference: {
      javascript: `function maxWindowSum(nums, k) {
  let sum = 0;
  for (let i = 0; i < k; i++) sum += nums[i];
  let best = sum;
  for (let i = k; i < nums.length; i++) {
    sum += nums[i] - nums[i - k];
    if (sum > best) best = sum;
  }
  return best;
}`,
      python: `def max_window_sum(nums, k):
    s = sum(nums[:k])
    best = s
    for i in range(k, len(nums)):
        s += nums[i] - nums[i - k]
        if s > best:
            best = s
    return best`,
    },
    tests: [
      { args: [[1, 2, 3, 4, 5], 2], hidden: false },
      { args: [[10, -5, 3, 1], 4], hidden: false },
      { args: [[-1, -2, -3, -4, -5], 3], hidden: true },
      { args: [[5, -2, 100, -3, 4, -100], 1], hidden: true },
      {
        args: [Array.from({ length: 100000 }, (_, i) => ((i * 7) % 1000) - 500), 5000],
        hidden: true,
      },
    ],
  },
  {
    slug: 'bracket-check',
    title: 'Bracket Check',
    difficulty: 'medium',
    tags: ['stack', 'strings'],
    entryFunctions: { javascript: 'bracketCheck', python: 'bracket_check' },
    statement: `Write the function bracketCheck(s).

s contains only the brackets ( ) [ ] { }. Return true if every opening
bracket is closed by the matching bracket in the right order, otherwise
false. An empty string is valid.

PARAMETERS
- s: a string of brackets (possibly empty, at most 100000 characters)

RETURNS
true or false.`,
    starterCode: {
      javascript: `function bracketCheck(s) {
  // push openings, pop on a close - the pair must match
}
`,
      python: `def bracket_check(s):
    # push openings, pop on a close - the pair must match
    pass
`,
    },
    reference: {
      javascript: `function bracketCheck(s) {
  const pairs = { ')': '(', ']': '[', '}': '{' };
  const st = [];
  for (const ch of s) {
    if (ch === '(' || ch === '[' || ch === '{') st.push(ch);
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (st.pop() !== pairs[ch]) return false;
    }
  }
  return st.length === 0;
}`,
      python: `def bracket_check(s):
    pairs = {')': '(', ']': '[', '}': '{'}
    st = []
    for ch in s:
        if ch in '([{':
            st.append(ch)
        elif ch in ')]}':
            if not st or st.pop() != pairs[ch]:
                return False
    return not st`,
    },
    tests: [
      { args: ['()'], hidden: false },
      { args: ['([)]'], hidden: false },
      { args: [''], hidden: true },
      { args: ['{{[()]}}'], hidden: true },
      { args: ['('], hidden: true },
      { args: ['['.repeat(2000) + ']'.repeat(2000)], hidden: true },
    ],
  },
  {
    slug: 'climb-stairs',
    title: 'Climb Stairs',
    difficulty: 'medium',
    tags: ['dynamic-programming'],
    entryFunctions: { javascript: 'climbStairs', python: 'climb_stairs' },
    statement: `Write the function climbStairs(n).

You are climbing a staircase with n steps; each move you take either 1 or 2
steps. Return the number of distinct ways to reach the top, modulo
1000000007.

PARAMETERS
- n: the number of steps (1 <= n <= 100000)

RETURNS
The number of ways, modulo 1000000007.`,
    starterCode: {
      javascript: `function climbStairs(n) {
  // ways(n) = ways(n-1) + ways(n-2). Keep only the last two.
}
`,
      python: `def climb_stairs(n):
    # ways(n) = ways(n-1) + ways(n-2). Keep only the last two.
    pass
`,
    },
    reference: {
      javascript: `function climbStairs(n) {
  const M = 1000000007;
  let a = 1, b = 1; // ways(0)=1, ways(1)=1
  for (let i = 2; i <= n; i++) {
    const c = (a + b) % M;
    a = b;
    b = c;
  }
  return b;
}`,
      python: `def climb_stairs(n):
    M = 1000000007
    a, b = 1, 1  # ways(0)=1, ways(1)=1
    for _ in range(2, n + 1):
        a, b = b, (a + b) % M
    return b`,
    },
    tests: [
      { args: [2], hidden: false },
      { args: [5], hidden: false },
      { args: [1], hidden: true },
      { args: [30], hidden: true },
      { args: [100000], hidden: true },
    ],
  },
  {
    slug: 'rotate-array',
    title: 'Rotate Array',
    difficulty: 'easy',
    tags: ['arrays'],
    entryFunctions: { javascript: 'rotateArray', python: 'rotate_array' },
    statement: `Write the function rotateArray(nums, k).

Rotate nums to the RIGHT by k positions; the last k values wrap around to
the front. k can be much larger than the list length.

PARAMETERS
- nums: array of integers (1 <= length <= 100000)
- k: rotation count (0 <= k <= 10^9)

RETURNS
The rotated array.`,
    starterCode: {
      javascript: `function rotateArray(nums, k) {
  // reduce k first - it can be much larger than the list
}
`,
      python: `def rotate_array(nums, k):
    # reduce k first - it can be much larger than the list
    pass
`,
    },
    reference: {
      javascript: `function rotateArray(nums, k) {
  const n = nums.length;
  const r = k % n;
  return nums.slice(n - r).concat(nums.slice(0, n - r));
}`,
      python: `def rotate_array(nums, k):
    n = len(nums)
    r = k % n
    return nums[n - r:] + nums[:n - r]`,
    },
    tests: [
      { args: [[1, 2, 3, 4, 5], 2], hidden: false },
      { args: [[7, 8, 9], 3], hidden: false },
      { args: [[7, 8, 9], 0], hidden: true },
      { args: [[1, 2, 3, 4], 7], hidden: true },
      { args: [[-5], 1000000000], hidden: true },
    ],
  },
  {
    slug: 'missing-number',
    title: 'Missing Number',
    difficulty: 'easy',
    tags: ['math', 'hashmap'],
    entryFunctions: { javascript: 'missingNumber', python: 'missing_number' },
    statement: `Write the function missingNumber(n, nums).

You get all the integers from 1 to n except one. Return the missing one.

PARAMETERS
- n: the range end (2 <= n <= 100000)
- nums: the n-1 distinct integers you were given (from 1..n)

RETURNS
The missing integer.`,
    starterCode: {
      javascript: `function missingNumber(n, nums) {
  // the sum of 1..n minus the sum you got is the answer
}
`,
      python: `def missing_number(n, nums):
    # the sum of 1..n minus the sum you got is the answer
    pass
`,
    },
    reference: {
      javascript: `function missingNumber(n, nums) {
  const total = (n * (n + 1)) / 2;
  return total - nums.reduce((x, y) => x + y, 0);
}`,
      python: `def missing_number(n, nums):
    return n * (n + 1) // 2 - sum(nums)`,
    },
    tests: [
      { args: [5, [1, 2, 4, 5]], hidden: false },
      { args: [2, [2]], hidden: false },
      { args: [3, [1, 2]], hidden: true },
      {
        args: [100000, Array.from({ length: 100000 }, (_, i) => i + 1).filter((v) => v !== 99999)],
        hidden: true,
      },
      {
        args: [100000, Array.from({ length: 100000 }, (_, i) => i + 1).filter((v) => v !== 1)],
        hidden: true,
      },
    ],
  },
];

/** Worker-pool map with bounded concurrency (Judge0 public endpoint allows a few req/s per IP). */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const db = createDb(process.env.DATABASE_URL!).db;

type Frozen = SeedChallenge & { tests: Array<SeedTest & { expected: string }> };

/**
 * Authoring-time judge run: the shared public endpoint intermittently fails
 * (transient network errors, CPU spikes on a loaded box), so authoring runs
 * get a generous 10 s CPU budget and up to 3 attempts. Player runs do NOT
 * get this - the route uses runOnce with the challenge's real limits.
 */
async function authoringRun(opts: { language: 'javascript' | 'python'; sourceCode: string; stdin: string }) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    last = await runOnce({ ...opts, timeLimitMs: 10_000 });
    if (last.status === 'accepted') return last;
    await new Promise((r) => setTimeout(r, attempt * 1500));
  }
  return last!;
}

async function freezeAndVerify(): Promise<Frozen[]> {
  type Task = { c: number; t: number; lang: 'javascript' | 'python'; source: string; stdin: string };
  const tasks: Task[] = [];
  CHALLENGES.forEach((c, ci) =>
    c.tests.forEach((t, ti) => {
      const stdin = JSON.stringify(t.args);
      tasks.push({ c: ci, t: ti, lang: 'javascript', source: composeSource('javascript', c.reference.javascript, c.entryFunctions.javascript), stdin });
      tasks.push({ c: ci, t: ti, lang: 'python', source: composeSource('python', c.reference.python, c.entryFunctions.python), stdin });
    }),
  );

  console.log(`judging ${tasks.length} reference runs through ${process.env.JUDGE0_API_URL ?? 'https://ce.judge0.com'} ...`);
  const runs = await mapPool(tasks, 2, (task) => authoringRun({ language: task.lang, sourceCode: task.source, stdin: task.stdin }));

  const expected = CHALLENGES.map(() => new Map<number, string>());
  let fails = 0;
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const run = runs[i];
    const label = `${CHALLENGES[task.c].slug} #${task.t + 1} ${task.lang}`;
    if (run.status !== 'accepted') {
      console.log(`FAIL ${label}: status=${run.status} stderr=${run.stderr.slice(0, 120)} compile=${run.compileOutput.slice(0, 120)}`);
      fails++;
      continue;
    }
    const answer = answerOf(run.stdout);
    const seen = expected[task.c].get(task.t);
    if (seen === undefined) {
      expected[task.c].set(task.t, answer);
    } else if (seen !== answer) {
      console.log(`FAIL ${label}: JS and Python disagree\n  js:     ${JSON.stringify(seen)}\n  python: ${JSON.stringify(answer)}`);
      fails++;
    }
  }
  if (fails > 0) {
    throw new Error(`${fails} reference run(s) failed or disagreed - nothing inserted`);
  }

  return CHALLENGES.map((c, ci) => ({
    ...c,
    tests: c.tests.map((t, ti) => ({ ...t, expected: expected[ci].get(ti)! })),
  }));
}

async function insert(frozen: Frozen[]): Promise<void> {
  const slugs = frozen.map((c) => c.slug);
  await db.transaction(async (tx) => {
    // Seed is idempotent: replace our own rows. No player submissions exist yet.
    await tx.delete(challenges).where(inArray(challenges.slug, slugs));
    for (const c of frozen) {
      const [row] = await tx
        .insert(challenges)
        .values({
          slug: c.slug,
          title: c.title,
          difficulty: c.difficulty,
          tags: c.tags,
          currentVersion: 1,
          isPublished: false, // unpublished until the owner signs off
        })
        .returning();
      await tx.insert(challengeVersions).values({
        challengeId: row.id,
        version: 1,
        statement: c.statement,
        entryFunctions: c.entryFunctions,
        starterCode: c.starterCode,
        timeLimitMs: 5000, // JS base; the judge applies the Python multiplier
        memoryLimitMb: 256,
        tests: c.tests.map((t) => ({ args: t.args, expected: t.expected, hidden: t.hidden })),
      });
    }
  });
}

function reviewTable(frozen: Frozen[]): void {
  for (const c of frozen) {
    console.log(`\n=== ${c.slug} (${c.difficulty}, ${c.tags.join(', ')}) ===`);
    console.log(c.statement);
    for (const [i, t] of c.tests.entries()) {
      const argsPrev = JSON.stringify(t.args);
      console.log(`  test ${i + 1} [${t.hidden ? 'HIDDEN' : 'visible'}]`);
      console.log(`    args:     ${argsPrev.length > 70 ? argsPrev.slice(0, 67) + '...' : argsPrev}`);
      console.log(`    expected: ${JSON.stringify(t.expected.length > 60 ? t.expected.slice(0, 57) + '...' : t.expected)}`);
    }
  }
}

const frozen = await freezeAndVerify();
await insert(frozen);
reviewTable(frozen);
console.log(`\ninserted ${frozen.length} challenges (is_published=false) - awaiting owner sign-off`);
process.exit(0);
