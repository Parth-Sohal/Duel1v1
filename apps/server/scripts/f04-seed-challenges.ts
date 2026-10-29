/**
 * F04 seed (docs/features/F04-practice-mode.md): author 8 original challenges,
 * FREEZE the expected outputs by running each reference solution (JavaScript
 * AND Python) through Judge0 on every input, verify both languages agree,
 * then insert into the DB as UNPUBLISHED (owner signs off before we publish).
 *
 * Expected outputs are never hand-typed — "correct" is whatever a working
 * reference program actually prints. Run with: npx tsx scripts/f04-seed-challenges.ts
 */
import 'dotenv/config';
import { inArray } from 'drizzle-orm';
import { createDb } from '../src/db/index.js';
import { challengeVersions, challenges } from '../src/db/schema.js';
import { normalizeOutput, runOnce } from '../src/services/judge.js';

type SeedTest = { input: string; hidden: boolean };

type SeedChallenge = {
  slug: string;
  title: string;
  difficulty: 'easy' | 'medium';
  tags: string[];
  statement: string;
  starterCode: { javascript: string; python: string };
  reference: { javascript: string; python: string };
  tests: SeedTest[];
};

const JS_STDIN = `// Read all of stdin, then print your answer.
const input = require('fs').readFileSync(0, 'utf8');
`;

const PY_STDIN = `import sys
data = sys.stdin.read()
`;

const CHALLENGES: SeedChallenge[] = [
  {
    slug: 'pair-target-sum',
    title: 'Pair Target Sum',
    difficulty: 'easy',
    tags: ['two-pointers', 'arrays'],
    statement: `You are given N integers and a target. Exactly one pair of values in the list adds up to the target. Print that pair, space-separated, in the order the values appear when you scan the list from the left.

INPUT
Line 1: N (2 <= N <= 2000)
Line 2: N integers (-10^9 <= v <= 10^9)
Line 3: the target

OUTPUT
The two values that sum to the target, in order of appearance.`,
    starterCode: {
      javascript: JS_STDIN + `// Line 1: N, line 2: the values, line 3: the target.\n`,
      python: PY_STDIN + `# Line 1: N, line 2: the values, line 3: the target.\n`,
    },
    reference: {
      javascript: `const l=require('fs').readFileSync(0,'utf8').split(/\\r?\\n/);
const n=+l[0];const a=l[1].trim().split(/\\s+/).map(Number);const t=+l[2];
outer: for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){if(a[i]+a[j]===t){console.log(a[i]+' '+a[j]);break outer;}}`,
      python: `import sys
l=sys.stdin.read().splitlines()
n=int(l[0]); a=list(map(int,l[1].split())); t=int(l[2])
done=False
for i in range(n):
    for j in range(i+1,n):
        if a[i]+a[j]==t:
            print(a[i],a[j]); done=True; break
    if done: break`,
    },
    tests: [
      { input: '4\n1 2 3 4\n7', hidden: false },
      { input: '5\n-5 10 3 1 8\n3', hidden: false },
      { input: '3\n-3 -7 -1\n-10', hidden: true },
      { input: '2\n5 5\n10', hidden: true },
      { input: '4\n2000000000 -2000000000 300000000 -1000000000\n0', hidden: true },
    ],
  },
  {
    slug: 'reverse-words',
    title: 'Reverse Words',
    difficulty: 'easy',
    tags: ['strings'],
    statement: `Read every line of input. For each line, print its words in reverse order, separated by single spaces.

INPUT
Up to 100 lines of text (each under 200 characters).

OUTPUT
One line per input line, words reversed.`,
    starterCode: {
      javascript: JS_STDIN + `// Split on newlines; watch the trailing newline.\n`,
      python: PY_STDIN + `# splitlines() handles the trailing newline for you.\n`,
    },
    reference: {
      javascript: `let ls=require('fs').readFileSync(0,'utf8').split(/\\r?\\n/);
if(ls.length&&ls[ls.length-1]==='')ls.pop();
console.log(ls.map(x=>x.trim().split(/\\s+/).filter(Boolean).reverse().join(' ')).join('\\n'));`,
      python: `import sys
ls=sys.stdin.read().splitlines()
print('\\n'.join(' '.join(reversed(x.split())) for x in ls))`,
    },
    tests: [
      { input: 'hello world foo', hidden: false },
      { input: 'one', hidden: false },
      { input: 'a  b   c', hidden: true },
      { input: 'x y\np q\nlast line here', hidden: true },
      {
        input: Array.from({ length: 50 }, (_, i) => 'w' + i + ' w' + (i + 1)).join('\n'),
        hidden: true,
      },
    ],
  },
  {
    slug: 'first-duplicate',
    title: 'First Duplicate',
    difficulty: 'easy',
    tags: ['hashmap'],
    statement: `Scan a list of integers from left to right and print the FIRST value that appears a second time. If no value ever repeats, print -1.

INPUT
Line 1: N (1 <= N <= 100000)
Line 2: N integers

OUTPUT
The first repeated value, or -1.`,
    starterCode: {
      javascript: JS_STDIN + `// A set of seen values is enough.\n`,
      python: PY_STDIN + `# A set of seen values is enough.\n`,
    },
    reference: {
      javascript: `const l=require('fs').readFileSync(0,'utf8').split(/\\r?\\n/);
const a=l[1].trim().split(/\\s+/).map(Number);
const seen=new Set();let ans=-1;
for(const v of a){if(seen.has(v)){ans=v;break;}seen.add(v);}
console.log(ans);`,
      python: `import sys
l=sys.stdin.read().splitlines()
a=list(map(int,l[1].split()))
seen=set(); ans=-1
for v in a:
    if v in seen:
        ans=v; break
    seen.add(v)
print(ans)`,
    },
    tests: [
      { input: '4\n1 2 3 4', hidden: false },
      { input: '6\n3 1 3 2 1 3', hidden: false },
      { input: '5\n7 7 7 7 7', hidden: true },
      { input: '5\n1 2 3 1 1', hidden: true },
      { input: '1\n42', hidden: true },
    ],
  },
  {
    slug: 'max-window-sum',
    title: 'Max Window Sum',
    difficulty: 'medium',
    tags: ['sliding-window', 'arrays'],
    statement: `Given a list of N integers and a window size K, find the largest possible sum of any K consecutive values.

INPUT
Line 1: N and K (1 <= K <= N <= 100000)
Line 2: N integers (-10000 <= v <= 10000)

OUTPUT
The maximum window sum.`,
    starterCode: {
      javascript: JS_STDIN + `// Slide the window: add the entering value, drop the leaving one.\n`,
      python: PY_STDIN + `# Slide the window: add the entering value, drop the leaving one.\n`,
    },
    reference: {
      javascript: `const l=require('fs').readFileSync(0,'utf8').split(/\\r?\\n/);
const [n,k]=l[0].trim().split(/\\s+/).map(Number);
const a=l[1].trim().split(/\\s+/).map(Number);
let sum=0;for(let i=0;i<k;i++)sum+=a[i];
let best=sum;
for(let i=k;i<n;i++){sum+=a[i]-a[i-k];if(sum>best)best=sum;}
console.log(best);`,
      python: `import sys
l=sys.stdin.read().splitlines()
n,k=map(int,l[0].split())
a=list(map(int,l[1].split()))
s=sum(a[:k]); best=s
for i in range(k,n):
    s+=a[i]-a[i-k]
    if s>best: best=s
print(best)`,
    },
    tests: [
      { input: '5 2\n1 2 3 4 5', hidden: false },
      { input: '4 4\n10 -5 3 1', hidden: false },
      { input: '5 3\n-1 -2 -3 -4 -5', hidden: true },
      { input: '6 1\n5 -2 100 -3 4 -100', hidden: true },
      {
        input: '100000 5000\n' + Array.from({ length: 100000 }, (_, i) => ((i * 7) % 1000) - 500).join(' '),
        hidden: true,
      },
    ],
  },
  {
    slug: 'bracket-check',
    title: 'Bracket Check',
    difficulty: 'medium',
    tags: ['stack', 'strings'],
    statement: `A line contains only the brackets ( ) [ ] { }. Print VALID if every opening bracket is closed by the matching bracket in the right order; otherwise print INVALID. An empty line is VALID.

INPUT
One line of brackets (possibly empty, at most 100000 characters).

OUTPUT
VALID or INVALID.`,
    starterCode: {
      javascript: JS_STDIN + `// Push openings, pop on a close - the pair must match.\n`,
      python: PY_STDIN + `# Push openings, pop on a close - the pair must match.\n`,
    },
    reference: {
      javascript: `const s=require('fs').readFileSync(0,'utf8').split(/\\r?\\n/)[0]??'';
const pairs={')':'(',']':'[','}':'{'};
const st=[];let ok=true;
for(const ch of s){
  if(ch==='('||ch==='['||ch==='{')st.push(ch);
  else if(ch===')'||ch===']'||ch==='}'){if(st.pop()!==pairs[ch]){ok=false;break;}}
}
console.log(ok&&st.length===0?'VALID':'INVALID');`,
      python: `import sys
s=sys.stdin.read().split('\\n')[0]
pairs={')':'(',']':'[','}':'{'}
st=[]; ok=True
for ch in s:
    if ch in '([{':
        st.append(ch)
    elif ch in ')]}':
        if not st or st.pop()!=pairs[ch]:
            ok=False; break
print('VALID' if ok and not st else 'INVALID')`,
    },
    tests: [
      { input: '()', hidden: false },
      { input: '([)]', hidden: false },
      { input: '', hidden: true },
      { input: '{{[()]}}', hidden: true },
      { input: '(', hidden: true },
      {
        input: '['.repeat(2000) + ']'.repeat(2000),
        hidden: true,
      },
    ],
  },
  {
    slug: 'climb-stairs',
    title: 'Climb Stairs',
    difficulty: 'medium',
    tags: ['dynamic-programming'],
    statement: `You are climbing a staircase with N steps. Each move you take either 1 or 2 steps. Count the number of distinct ways to reach the top, modulo 1000000007.

INPUT
One integer N (1 <= N <= 100000).

OUTPUT
The number of ways, modulo 1000000007.`,
    starterCode: {
      javascript: JS_STDIN + `// ways(n) = ways(n-1) + ways(n-2). Keep only the last two.\n`,
      python: PY_STDIN + `# ways(n) = ways(n-1) + ways(n-2). Keep only the last two.\n`,
    },
    reference: {
      javascript: `const n=parseInt(require('fs').readFileSync(0,'utf8').trim(),10);
const M=1000000007;
let a=1,b=1; // ways(0)=1, ways(1)=1
for(let i=2;i<=n;i++){const c=(a+b)%M;a=b;b=c;}
console.log(b);`,
      python: `import sys
n=int(sys.stdin.read().strip())
M=1000000007
a,b=1,1  # ways(0)=1, ways(1)=1
for _ in range(2,n+1):
    a,b=b,(a+b)%M
print(b)`,
    },
    tests: [
      { input: '2', hidden: false },
      { input: '5', hidden: false },
      { input: '1', hidden: true },
      { input: '30', hidden: true },
      { input: '100000', hidden: true },
    ],
  },
  {
    slug: 'rotate-array',
    title: 'Rotate Array',
    difficulty: 'easy',
    tags: ['arrays'],
    statement: `Rotate a list of N integers to the RIGHT by K positions. The last K values wrap around to the front.

INPUT
Line 1: N and K (1 <= N <= 100000, 0 <= K <= 10^9)
Line 2: N integers

OUTPUT
The rotated list, space-separated.`,
    starterCode: {
      javascript: JS_STDIN + `// K can be much larger than N - reduce it first.\n`,
      python: PY_STDIN + `# K can be much larger than N - reduce it first.\n`,
    },
    reference: {
      javascript: `const l=require('fs').readFileSync(0,'utf8').split(/\\r?\\n/);
const [n,k0]=l[0].trim().split(/\\s+/).map(Number);
const a=l[1].trim().split(/\\s+/).map(Number);
const k=k0%n;
const out=a.slice(n-k).concat(a.slice(0,n-k));
console.log(out.join(' '));`,
      python: `import sys
l=sys.stdin.read().splitlines()
n,k0=map(int,l[0].split())
a=list(map(int,l[1].split()))
k=k0%n
print(' '.join(map(str,a[n-k:]+a[:n-k])))`,
    },
    tests: [
      { input: '5 2\n1 2 3 4 5', hidden: false },
      { input: '3 3\n7 8 9', hidden: false },
      { input: '3 0\n7 8 9', hidden: true },
      { input: '4 7\n1 2 3 4', hidden: true },
      { input: '1 1000000000\n-5', hidden: true },
    ],
  },
  {
    slug: 'missing-number',
    title: 'Missing Number',
    difficulty: 'easy',
    tags: ['math', 'hashmap'],
    statement: `You get all the integers from 1 to N except one. Find the missing one.

INPUT
Line 1: N (2 <= N <= 100000)
Line 2: N-1 distinct integers from 1..N (the missing one is not among them)

OUTPUT
The missing integer.`,
    starterCode: {
      javascript: JS_STDIN + `# The sum of 1..N minus the sum you got is the answer.\n`,
      python: PY_STDIN + `# The sum of 1..N minus the sum you got is the answer.\n`,
    },
    reference: {
      javascript: `const l=require('fs').readFileSync(0,'utf8').split(/\\r?\\n/);
const n=+l[0];
const a=l[1].trim().split(/\\s+/).map(Number);
let total=(n*(n+1))/2;
console.log(total-a.reduce((x,y)=>x+y,0));`,
      python: `import sys
l=sys.stdin.read().splitlines()
n=int(l[0])
a=list(map(int,l[1].split()))
print(n*(n+1)//2 - sum(a))`,
    },
    tests: [
      { input: '5\n1 2 4 5', hidden: false },
      { input: '2\n2', hidden: false },
      { input: '3\n1 2', hidden: true },
      {
        input: '100000\n' + Array.from({ length: 100000 }, (_, i) => i + 1).filter((v) => v !== 99999).join(' '),
        hidden: true,
      },
      {
        input: '100000\n' + Array.from({ length: 100000 }, (_, i) => i + 1).filter((v) => v !== 1).join(' '),
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

type Frozen = SeedChallenge & { tests: Array<SeedTest & { expected: string }> };

async function freezeAndVerify(): Promise<Frozen[]> {
  type Task = { c: number; t: number; lang: 'javascript' | 'python'; source: string; input: string };
  const tasks: Task[] = [];
  CHALLENGES.forEach((c, ci) =>
    c.tests.forEach((t, ti) => {
      tasks.push({ c: ci, t: ti, lang: 'javascript', source: c.reference.javascript, input: t.input });
      tasks.push({ c: ci, t: ti, lang: 'python', source: c.reference.python, input: t.input });
    }),
  );

  console.log(`judging ${tasks.length} reference runs through ${process.env.JUDGE0_API_URL ?? 'https://ce.judge0.com'} ...`);
  const runs = await mapPool(tasks, 2, (task) => authoringRun({ language: task.lang, sourceCode: task.source, stdin: task.input }));

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
    const norm = normalizeOutput(run.stdout);
    const seen = expected[task.c].get(task.t);
    if (seen === undefined) {
      expected[task.c].set(task.t, norm);
    } else if (seen !== norm) {
      console.log(`FAIL ${label}: JS and Python disagree\n  js:     ${JSON.stringify(seen)}\n  python: ${JSON.stringify(norm)}`);
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
        starterCode: c.starterCode,
        timeLimitMs: 5000, // JS base; the judge applies the Python multiplier
        memoryLimitMb: 256,
        tests: c.tests.map((t) => ({ input: t.input, expected: t.expected, hidden: t.hidden })),
      });
    }
  });
}

function reviewTable(frozen: Frozen[]): void {
  for (const c of frozen) {
    console.log(`\n=== ${c.slug} (${c.difficulty}, ${c.tags.join(', ')}) ===`);
    console.log(c.statement);
    for (const [i, t] of c.tests.entries()) {
      const inPrev = t.input.length > 60 ? t.input.slice(0, 57) + '...' : t.input;
      const exPrev = t.expected.length > 60 ? t.expected.slice(0, 57) + '...' : t.expected;
      console.log(`  test ${i + 1} [${t.hidden ? 'HIDDEN' : 'visible'}]`);
      console.log(`    input:    ${JSON.stringify(inPrev)}`);
      console.log(`    expected: ${JSON.stringify(exPrev)}`);
    }
  }
}

const frozen = await freezeAndVerify();
await insert(frozen);
reviewTable(frozen);
console.log(`\ninserted ${frozen.length} challenges (is_published=false) - awaiting owner sign-off`);
process.exit(0);
