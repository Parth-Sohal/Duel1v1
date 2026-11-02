/**
 * Seed pool expansion (2026-11-02): 32 additional challenges (12 easy,
 * 12 medium, 8 hard) for the 30-50 pool gate. Same contract as seed-data.ts —
 * function in, answer out; references must produce BYTE-IDENTICAL answers in
 * JavaScript and Python (integer math only, no floats, results < 2^53 or
 * mod 1e9+7). Expected answers are never hand-typed: the freeze step computes
 * them by running these references through the real judge.
 */
import type { SeedChallenge } from './seed-data.js';

export const POOL2: SeedChallenge[] = [
  // ---------------------------------------------------------------- easy
  {
    slug: 'sum-of-evens',
    title: 'Sum of Evens',
    difficulty: 'easy',
    tags: ['math', 'arrays'],
    entryFunctions: { javascript: 'sumEvens', python: 'sum_evens' },
    statement: `Write the function sumEvens(nums).

Return the sum of every EVEN value in nums. An empty list sums to 0.

PARAMETERS
- nums: array of integers (up to 100000 values, each in [-10^9, 10^9]; the sum stays below 2^53)

RETURNS
The sum of the even values.`,
    starterCode: {
      javascript: `function sumEvens(nums) {
  // add only the values divisible by 2
}
`,
      python: `def sum_evens(nums):
    # add only the values divisible by 2
    pass
`,
    },
    reference: {
      javascript: `function sumEvens(nums) {
  let total = 0;
  for (const v of nums) if (v % 2 === 0) total += v;
  return total;
}`,
      python: `def sum_evens(nums):
    total = 0
    for v in nums:
        if v % 2 == 0:
            total += v
    return total`,
    },
    tests: [
      { args: [[1, 2, 3, 4, 6]], hidden: false },
      { args: [[1, 3, 5]], hidden: false },
      { args: [[-2, -4, 7]], hidden: true },
      { args: [[0]], hidden: true },
      { args: [Array.from({ length: 100000 }, (_, i) => i + 1)], hidden: true },
    ],
  },
  {
    slug: 'count-vowels',
    title: 'Count Vowels',
    difficulty: 'easy',
    tags: ['strings'],
    entryFunctions: { javascript: 'countVowels', python: 'count_vowels' },
    statement: `Write the function countVowels(s).

Return how many vowels (a, e, i, o, u — case-insensitive) the string s
contains.

PARAMETERS
- s: a string of up to 100000 characters

RETURNS
The number of vowels.`,
    starterCode: {
      javascript: `function countVowels(s) {
  // count a, e, i, o, u in any case
}
`,
      python: `def count_vowels(s):
    # count a, e, i, o, u in any case
    pass
`,
    },
    reference: {
      javascript: `function countVowels(s) {
  let n = 0;
  for (const ch of s) {
    const c = ch.toLowerCase();
    if (c === 'a' || c === 'e' || c === 'i' || c === 'o' || c === 'u') n++;
  }
  return n;
}`,
      python: `def count_vowels(s):
    n = 0
    for ch in s.lower():
        if ch in 'aeiou':
            n += 1
    return n`,
    },
    tests: [
      { args: ['Hello World'], hidden: false },
      { args: ['rhythm'], hidden: false },
      { args: ['AEIOUaeiou'], hidden: true },
      { args: [''], hidden: true },
      { args: ['a'.repeat(100000)], hidden: true },
    ],
  },
  {
    slug: 'is-palindrome-phrase',
    title: 'Phrase Palindrome',
    difficulty: 'easy',
    tags: ['strings', 'two-pointers'],
    entryFunctions: { javascript: 'isPalindromePhrase', python: 'is_palindrome_phrase' },
    statement: `Write the function isPalindromePhrase(s).

Return true if s, read the same forwards and backwards after removing
everything except letters and digits and lowercasing, otherwise false. An
empty s (or one with no letters/digits) is a palindrome.

PARAMETERS
- s: a string of up to 10000 ASCII characters

RETURNS
true or false.`,
    starterCode: {
      javascript: `function isPalindromePhrase(s) {
  // keep only letters+digits, lowercase, then compare ends inward
}
`,
      python: `def is_palindrome_phrase(s):
    # keep only letters+digits, lowercase, then compare ends inward
    pass
`,
    },
    reference: {
      javascript: `function isPalindromePhrase(s) {
  const t = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  let i = 0;
  let j = t.length - 1;
  while (i < j) {
    if (t[i] !== t[j]) return false;
    i++;
    j--;
  }
  return true;
}`,
      python: `def is_palindrome_phrase(s):
    t = [c for c in s.lower() if 'a' <= c <= 'z' or '0' <= c <= '9']
    i, j = 0, len(t) - 1
    while i < j:
        if t[i] != t[j]:
            return False
        i += 1
        j -= 1
    return True`,
    },
    tests: [
      { args: ['A man, a plan, a canal: Panama'], hidden: false },
      { args: ['race a car'], hidden: false },
      { args: [''], hidden: true },
      { args: ['0P'], hidden: true },
      { args: ['Madam, in Eden, I\'m Adam'], hidden: true },
    ],
  },
  {
    slug: 'second-largest',
    title: 'Second Largest',
    difficulty: 'easy',
    tags: ['arrays'],
    entryFunctions: { javascript: 'secondLargest', python: 'second_largest' },
    statement: `Write the function secondLargest(nums).

Return the SECOND LARGEST DISTINCT value in nums. If nums has fewer than
two distinct values, return -1.

PARAMETERS
- nums: array of integers (1 <= length <= 100000, values up to ±10^9)

RETURNS
The second largest distinct value, or -1.`,
    starterCode: {
      javascript: `function secondLargest(nums) {
  // dedupe first - duplicates do not count
}
`,
      python: `def second_largest(nums):
    # dedupe first - duplicates do not count
    pass
`,
    },
    reference: {
      javascript: `function secondLargest(nums) {
  const uniq = Array.from(new Set(nums)).sort((a, b) => b - a);
  return uniq.length >= 2 ? uniq[1] : -1;
}`,
      python: `def second_largest(nums):
    uniq = sorted(set(nums), reverse=True)
    return uniq[1] if len(uniq) >= 2 else -1`,
    },
    tests: [
      { args: [[1, 2, 3, 4]], hidden: false },
      { args: [[5, 5, 5]], hidden: false },
      { args: [[2, 7, 7, 1]], hidden: true },
      { args: [[-1, -5, -3]], hidden: true },
      { args: [Array.from({ length: 100000 }, (_, i) => i % 10)], hidden: true },
    ],
  },
  {
    slug: 'fizzbuzz-list',
    title: 'FizzBuzz List',
    difficulty: 'easy',
    tags: ['math', 'strings'],
    entryFunctions: { javascript: 'fizzBuzz', python: 'fizz_buzz' },
    statement: `Write the function fizzBuzz(n).

Return the strings "1" through "n", replacing every multiple of 3 with
"Fizz", every multiple of 5 with "Buzz", and every multiple of both with
"FizzBuzz".

PARAMETERS
- n: the list length (1 <= n <= 1000)

RETURNS
An array of n strings.`,
    starterCode: {
      javascript: `function fizzBuzz(n) {
  // check 15 first, then 3, then 5
}
`,
      python: `def fizz_buzz(n):
    # check 15 first, then 3, then 5
    pass
`,
    },
    reference: {
      javascript: `function fizzBuzz(n) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    if (i % 15 === 0) out.push('FizzBuzz');
    else if (i % 3 === 0) out.push('Fizz');
    else if (i % 5 === 0) out.push('Buzz');
    else out.push(String(i));
  }
  return out;
}`,
      python: `def fizz_buzz(n):
    out = []
    for i in range(1, n + 1):
        if i % 15 == 0:
            out.append('FizzBuzz')
        elif i % 3 == 0:
            out.append('Fizz')
        elif i % 5 == 0:
            out.append('Buzz')
        else:
            out.append(str(i))
    return out`,
    },
    tests: [
      { args: [5], hidden: false },
      { args: [15], hidden: false },
      { args: [1], hidden: true },
      { args: [3], hidden: true },
      { args: [1000], hidden: true },
    ],
  },
  {
    slug: 'most-frequent-char',
    title: 'Most Frequent Character',
    difficulty: 'easy',
    tags: ['strings', 'hashmap'],
    entryFunctions: { javascript: 'mostFrequentChar', python: 'most_frequent_char' },
    statement: `Write the function mostFrequentChar(s).

Return the character that appears most often in s. If several characters
tie, return the one whose FIRST occurrence in s comes earliest. s is
non-empty.

PARAMETERS
- s: a non-empty string of up to 100000 characters

RETURNS
The single most frequent character (ties broken by first occurrence).`,
    starterCode: {
      javascript: `function mostFrequentChar(s) {
  // count, then walk s again keeping the strict maximum
}
`,
      python: `def most_frequent_char(s):
    # count, then walk s again keeping the strict maximum
    pass
`,
    },
    reference: {
      javascript: `function mostFrequentChar(s) {
  const counts = new Map();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let best = s[0];
  for (const ch of s) if (counts.get(ch) > counts.get(best)) best = ch;
  return best;
}`,
      python: `def most_frequent_char(s):
    counts = {}
    for ch in s:
        counts[ch] = counts.get(ch, 0) + 1
    best = s[0]
    for ch in s:
        if counts[ch] > counts[best]:
            best = ch
    return best`,
    },
    tests: [
      { args: ['aabbbcc'], hidden: false },
      { args: ['abcabc'], hidden: false },
      { args: ['z'], hidden: true },
      { args: ['xyxyy'], hidden: true },
      { args: ['a'.repeat(100) + 'b'.repeat(200) + 'c'.repeat(150)], hidden: true },
    ],
  },
  {
    slug: 'digit-sum',
    title: 'Digit Sum',
    difficulty: 'easy',
    tags: ['math'],
    entryFunctions: { javascript: 'digitSum', python: 'digit_sum' },
    statement: `Write the function digitSum(n).

Return the sum of the decimal digits of the non-negative integer n.

PARAMETERS
- n: a non-negative integer (up to 10^15)

RETURNS
The sum of its digits (0 for n = 0).`,
    starterCode: {
      javascript: `function digitSum(n) {
  // peel digits with % 10 and / 10
}
`,
      python: `def digit_sum(n):
    # peel digits with % 10 and // 10
    pass
`,
    },
    reference: {
      javascript: `function digitSum(n) {
  let s = 0;
  while (n > 0) {
    s += n % 10;
    n = Math.floor(n / 10);
  }
  return s;
}`,
      python: `def digit_sum(n):
    s = 0
    while n > 0:
        s += n % 10
        n //= 10
    return s`,
    },
    tests: [
      { args: [9875], hidden: false },
      { args: [0], hidden: false },
      { args: [5], hidden: true },
      { args: [1000000], hidden: true },
      { args: [987654321987654], hidden: true },
    ],
  },
  {
    slug: 'swap-case',
    title: 'Swap Case',
    difficulty: 'easy',
    tags: ['strings'],
    entryFunctions: { javascript: 'swapCase', python: 'swap_case' },
    statement: `Write the function swapCase(s).

Return s with every lowercase letter made uppercase and every uppercase
letter made lowercase. Characters that are not letters stay as they are.

PARAMETERS
- s: a string of up to 10000 ASCII characters

RETURNS
The case-swapped string.`,
    starterCode: {
      javascript: `function swapCase(s) {
  // flip a-z to A-Z and back, leave the rest alone
}
`,
      python: `def swap_case(s):
    # flip a-z to A-Z and back, leave the rest alone
    pass
`,
    },
    reference: {
      javascript: `function swapCase(s) {
  let out = '';
  for (const ch of s) {
    if (ch >= 'a' && ch <= 'z') out += ch.toUpperCase();
    else if (ch >= 'A' && ch <= 'Z') out += ch.toLowerCase();
    else out += ch;
  }
  return out;
}`,
      python: `def swap_case(s):
    out = []
    for ch in s:
        if 'a' <= ch <= 'z':
            out.append(ch.upper())
        elif 'A' <= ch <= 'Z':
            out.append(ch.lower())
        else:
            out.append(ch)
    return ''.join(out)`,
    },
    tests: [
      { args: ['Hello World!'], hidden: false },
      { args: ['abcDEF'], hidden: false },
      { args: [''], hidden: true },
      { args: ['123 !@#'], hidden: true },
      { args: ['The Quick Brown Fox Jumps Over 10 Lazy Dogs'], hidden: true },
    ],
  },
  {
    slug: 'merge-sorted',
    title: 'Merge Sorted Lists',
    difficulty: 'easy',
    tags: ['arrays', 'two-pointers'],
    entryFunctions: { javascript: 'mergeSorted', python: 'merge_sorted' },
    statement: `Write the function mergeSorted(a, b).

a and b are each sorted in ascending order (duplicates allowed). Return
one array holding all their values together in ascending order.

PARAMETERS
- a: sorted array of integers (up to 100000 values)
- b: sorted array of integers (up to 100000 values)

RETURNS
The merged sorted array.`,
    starterCode: {
      javascript: `function mergeSorted(a, b) {
  // walk both lists with two fingers, always take the smaller head
}
`,
      python: `def merge_sorted(a, b):
    # walk both lists with two fingers, always take the smaller head
    pass
`,
    },
    reference: {
      javascript: `function mergeSorted(a, b) {
  const out = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] <= b[j]) out.push(a[i++]);
    else out.push(b[j++]);
  }
  while (i < a.length) out.push(a[i++]);
  while (j < b.length) out.push(b[j++]);
  return out;
}`,
      python: `def merge_sorted(a, b):
    out = []
    i = j = 0
    while i < len(a) and j < len(b):
        if a[i] <= b[j]:
            out.append(a[i])
            i += 1
        else:
            out.append(b[j])
            j += 1
    out.extend(a[i:])
    out.extend(b[j:])
    return out`,
    },
    tests: [
      { args: [[1, 3, 5], [2, 4, 6]], hidden: false },
      { args: [[1, 1, 2], [1, 3]], hidden: false },
      { args: [[], [1, 2]], hidden: true },
      { args: [[5], []], hidden: true },
      {
        args: [Array.from({ length: 50000 }, (_, i) => i * 2), Array.from({ length: 50000 }, (_, i) => i * 2 + 1)],
        hidden: true,
      },
    ],
  },
  {
    slug: 'range-sum',
    title: 'Range Sum',
    difficulty: 'easy',
    tags: ['math'],
    entryFunctions: { javascript: 'rangeSum', python: 'range_sum' },
    statement: `Write the function rangeSum(a, b).

Return the sum of every integer from a through b inclusive (a <= b). A
closed-form formula is fine - no loop needed.

PARAMETERS
- a: range start (0 <= a <= b <= 10^6)
- b: range end

RETURNS
The sum a + (a+1) + ... + b.`,
    starterCode: {
      javascript: `function rangeSum(a, b) {
  // (a + b) counts * (b - a + 1) / 2
}
`,
      python: `def range_sum(a, b):
    # (a + b) counts * (b - a + 1) // 2
    pass
`,
    },
    reference: {
      javascript: `function rangeSum(a, b) {
  return ((a + b) * (b - a + 1)) / 2;
}`,
      python: `def range_sum(a, b):
    return (a + b) * (b - a + 1) // 2`,
    },
    tests: [
      { args: [1, 5], hidden: false },
      { args: [10, 10], hidden: false },
      { args: [0, 0], hidden: true },
      { args: [7, 8], hidden: true },
      { args: [0, 1000000], hidden: true },
    ],
  },
  {
    slug: 'is-anagram',
    title: 'Anagram Check',
    difficulty: 'easy',
    tags: ['strings', 'hashmap'],
    entryFunctions: { javascript: 'isAnagram', python: 'is_anagram' },
    statement: `Write the function isAnagram(a, b).

Return true if b is an anagram of a — both contain exactly the same
characters with the same counts. Inputs use lowercase letters only.

PARAMETERS
- a: a string of lowercase letters (up to 100000 characters)
- b: a string of lowercase letters

RETURNS
true or false.`,
    starterCode: {
      javascript: `function isAnagram(a, b) {
  // different lengths can never be anagrams
}
`,
      python: `def is_anagram(a, b):
    # different lengths can never be anagrams
    pass
`,
    },
    reference: {
      javascript: `function isAnagram(a, b) {
  if (a.length !== b.length) return false;
  const counts = new Map();
  for (const ch of a) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  for (const ch of b) {
    const c = counts.get(ch) ?? 0;
    if (c === 0) return false;
    counts.set(ch, c - 1);
  }
  return true;
}`,
      python: `def is_anagram(a, b):
    if len(a) != len(b):
        return False
    counts = {}
    for ch in a:
        counts[ch] = counts.get(ch, 0) + 1
    for ch in b:
        if counts.get(ch, 0) == 0:
            return False
        counts[ch] -= 1
    return True`,
    },
    tests: [
      { args: ['listen', 'silent'], hidden: false },
      { args: ['hello', 'world'], hidden: false },
      { args: ['aabb', 'abab'], hidden: true },
      { args: ['abc', 'ab'], hidden: true },
      { args: ['xyz' + 'q'.repeat(50000), 'q'.repeat(50000) + 'zyx'], hidden: true },
    ],
  },
  {
    slug: 'length-last-word',
    title: 'Last Word Length',
    difficulty: 'easy',
    tags: ['strings'],
    entryFunctions: { javascript: 'lengthOfLastWord', python: 'length_of_last_word' },
    statement: `Write the function lengthOfLastWord(s).

Return the length of the LAST word in s (words are runs of non-space
characters, separated by spaces). If s has no words, return 0.

PARAMETERS
- s: a string of up to 10000 characters (letters, digits, spaces)

RETURNS
The length of the last word, or 0.`,
    starterCode: {
      javascript: `function lengthOfLastWord(s) {
  // trim, split on spaces, look at the last piece
}
`,
      python: `def length_of_last_word(s):
    # trim, split on spaces, look at the last piece
    pass
`,
    },
    reference: {
      javascript: `function lengthOfLastWord(s) {
  const words = s.trim().split(/\\s+/).filter(Boolean);
  return words.length === 0 ? 0 : words[words.length - 1].length;
}`,
      python: `def length_of_last_word(s):
    words = s.split()
    return len(words[-1]) if words else 0`,
    },
    tests: [
      { args: ['Hello World'], hidden: false },
      { args: ['   '], hidden: false },
      { args: ['day'], hidden: true },
      { args: ['one two  three   '], hidden: true },
      { args: ['a'.repeat(5000)], hidden: true },
    ],
  },

  // -------------------------------------------------------------- medium
  {
    slug: 'majority-element',
    title: 'Majority Element',
    difficulty: 'medium',
    tags: ['arrays', 'hashmap'],
    entryFunctions: { javascript: 'majorityElement', python: 'majority_element' },
    statement: `Write the function majorityElement(nums).

One value appears MORE THAN half the time in nums. Return that value.

PARAMETERS
- nums: array of integers (1 <= length <= 100000; a strict majority exists)

RETURNS
The majority value.`,
    starterCode: {
      javascript: `function majorityElement(nums) {
  // count occurrences - or use the Boyer-Moore vote
}
`,
      python: `def majority_element(nums):
    # count occurrences - or use the Boyer-Moore vote
    pass
`,
    },
    reference: {
      javascript: `function majorityElement(nums) {
  let candidate = nums[0];
  let votes = 0;
  for (const v of nums) {
    if (votes === 0) candidate = v;
    votes += v === candidate ? 1 : -1;
  }
  return candidate;
}`,
      python: `def majority_element(nums):
    candidate = nums[0]
    votes = 0
    for v in nums:
        if votes == 0:
            candidate = v
        votes += 1 if v == candidate else -1
    return candidate`,
    },
    tests: [
      { args: [[3, 2, 3]], hidden: false },
      { args: [[2, 2, 1, 1, 1, 2, 2]], hidden: false },
      { args: [[1]], hidden: true },
      { args: [[-1, -1, 5]], hidden: true },
      { args: [Array.from({ length: 100001 }, (_, i) => (i % 100) + 1).concat(Array(50001).fill(7))], hidden: true },
    ],
  },
  {
    slug: 'value-counts',
    title: 'Value Counts',
    difficulty: 'medium',
    tags: ['hashmap', 'arrays'],
    entryFunctions: { javascript: 'valueCounts', python: 'value_counts' },
    statement: `Write the function valueCounts(nums).

Return the distinct values of nums paired with how many times each
appears, as [value, count] pairs ordered by the value's FIRST appearance.

PARAMETERS
- nums: array of integers (up to 100000 values)

RETURNS
An array of [value, count] pairs in first-appearance order.`,
    starterCode: {
      javascript: `function valueCounts(nums) {
  // one pass with a Map, keyed by first appearance
}
`,
      python: `def value_counts(nums):
    # one pass with a dict, keyed by first appearance
    pass
`,
    },
    reference: {
      javascript: `function valueCounts(nums) {
  const order = [];
  const index = new Map();
  for (const v of nums) {
    const at = index.get(v);
    if (at === undefined) {
      index.set(v, order.length);
      order.push([v, 1]);
    } else {
      order[at][1]++;
    }
  }
  return order;
}`,
      python: `def value_counts(nums):
    order = []
    index = {}
    for v in nums:
        at = index.get(v)
        if at is None:
            index[v] = len(order)
            order.append([v, 1])
        else:
            order[at][1] += 1
    return order`,
    },
    tests: [
      { args: [[1, 2, 1, 3, 2, 1]], hidden: false },
      { args: [[4, 4, 4]], hidden: false },
      { args: [[]], hidden: true },
      { args: [[7, 6, 7, 6, 5]], hidden: true },
      { args: [Array.from({ length: 50000 }, (_, i) => i % 100)], hidden: true },
    ],
  },
  {
    slug: 'roman-to-int',
    title: 'Roman to Integer',
    difficulty: 'medium',
    tags: ['strings', 'math'],
    entryFunctions: { javascript: 'romanToInt', python: 'roman_to_int' },
    statement: `Write the function romanToInt(s).

s is a valid Roman numeral (I, V, X, L, C, D, M with standard subtractive
notation) representing a value from 1 to 3999. Return that value.

PARAMETERS
- s: a valid Roman numeral (1 to 3999)

RETURNS
The integer value.`,
    starterCode: {
      javascript: `function romanToInt(s) {
  // a smaller value before a bigger one means subtract
}
`,
      python: `def roman_to_int(s):
    # a smaller value before a bigger one means subtract
    pass
`,
    },
    reference: {
      javascript: `function romanToInt(s) {
  const vals = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = vals[s[i]];
    if (i + 1 < s.length && v < vals[s[i + 1]]) total -= v;
    else total += v;
  }
  return total;
}`,
      python: `def roman_to_int(s):
    vals = {'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000}
    total = 0
    for i, ch in enumerate(s):
        v = vals[ch]
        if i + 1 < len(s) and v < vals[s[i + 1]]:
            total -= v
        else:
            total += v
    return total`,
    },
    tests: [
      { args: ['III'], hidden: false },
      { args: ['MCMXCIV'], hidden: false },
      { args: ['IX'], hidden: true },
      { args: ['LVIII'], hidden: true },
      { args: ['MMMDCCCLXXXVIII'], hidden: true },
    ],
  },
  {
    slug: 'int-to-roman',
    title: 'Integer to Roman',
    difficulty: 'medium',
    tags: ['strings', 'math'],
    entryFunctions: { javascript: 'intToRoman', python: 'int_to_roman' },
    statement: `Write the function intToRoman(n).

Return n (1 to 3999) as a Roman numeral in standard subtractive notation.

PARAMETERS
- n: an integer (1 <= n <= 3999)

RETURNS
The Roman numeral string.`,
    starterCode: {
      javascript: `function intToRoman(n) {
  // greedy: take the biggest symbol that still fits
}
`,
      python: `def int_to_roman(n):
    # greedy: take the biggest symbol that still fits
    pass
`,
    },
    reference: {
      javascript: `function intToRoman(n) {
  const pairs = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  for (const [v, sym] of pairs) {
    while (n >= v) {
      out += sym;
      n -= v;
    }
  }
  return out;
}`,
      python: `def int_to_roman(n):
    pairs = [
        (1000, 'M'), (900, 'CM'), (500, 'D'), (400, 'CD'),
        (100, 'C'), (90, 'XC'), (50, 'L'), (40, 'XL'),
        (10, 'X'), (9, 'IX'), (5, 'V'), (4, 'IV'), (1, 'I'),
    ]
    out = []
    for v, sym in pairs:
        while n >= v:
            out.append(sym)
            n -= v
    return ''.join(out)`,
    },
    tests: [
      { args: [3], hidden: false },
      { args: [58], hidden: false },
      { args: [1994], hidden: true },
      { args: [1], hidden: true },
      { args: [3999], hidden: true },
    ],
  },
  {
    slug: 'coin-min',
    title: 'Minimum Coins',
    difficulty: 'medium',
    tags: ['dynamic-programming'],
    entryFunctions: { javascript: 'minCoins', python: 'min_coins' },
    statement: `Write the function minCoins(amount, coins).

You have unlimited coins of the given denominations. Return the FEWEST
coins that add up to amount, or -1 if it is impossible. amount 0 needs
0 coins.

PARAMETERS
- amount: the target sum (0 <= amount <= 10000)
- coins: array of distinct positive integers (1 <= length <= 20)

RETURNS
The fewest number of coins, or -1.`,
    starterCode: {
      javascript: `function minCoins(amount, coins) {
  // dp[a] = fewest coins for a; try every coin at every step
}
`,
      python: `def min_coins(amount, coins):
    # dp[a] = fewest coins for a; try every coin at every step
    pass
`,
    },
    reference: {
      javascript: `function minCoins(amount, coins) {
  const INF = amount + 1;
  const dp = new Array(amount + 1).fill(INF);
  dp[0] = 0;
  for (let a = 1; a <= amount; a++) {
    for (const c of coins) {
      if (c <= a && dp[a - c] + 1 < dp[a]) dp[a] = dp[a - c] + 1;
    }
  }
  return dp[amount] > amount ? -1 : dp[amount];
}`,
      python: `def min_coins(amount, coins):
    INF = amount + 1
    dp = [INF] * (amount + 1)
    dp[0] = 0
    for a in range(1, amount + 1):
        for c in coins:
            if c <= a and dp[a - c] + 1 < dp[a]:
                dp[a] = dp[a - c] + 1
    return -1 if dp[amount] > amount else dp[amount]`,
    },
    tests: [
      { args: [11, [1, 2, 5]], hidden: false },
      { args: [3, [2]], hidden: false },
      { args: [0, [1]], hidden: true },
      { args: [6, [1, 3, 4]], hidden: true },
      { args: [10000, [1, 3, 4]], hidden: true },
    ],
  },
  {
    slug: 'pascal-row',
    title: "Pascal's Row",
    difficulty: 'medium',
    tags: ['math', 'dynamic-programming'],
    entryFunctions: { javascript: 'pascalRow', python: 'pascal_row' },
    statement: `Write the function pascalRow(n).

Return row n of Pascal's triangle (0-indexed: row 0 is [1]), with every
value reduced modulo 1000000007.

PARAMETERS
- n: the row index (0 <= n <= 2000)

RETURNS
An array of n+1 values — row n, each modulo 1000000007.`,
    starterCode: {
      javascript: `function pascalRow(n) {
  // each row from the previous one, keep values under the modulus
}
`,
      python: `def pascal_row(n):
    # each row from the previous one, keep values under the modulus
    pass
`,
    },
    reference: {
      javascript: `function pascalRow(n) {
  const M = 1000000007;
  let row = [1];
  for (let i = 1; i <= n; i++) {
    const next = [1];
    for (let j = 1; j < i; j++) next.push((row[j - 1] + row[j]) % M);
    next.push(1);
    row = next;
  }
  return row;
}`,
      python: `def pascal_row(n):
    M = 1000000007
    row = [1]
    for _ in range(1, n + 1):
        nxt = [1]
        for j in range(1, len(row)):
            nxt.append((row[j - 1] + row[j]) % M)
        nxt.append(1)
        row = nxt
    return row`,
    },
    tests: [
      { args: [0], hidden: false },
      { args: [4], hidden: false },
      { args: [1], hidden: true },
      { args: [10], hidden: true },
      { args: [2000], hidden: true },
    ],
  },
  {
    slug: 'no-repeat-length',
    title: 'Longest Unique Run',
    difficulty: 'medium',
    tags: ['sliding-window', 'strings'],
    entryFunctions: { javascript: 'lengthOfLongestSubstring', python: 'length_of_longest_substring' },
    statement: `Write the function lengthOfLongestSubstring(s).

Return the length of the longest run of consecutive characters in s that
contains NO repeated character.

PARAMETERS
- s: a string of up to 100000 characters

RETURNS
The length of the longest run without repeats (0 for empty s).`,
    starterCode: {
      javascript: `function lengthOfLongestSubstring(s) {
  // slide a window; remember each character's last position
}
`,
      python: `def length_of_longest_substring(s):
    # slide a window; remember each character's last position
    pass
`,
    },
    reference: {
      javascript: `function lengthOfLongestSubstring(s) {
  const last = new Map();
  let start = 0;
  let best = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const seen = last.get(ch);
    if (seen !== undefined && seen >= start) start = seen + 1;
    last.set(ch, i);
    if (i - start + 1 > best) best = i - start + 1;
  }
  return best;
}`,
      python: `def length_of_longest_substring(s):
    last = {}
    start = 0
    best = 0
    for i, ch in enumerate(s):
        seen = last.get(ch)
        if seen is not None and seen >= start:
            start = seen + 1
        last[ch] = i
        best = max(best, i - start + 1)
    return best`,
    },
    tests: [
      { args: ['abcabcbb'], hidden: false },
      { args: ['bbbbb'], hidden: false },
      { args: [''], hidden: true },
      { args: ['pwwkew'], hidden: true },
      { args: ['ab'.repeat(50000)], hidden: true },
    ],
  },
  {
    slug: 'max-subarray',
    title: 'Max Subarray Sum',
    difficulty: 'medium',
    tags: ['dynamic-programming', 'arrays'],
    entryFunctions: { javascript: 'maxSubarray', python: 'max_subarray' },
    statement: `Write the function maxSubarray(nums).

Return the largest possible sum of a NON-EMPTY run of consecutive values
in nums. All values may be negative - then the answer is the largest
single value.

PARAMETERS
- nums: array of integers (1 <= length <= 100000, values in [-10000, 10000])

RETURNS
The maximum contiguous subarray sum.`,
    starterCode: {
      javascript: `function maxSubarray(nums) {
  // Kadane: either extend the run or start fresh here
}
`,
      python: `def max_subarray(nums):
    # Kadane: either extend the run or start fresh here
    pass
`,
    },
    reference: {
      javascript: `function maxSubarray(nums) {
  let best = nums[0];
  let cur = nums[0];
  for (let i = 1; i < nums.length; i++) {
    cur = Math.max(nums[i], cur + nums[i]);
    if (cur > best) best = cur;
  }
  return best;
}`,
      python: `def max_subarray(nums):
    best = nums[0]
    cur = nums[0]
    for v in nums[1:]:
        cur = max(v, cur + v)
        best = max(best, cur)
    return best`,
    },
    tests: [
      { args: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], hidden: false },
      { args: [[-3, -1, -2]], hidden: false },
      { args: [[5]], hidden: true },
      { args: [[1, 2, 3, 4]], hidden: true },
      {
        args: [Array.from({ length: 100000 }, (_, i) => ((i * 37) % 20001) - 10000)],
        hidden: true,
      },
    ],
  },
  {
    slug: 'stock-profit',
    title: 'Best Stock Profit',
    difficulty: 'medium',
    tags: ['arrays', 'greedy'],
    entryFunctions: { javascript: 'maxProfit', python: 'max_profit' },
    statement: `Write the function maxProfit(prices).

prices[i] is the stock price on day i. You may buy on one day and sell on
a LATER day (or the same day, which earns 0). Return the maximum profit,
or 0 when no sequence of days earns anything.

PARAMETERS
- prices: array of integers (1 <= length <= 100000, values in [0, 10^9])

RETURNS
The maximum profit achievable with one buy and one later sell.`,
    starterCode: {
      javascript: `function maxProfit(prices) {
  // track the cheapest price so far, try selling each day
}
`,
      python: `def max_profit(prices):
    # track the cheapest price so far, try selling each day
    pass
`,
    },
    reference: {
      javascript: `function maxProfit(prices) {
  let min = prices[0];
  let profit = 0;
  for (const p of prices) {
    if (p - min > profit) profit = p - min;
    if (p < min) min = p;
  }
  return profit;
}`,
      python: `def max_profit(prices):
    cheapest = prices[0]
    profit = 0
    for p in prices:
        if p - cheapest > profit:
            profit = p - cheapest
        if p < cheapest:
            cheapest = p
    return profit`,
    },
    tests: [
      { args: [[7, 1, 5, 3, 6, 4]], hidden: false },
      { args: [[7, 6, 4, 3, 1]], hidden: false },
      { args: [[5]], hidden: true },
      { args: [[2, 4, 1, 7]], hidden: true },
      { args: [Array.from({ length: 100000 }, (_, i) => (i * 13) % 1000000000)], hidden: true },
    ],
  },
  {
    slug: 'move-zeroes',
    title: 'Move Zeroes',
    difficulty: 'medium',
    tags: ['arrays', 'two-pointers'],
    entryFunctions: { javascript: 'moveZeroes', python: 'move_zeroes' },
    statement: `Write the function moveZeroes(nums).

Return a new array with all the zeros of nums moved to the END, keeping
the relative order of the non-zero values.

PARAMETERS
- nums: array of integers (up to 100000 values)

RETURNS
The non-zero values in their original order, followed by all the zeros.`,
    starterCode: {
      javascript: `function moveZeroes(nums) {
  // collect non-zeros in order, count the zeros
}
`,
      python: `def move_zeroes(nums):
    # collect non-zeros in order, count the zeros
    pass
`,
    },
    reference: {
      javascript: `function moveZeroes(nums) {
  const out = [];
  let zeros = 0;
  for (const v of nums) {
    if (v === 0) zeros++;
    else out.push(v);
  }
  for (let i = 0; i < zeros; i++) out.push(0);
  return out;
}`,
      python: `def move_zeroes(nums):
    out = []
    zeros = 0
    for v in nums:
        if v == 0:
            zeros += 1
        else:
            out.append(v)
    out.extend([0] * zeros)
    return out`,
    },
    tests: [
      { args: [[0, 1, 0, 3, 12]], hidden: false },
      { args: [[0]], hidden: false },
      { args: [[1, 2, 3]], hidden: true },
      { args: [[0, 0, 0, 1]], hidden: true },
      {
        args: [Array.from({ length: 100000 }, (_, i) => (i % 3 === 0 ? 0 : i))],
        hidden: true,
      },
    ],
  },
  {
    slug: 'caesar-shift',
    title: 'Caesar Shift',
    difficulty: 'medium',
    tags: ['strings'],
    entryFunctions: { javascript: 'caesarShift', python: 'caesar_shift' },
    statement: `Write the function caesarShift(s, k).

Return s with every letter shifted k positions forward through the
alphabet (wrapping around: 'z' + 1 = 'a'). Uppercase stays uppercase,
lowercase stays lowercase, non-letters are unchanged. k can be any
non-negative integer - reduce it modulo 26.

PARAMETERS
- s: a string of up to 10000 ASCII characters
- k: the shift amount (0 <= k <= 10^9)

RETURNS
The shifted string.`,
    starterCode: {
      javascript: `function caesarShift(s, k) {
  // k % 26 first; wrap letters inside their own case
}
`,
      python: `def caesar_shift(s, k):
    # k % 26 first; wrap letters inside their own case
    pass
`,
    },
    reference: {
      javascript: `function caesarShift(s, k) {
  const shift = k % 26;
  let out = '';
  for (const ch of s) {
    if (ch >= 'a' && ch <= 'z') out += String.fromCharCode(((ch.charCodeAt(0) - 97 + shift) % 26) + 97);
    else if (ch >= 'A' && ch <= 'Z') out += String.fromCharCode(((ch.charCodeAt(0) - 65 + shift) % 26) + 65);
    else out += ch;
  }
  return out;
}`,
      python: `def caesar_shift(s, k):
    shift = k % 26
    out = []
    for ch in s:
        if 'a' <= ch <= 'z':
            out.append(chr((ord(ch) - 97 + shift) % 26 + 97))
        elif 'A' <= ch <= 'Z':
            out.append(chr((ord(ch) - 65 + shift) % 26 + 65))
        else:
            out.append(ch)
    return ''.join(out)`,
    },
    tests: [
      { args: ['abc', 2], hidden: false },
      { args: ['XYZ', 3], hidden: false },
      { args: ['Hello, World!', 5], hidden: true },
      { args: ['no-change', 0], hidden: true },
      { args: ['Wrap around zZ', 1000000007], hidden: true },
    ],
  },
  {
    slug: 'kth-largest',
    title: 'Kth Largest',
    difficulty: 'medium',
    tags: ['arrays', 'sorting'],
    entryFunctions: { javascript: 'kthLargest', python: 'kth_largest' },
    statement: `Write the function kthLargest(nums, k).

Return the k-th LARGEST value of nums counting duplicates (in [3,2,3,1]
the 2nd largest is 3). 1 <= k <= length of nums.

PARAMETERS
- nums: array of integers (1 <= length <= 100000, values up to ±10^9)
- k: which largest to return (1 <= k <= length)

RETURNS
The k-th largest value.`,
    starterCode: {
      javascript: `function kthLargest(nums, k) {
  // sort descending, take slot k-1 - a heap also works
}
`,
      python: `def kth_largest(nums, k):
    # sort descending, take slot k-1 - a heap also works
    pass
`,
    },
    reference: {
      javascript: `function kthLargest(nums, k) {
  const sorted = nums.slice().sort((a, b) => b - a);
  return sorted[k - 1];
}`,
      python: `def kth_largest(nums, k):
    return sorted(nums, reverse=True)[k - 1]`,
    },
    tests: [
      { args: [[3, 2, 1, 5, 6, 4], 2], hidden: false },
      { args: [[3, 2, 3, 1], 2], hidden: false },
      { args: [[7], 1], hidden: true },
      { args: [[-1, -1, -2], 3], hidden: true },
      {
        args: [Array.from({ length: 100000 }, (_, i) => ((i * 91) % 2000000000) - 1000000000), 1234],
        hidden: true,
      },
    ],
  },

  // ---------------------------------------------------------------- hard
  {
    slug: 'count-inversions',
    title: 'Count Inversions',
    difficulty: 'hard',
    tags: ['divide-and-conquer', 'sorting'],
    entryFunctions: { javascript: 'countInversions', python: 'count_inversions' },
    statement: `Write the function countInversions(nums).

Count the pairs of indices i < j where nums[i] > nums[j] (an "inversion"
pair). A sorted list has 0; a reversed list has the most. A merge-sort
based count keeps this fast for 100000 values.

PARAMETERS
- nums: array of integers (1 <= length <= 100000, values up to ±10^9; the count stays below 2^53)

RETURNS
The number of inversion pairs.`,
    starterCode: {
      javascript: `function countInversions(nums) {
  // merge sort, adding (mid - i) when the right side wins a comparison
}
`,
      python: `def count_inversions(nums):
    # merge sort, adding (mid - i) when the right side wins a comparison
    pass
`,
    },
    reference: {
      javascript: `function countInversions(nums) {
  const a = nums.slice();
  function sortCount(lo, hi) {
    if (hi - lo <= 1) return 0;
    const mid = (lo + hi) >> 1;
    let inv = sortCount(lo, mid) + sortCount(mid, hi);
    const tmp = [];
    let i = lo;
    let j = mid;
    while (i < mid && j < hi) {
      if (a[i] <= a[j]) tmp.push(a[i++]);
      else {
        inv += mid - i;
        tmp.push(a[j++]);
      }
    }
    while (i < mid) tmp.push(a[i++]);
    while (j < hi) tmp.push(a[j++]);
    for (let k = lo; k < hi; k++) a[k] = tmp[k - lo];
    return inv;
  }
  return sortCount(0, a.length);
}`,
      python: `def count_inversions(nums):
    a = list(nums)

    def sort_count(lo, hi):
        if hi - lo <= 1:
            return 0
        mid = (lo + hi) // 2
        inv = sort_count(lo, mid) + sort_count(mid, hi)
        tmp = []
        i, j = lo, mid
        while i < mid and j < hi:
            if a[i] <= a[j]:
                tmp.append(a[i])
                i += 1
            else:
                inv += mid - i
                tmp.append(a[j])
                j += 1
        tmp.extend(a[i:mid])
        tmp.extend(a[j:hi])
        a[lo:hi] = tmp
        return inv

    return sort_count(0, len(a))`,
    },
    tests: [
      { args: [[2, 4, 1, 3, 5]], hidden: false },
      { args: [[1, 2, 3]], hidden: false },
      { args: [[1]], hidden: true },
      { args: [[3, 2, 1]], hidden: true },
      { args: [Array.from({ length: 100000 }, (_, i) => 100000 - i)], hidden: true },
    ],
  },
  {
    slug: 'islands-count',
    title: 'Island Count',
    difficulty: 'hard',
    tags: ['graph', 'flood-fill'],
    entryFunctions: { javascript: 'islandsCount', python: 'islands_count' },
    statement: `Write the function islandsCount(grid).

grid is a matrix of 0s and 1s; 1 is land, 0 is water. Two land cells are
the same island if they touch horizontally or vertically (not diagonally).
Return how many separate islands there are.

PARAMETERS
- grid: matrix of 0/1 (1 <= rows, cols <= 100)

RETURNS
The number of islands.`,
    starterCode: {
      javascript: `function islandsCount(grid) {
  // flood fill from every unvisited land cell - a stack avoids recursion limits
}
`,
      python: `def islands_count(grid):
    # flood fill from every unvisited land cell - a stack avoids recursion limits
    pass
`,
    },
    reference: {
      javascript: `function islandsCount(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const visited = grid.map((r) => r.map(() => false));
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  let count = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (grid[i][j] !== 1 || visited[i][j]) continue;
      count++;
      visited[i][j] = true;
      const stack = [[i, j]];
      while (stack.length > 0) {
        const [r, c] = stack.pop();
        for (const [dr, dc] of dirs) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] === 1 && !visited[nr][nc]) {
            visited[nr][nc] = true;
            stack.push([nr, nc]);
          }
        }
      }
    }
  }
  return count;
}`,
      python: `def islands_count(grid):
    rows, cols = len(grid), len(grid[0])
    visited = [[False] * cols for _ in range(rows)]
    dirs = [(1, 0), (-1, 0), (0, 1), (0, -1)]
    count = 0
    for i in range(rows):
        for j in range(cols):
            if grid[i][j] != 1 or visited[i][j]:
                continue
            count += 1
            visited[i][j] = True
            stack = [(i, j)]
            while stack:
                r, c = stack.pop()
                for dr, dc in dirs:
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == 1 and not visited[nr][nc]:
                        visited[nr][nc] = True
                        stack.append((nr, nc))
    return count`,
    },
    tests: [
      { args: [[[1, 1, 0], [0, 1, 0], [0, 0, 1]]], hidden: false },
      { args: [[[0, 0], [0, 0]]], hidden: false },
      { args: [[[1]]], hidden: true },
      { args: [[[1, 0], [0, 1]]], hidden: true },
      {
        args: [Array.from({ length: 100 }, (_, i) => Array.from({ length: 100 }, (_, j) => (i + j) % 2))],
        hidden: true,
      },
    ],
  },
  {
    slug: 'spiral-order',
    title: 'Spiral Order',
    difficulty: 'hard',
    tags: ['matrix', 'simulation'],
    entryFunctions: { javascript: 'spiralOrder', python: 'spiral_order' },
    statement: `Write the function spiralOrder(matrix).

Walk the matrix clockwise starting from the top-left corner, spiraling
inward, and return the values in the order visited.

PARAMETERS
- matrix: matrix of integers (1 <= rows, cols <= 100, at least one cell)

RETURNS
All the values in clockwise spiral order.`,
    starterCode: {
      javascript: `function spiralOrder(matrix) {
  // shrink four boundaries as you peel each side
}
`,
      python: `def spiral_order(matrix):
    # shrink four boundaries as you peel each side
    pass
`,
    },
    reference: {
      javascript: `function spiralOrder(matrix) {
  const out = [];
  let top = 0;
  let bottom = matrix.length - 1;
  let left = 0;
  let right = matrix[0].length - 1;
  while (top <= bottom && left <= right) {
    for (let j = left; j <= right; j++) out.push(matrix[top][j]);
    top++;
    for (let i = top; i <= bottom; i++) out.push(matrix[i][right]);
    right--;
    if (top <= bottom) {
      for (let j = right; j >= left; j--) out.push(matrix[bottom][j]);
      bottom--;
    }
    if (left <= right) {
      for (let i = bottom; i >= top; i--) out.push(matrix[i][left]);
      left++;
    }
  }
  return out;
}`,
      python: `def spiral_order(matrix):
    out = []
    top, bottom = 0, len(matrix) - 1
    left, right = 0, len(matrix[0]) - 1
    while top <= bottom and left <= right:
        for j in range(left, right + 1):
            out.append(matrix[top][j])
        top += 1
        for i in range(top, bottom + 1):
            out.append(matrix[i][right])
        right -= 1
        if top <= bottom:
            for j in range(right, left - 1, -1):
                out.append(matrix[bottom][j])
            bottom -= 1
        if left <= right:
            for i in range(bottom, top - 1, -1):
                out.append(matrix[i][left])
            left += 1
    return out`,
    },
    tests: [
      {
        args: [[[1, 2, 3], [4, 5, 6], [7, 8, 9]]],
        hidden: false,
      },
      { args: [[[1, 2, 3, 4]]], hidden: false },
      { args: [[[1, 2], [3, 4], [5, 6]]], hidden: true },
      { args: [[[42]]], hidden: true },
      {
        args: [Array.from({ length: 50 }, (_, i) => Array.from({ length: 40 }, (_, j) => i * 40 + j + 1))],
        hidden: true,
      },
    ],
  },
  {
    slug: 'josephus-survivor',
    title: 'Josephus Survivor',
    difficulty: 'hard',
    tags: ['math', 'simulation'],
    entryFunctions: { javascript: 'josephus', python: 'josephus' },
    statement: `Write the function josephus(n, k).

n people stand in a circle, numbered 1..n. Starting the count at person 1,
every k-th person is eliminated (the count continues around the circle
from the next person). Return the number of the LAST person left.

PARAMETERS
- n: the number of people (1 <= n <= 1000000)
- k: the elimination step (1 <= k <= 1000)

RETURNS
The 1-based number of the survivor.`,
    starterCode: {
      javascript: `function josephus(n, k) {
  // survivor(n, k) = (survivor(n-1, k) + k) mod n - one pass, no simulation
}
`,
      python: `def josephus(n, k):
    # survivor(n, k) = (survivor(n-1, k) + k) mod n - one pass, no simulation
    pass
`,
    },
    reference: {
      javascript: `function josephus(n, k) {
  let r = 0; // survivor of a 1-person circle (0-based)
  for (let i = 1; i <= n; i++) r = (r + k) % i;
  return r + 1;
}`,
      python: `def josephus(n, k):
    r = 0  # survivor of a 1-person circle (0-based)
    for i in range(1, n + 1):
        r = (r + k) % i
    return r + 1`,
    },
    tests: [
      { args: [5, 2], hidden: false },
      { args: [7, 3], hidden: false },
      { args: [1, 5], hidden: true },
      { args: [10, 1], hidden: true },
      { args: [1000000, 7], hidden: true },
    ],
  },
  {
    slug: 'sudoku-valid',
    title: 'Sudoku Validator',
    difficulty: 'hard',
    tags: ['matrix', 'sets'],
    entryFunctions: { javascript: 'sudokuValid', python: 'sudoku_valid' },
    statement: `Write the function sudokuValid(grid).

grid is a 9x9 matrix of digits 0-9, where 0 marks an EMPTY cell. Return
true if no digit repeats within any row, any column, or any of the nine
3x3 boxes (empty cells are ignored and always fine). This checks a
POSITION's validity - it does not need to be solvable or complete.

PARAMETERS
- grid: 9x9 matrix of integers 0-9

RETURNS
true or false.`,
    starterCode: {
      javascript: `function sudokuValid(grid) {
  // check every row, column, and 3x3 box for a duplicate digit
}
`,
      python: `def sudoku_valid(grid):
    # check every row, column, and 3x3 box for a duplicate digit
    pass
`,
    },
    reference: {
      javascript: `function sudokuValid(grid) {
  for (let i = 0; i < 9; i++) {
    const rowSeen = new Set();
    const colSeen = new Set();
    for (let j = 0; j < 9; j++) {
      const rv = grid[i][j];
      if (rv !== 0) {
        if (rowSeen.has(rv)) return false;
        rowSeen.add(rv);
      }
      const cv = grid[j][i];
      if (cv !== 0) {
        if (colSeen.has(cv)) return false;
        colSeen.add(cv);
      }
    }
  }
  for (let bi = 0; bi < 9; bi += 3) {
    for (let bj = 0; bj < 9; bj += 3) {
      const seen = new Set();
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const v = grid[bi + i][bj + j];
          if (v !== 0) {
            if (seen.has(v)) return false;
            seen.add(v);
          }
        }
      }
    }
  }
  return true;
}`,
      python: `def sudoku_valid(grid):
    for i in range(9):
        row_seen = set()
        col_seen = set()
        for j in range(9):
            rv = grid[i][j]
            if rv != 0:
                if rv in row_seen:
                    return False
                row_seen.add(rv)
            cv = grid[j][i]
            if cv != 0:
                if cv in col_seen:
                    return False
                col_seen.add(cv)
    for bi in (0, 3, 6):
        for bj in (0, 3, 6):
            seen = set()
            for i in range(3):
                for j in range(3):
                    v = grid[bi + i][bj + j]
                    if v != 0:
                        if v in seen:
                            return False
                        seen.add(v)
    return True`,
    },
    tests: [
      {
        args: [
          [
            [5, 3, 0, 0, 7, 0, 0, 0, 0],
            [6, 0, 0, 1, 9, 5, 0, 0, 0],
            [0, 9, 8, 0, 0, 0, 0, 6, 0],
            [8, 0, 0, 0, 6, 0, 0, 0, 3],
            [4, 0, 0, 8, 0, 3, 0, 0, 1],
            [7, 0, 0, 0, 2, 0, 0, 0, 6],
            [0, 6, 0, 0, 0, 0, 2, 8, 0],
            [0, 0, 0, 4, 1, 9, 0, 0, 5],
            [0, 0, 0, 0, 8, 0, 0, 7, 9],
          ],
        ],
        hidden: false,
      },
      { args: [[[5, 5, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0]]], hidden: false },
      {
        args: [
          [
            [5, 3, 4, 6, 7, 8, 9, 1, 2],
            [6, 7, 2, 1, 9, 5, 3, 4, 8],
            [1, 9, 8, 3, 4, 2, 5, 6, 7],
            [8, 5, 9, 7, 6, 1, 4, 2, 3],
            [4, 2, 6, 8, 5, 3, 7, 9, 1],
            [7, 1, 3, 9, 2, 4, 8, 5, 6],
            [9, 6, 1, 5, 3, 7, 2, 8, 4],
            [2, 8, 7, 4, 1, 9, 6, 3, 5],
            [3, 4, 5, 2, 8, 6, 1, 7, 9],
          ],
        ],
        hidden: true,
      },
      {
        args: [
          [
            [5, 3, 4, 6, 7, 8, 9, 1, 2],
            [6, 7, 2, 1, 9, 5, 3, 4, 8],
            [1, 9, 8, 3, 4, 2, 5, 6, 7],
            [8, 5, 9, 7, 6, 1, 4, 2, 3],
            [4, 2, 6, 8, 5, 3, 7, 9, 1],
            [7, 1, 3, 9, 2, 4, 8, 5, 6],
            [9, 6, 1, 5, 3, 7, 2, 8, 4],
            [2, 8, 7, 4, 1, 9, 6, 3, 5],
            [3, 4, 5, 2, 8, 6, 1, 7, 5],
          ],
        ],
        hidden: true,
      },
      { args: [Array.from({ length: 9 }, () => Array(9).fill(0))], hidden: true },
    ],
  },
  {
    slug: 'n-queens-count',
    title: 'N-Queens Count',
    difficulty: 'hard',
    tags: ['backtracking'],
    entryFunctions: { javascript: 'nQueensCount', python: 'n_queens_count' },
    statement: `Write the function nQueensCount(n).

Count the ways to place n chess queens on an n x n board so that no two
queens attack each other (no shared row, column, or diagonal).

PARAMETERS
- n: the board size (1 <= n <= 9)

RETURNS
The number of distinct placements.`,
    starterCode: {
      javascript: `function nQueensCount(n) {
  // backtrack row by row; bitmasks for the columns and both diagonals
}
`,
      python: `def n_queens_count(n):
    # backtrack row by row; bitmasks for the columns and both diagonals
    pass
`,
    },
    reference: {
      javascript: `function nQueensCount(n) {
  const full = (1 << n) - 1;
  let count = 0;
  function rec(cols, diag1, diag2) {
    if (cols === full) {
      count++;
      return;
    }
    let free = ~(cols | diag1 | diag2) & full;
    while (free !== 0) {
      const pick = free & -free;
      free ^= pick;
      rec(cols | pick, ((diag1 | pick) << 1) & full, (diag2 | pick) >> 1);
    }
  }
  rec(0, 0, 0);
  return count;
}`,
      python: `def n_queens_count(n):
    full = (1 << n) - 1
    count = 0

    def rec(cols, diag1, diag2):
        nonlocal count
        if cols == full:
            count += 1
            return
        free = ~(cols | diag1 | diag2) & full
        while free:
            pick = free & -free
            free ^= pick
            rec(cols | pick, ((diag1 | pick) << 1) & full, (diag2 | pick) >> 1)

    rec(0, 0, 0)
    return count`,
    },
    tests: [
      { args: [4], hidden: false },
      { args: [1], hidden: false },
      { args: [2], hidden: true },
      { args: [6], hidden: true },
      { args: [9], hidden: true },
    ],
  },
  {
    slug: 'palindrome-sub-length',
    title: 'Longest Palindrome',
    difficulty: 'hard',
    tags: ['strings', 'two-pointers'],
    entryFunctions: { javascript: 'longestPalindromeLength', python: 'longest_palindrome_length' },
    statement: `Write the function longestPalindromeLength(s).

Return the LENGTH of the longest run of consecutive characters in s that
reads the same forwards and backwards (a substring - characters must be
contiguous). The empty string has length 0.

PARAMETERS
- s: a string of up to 1000 lowercase letters

RETURNS
The length of the longest palindromic substring.`,
    starterCode: {
      javascript: `function longestPalindromeLength(s) {
  // expand around each of the 2n-1 centers
}
`,
      python: `def longest_palindrome_length(s):
    # expand around each of the 2n-1 centers
    pass
`,
    },
    reference: {
      javascript: `function longestPalindromeLength(s) {
  const expand = (l, r) => {
    while (l >= 0 && r < s.length && s[l] === s[r]) {
      l--;
      r++;
    }
    return r - l - 1;
  };
  let best = 0;
  for (let c = 0; c < s.length; c++) {
    best = Math.max(best, expand(c, c), expand(c, c + 1));
  }
  return best;
}`,
      python: `def longest_palindrome_length(s):
    def expand(l, r):
        while l >= 0 and r < len(s) and s[l] == s[r]:
            l -= 1
            r += 1
        return r - l - 1

    best = 0
    for c in range(len(s)):
        best = max(best, expand(c, c), expand(c, c + 1))
    return best`,
    },
    tests: [
      { args: ['babad'], hidden: false },
      { args: ['cbbd'], hidden: false },
      { args: [''], hidden: true },
      { args: ['abcdefggfedcba'], hidden: true },
      { args: ['ab'.repeat(500)], hidden: true },
    ],
  },
  {
    slug: 'lcs-length',
    title: 'Common Subsequence',
    difficulty: 'hard',
    tags: ['dynamic-programming', 'strings'],
    entryFunctions: { javascript: 'lcsLength', python: 'lcs_length' },
    statement: `Write the function lcsLength(a, b).

Return the length of the LONGEST COMMON SUBSEQUENCE of a and b: the
longest string that can be read in both by deleting characters (keeping
the order, not necessarily contiguous).

PARAMETERS
- a: a string of up to 1000 characters
- b: a string of up to 1000 characters

RETURNS
The length of the longest common subsequence.`,
    starterCode: {
      javascript: `function lcsLength(a, b) {
  // dp over prefixes; keep two rows, not the whole table
}
`,
      python: `def lcs_length(a, b):
    # dp over prefixes; keep two rows, not the whole table
    pass
`,
    },
    reference: {
      javascript: `function lcsLength(a, b) {
  const prev = new Array(b.length + 1).fill(0);
  const cur = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}`,
      python: `def lcs_length(a, b):
    prev = [0] * (len(b) + 1)
    cur = [0] * (len(b) + 1)
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                cur[j] = prev[j - 1] + 1
            else:
                cur[j] = max(prev[j], cur[j - 1])
        prev = cur[:]
    return prev[len(b)]`,
    },
    tests: [
      { args: ['abcde', 'ace'], hidden: false },
      { args: ['abc', 'abc'], hidden: false },
      { args: ['abc', 'def'], hidden: true },
      { args: ['', 'x'], hidden: true },
      { args: ['abc'.repeat(100), 'acb'.repeat(100)], hidden: true },
    ],
  },
];
