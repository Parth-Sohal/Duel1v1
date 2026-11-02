# Challenge pool 2 — owner review (unpublished, frozen)

Generated from the DB (challenge_versions), not the seed file. 32 challenges (easy 12 / medium 12 / hard 8).
Every `expected` below is what the reference solution ACTUALLY returned through Judge0 —
JavaScript and Python agreed byte-for-byte on all of these. Hidden tests are marked;
their values are shown ONLY in this document and are never sent to players.

| slug | difficulty | tags | entry (js / py) | tests |
|---|---|---|---|---|
| caesar-shift | medium | strings | caesarShift / caesar_shift | 5 |
| coin-min | medium | dynamic-programming | minCoins / min_coins | 5 |
| count-inversions | hard | divide-and-conquer, sorting | countInversions / count_inversions | 5 |
| count-vowels | easy | strings | countVowels / count_vowels | 5 |
| digit-sum | easy | math | digitSum / digit_sum | 5 |
| fizzbuzz-list | easy | math, strings | fizzBuzz / fizz_buzz | 5 |
| int-to-roman | medium | strings, math | intToRoman / int_to_roman | 5 |
| is-anagram | easy | strings, hashmap | isAnagram / is_anagram | 5 |
| is-palindrome-phrase | easy | strings, two-pointers | isPalindromePhrase / is_palindrome_phrase | 5 |
| islands-count | hard | graph, flood-fill | islandsCount / islands_count | 5 |
| josephus-survivor | hard | math, simulation | josephus / josephus | 5 |
| kth-largest | medium | arrays, sorting | kthLargest / kth_largest | 5 |
| lcs-length | hard | dynamic-programming, strings | lcsLength / lcs_length | 5 |
| length-last-word | easy | strings | lengthOfLastWord / length_of_last_word | 5 |
| majority-element | medium | arrays, hashmap | majorityElement / majority_element | 5 |
| max-subarray | medium | dynamic-programming, arrays | maxSubarray / max_subarray | 5 |
| merge-sorted | easy | arrays, two-pointers | mergeSorted / merge_sorted | 5 |
| most-frequent-char | easy | strings, hashmap | mostFrequentChar / most_frequent_char | 5 |
| move-zeroes | medium | arrays, two-pointers | moveZeroes / move_zeroes | 5 |
| n-queens-count | hard | backtracking | nQueensCount / n_queens_count | 5 |
| no-repeat-length | medium | sliding-window, strings | lengthOfLongestSubstring / length_of_longest_substring | 5 |
| palindrome-sub-length | hard | strings, two-pointers | longestPalindromeLength / longest_palindrome_length | 5 |
| pascal-row | medium | math, dynamic-programming | pascalRow / pascal_row | 5 |
| range-sum | easy | math | rangeSum / range_sum | 5 |
| roman-to-int | medium | strings, math | romanToInt / roman_to_int | 5 |
| second-largest | easy | arrays | secondLargest / second_largest | 5 |
| spiral-order | hard | matrix, simulation | spiralOrder / spiral_order | 5 |
| stock-profit | medium | arrays, greedy | maxProfit / max_profit | 5 |
| sudoku-valid | hard | matrix, sets | sudokuValid / sudoku_valid | 5 |
| sum-of-evens | easy | math, arrays | sumEvens / sum_evens | 5 |
| swap-case | easy | strings | swapCase / swap_case | 5 |
| value-counts | medium | hashmap, arrays | valueCounts / value_counts | 5 |

---

## caesar-shift — Caesar Shift

**difficulty:** medium · **tags:** strings · **time limit:** 5000 ms

```
Write the function caesarShift(s, k).

Return s with every letter shifted k positions forward through the
alphabet (wrapping around: 'z' + 1 = 'a'). Uppercase stays uppercase,
lowercase stays lowercase, non-letters are unchanged. k can be any
non-negative integer - reduce it modulo 26.

PARAMETERS
- s: a string of up to 10000 ASCII characters
- k: the shift amount (0 <= k <= 10^9)

RETURNS
The shifted string.
```

**Tests (args → frozen expected):**

- #1 `["abc",2]` → `"\"cde\""`
- #2 `["XYZ",3]` → `"\"ABC\""`
- #3 HIDDEN `["Hello, World!",5]` → `"\"Mjqqt, Btwqi!\""`
- #4 HIDDEN `["no-change",0]` → `"\"no-change\""`
- #5 HIDDEN `["Wrap around zZ",1000000007]` → `"\"Pkti tkhngw sS\""`

<details><summary>starter code (javascript)</summary>

```js
function caesarShift(s, k) {
  // k % 26 first; wrap letters inside their own case
}
```

</details>

---

## coin-min — Minimum Coins

**difficulty:** medium · **tags:** dynamic-programming · **time limit:** 5000 ms

```
Write the function minCoins(amount, coins).

You have unlimited coins of the given denominations. Return the FEWEST
coins that add up to amount, or -1 if it is impossible. amount 0 needs
0 coins.

PARAMETERS
- amount: the target sum (0 <= amount <= 10000)
- coins: array of distinct positive integers (1 <= length <= 20)

RETURNS
The fewest number of coins, or -1.
```

**Tests (args → frozen expected):**

- #1 `[11,[1,2,5]]` → `"3"`
- #2 `[3,[2]]` → `"-1"`
- #3 HIDDEN `[0,[1]]` → `"0"`
- #4 HIDDEN `[6,[1,3,4]]` → `"2"`
- #5 HIDDEN `[10000,[1,3,4]]` → `"2500"`

<details><summary>starter code (javascript)</summary>

```js
function minCoins(amount, coins) {
  // dp[a] = fewest coins for a; try every coin at every step
}
```

</details>

---

## count-inversions — Count Inversions

**difficulty:** hard · **tags:** divide-and-conquer, sorting · **time limit:** 5000 ms

```
Write the function countInversions(nums).

Count the pairs of indices i < j where nums[i] > nums[j] (an "inversion"
pair). A sorted list has 0; a reversed list has the most. A merge-sort
based count keeps this fast for 100000 values.

PARAMETERS
- nums: array of integers (1 <= length <= 100000, values up to ±10^9; the count stays below 2^53)

RETURNS
The number of inversion pairs.
```

**Tests (args → frozen expected):**

- #1 `[[2,4,1,3,5]]` → `"3"`
- #2 `[[1,2,3]]` → `"0"`
- #3 HIDDEN `[[1]]` → `"0"`
- #4 HIDDEN `[[3,2,1]]` → `"3"`
- #5 HIDDEN `[[100000,99999,99998,99997,99996,99995,99994,99993,99992,99991,99990,99989,99988,99987,99986,99985,99984,99983,99982,99981,99980,99979,99978… (588898 chars)` → `"4999950000"`

<details><summary>starter code (javascript)</summary>

```js
function countInversions(nums) {
  // merge sort, adding (mid - i) when the right side wins a comparison
}
```

</details>

---

## count-vowels — Count Vowels

**difficulty:** easy · **tags:** strings · **time limit:** 5000 ms

```
Write the function countVowels(s).

Return how many vowels (a, e, i, o, u — case-insensitive) the string s
contains.

PARAMETERS
- s: a string of up to 100000 characters

RETURNS
The number of vowels.
```

**Tests (args → frozen expected):**

- #1 `["Hello World"]` → `"3"`
- #2 `["rhythm"]` → `"0"`
- #3 HIDDEN `["AEIOUaeiou"]` → `"10"`
- #4 HIDDEN `[""]` → `"0"`
- #5 HIDDEN `["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa… (100004 chars)` → `"100000"`

<details><summary>starter code (javascript)</summary>

```js
function countVowels(s) {
  // count a, e, i, o, u in any case
}
```

</details>

---

## digit-sum — Digit Sum

**difficulty:** easy · **tags:** math · **time limit:** 5000 ms

```
Write the function digitSum(n).

Return the sum of the decimal digits of the non-negative integer n.

PARAMETERS
- n: a non-negative integer (up to 10^15)

RETURNS
The sum of its digits (0 for n = 0).
```

**Tests (args → frozen expected):**

- #1 `[9875]` → `"29"`
- #2 `[0]` → `"0"`
- #3 HIDDEN `[5]` → `"5"`
- #4 HIDDEN `[1000000]` → `"1"`
- #5 HIDDEN `[987654321987654]` → `"84"`

<details><summary>starter code (javascript)</summary>

```js
function digitSum(n) {
  // peel digits with % 10 and / 10
}
```

</details>

---

## fizzbuzz-list — FizzBuzz List

**difficulty:** easy · **tags:** math, strings · **time limit:** 5000 ms

```
Write the function fizzBuzz(n).

Return the strings "1" through "n", replacing every multiple of 3 with
"Fizz", every multiple of 5 with "Buzz", and every multiple of both with
"FizzBuzz".

PARAMETERS
- n: the list length (1 <= n <= 1000)

RETURNS
An array of n strings.
```

**Tests (args → frozen expected):**

- #1 `[5]` → `"[\"1\",\"2\",\"Fizz\",\"4\",\"Buzz\"]"`
- #2 `[15]` → `"[\"1\",\"2\",\"Fizz\",\"4\",\"Buzz\",\"Fizz\",\"7\",\"8\",\"Fizz\",\"Buzz\",\"11\",\"Fizz\",\"13\",\"14\",\"FizzBuzz\"]"`
- #3 HIDDEN `[1]` → `"[\"1\"]"`
- #4 HIDDEN `[3]` → `"[\"1\",\"2\",\"Fizz\"]"`
- #5 HIDDEN `[1000]` → `"[\"1\",\"2\",\"Fizz\",\"4\",\"Buzz\",\"Fizz\",\"7\",\"8\",\"Fizz\",\"Buzz\",\"11\",\"Fizz\",\"13\",\"14\",\"FizzBuzz\",\""… (6674 chars)`

<details><summary>starter code (javascript)</summary>

```js
function fizzBuzz(n) {
  // check 15 first, then 3, then 5
}
```

</details>

---

## int-to-roman — Integer to Roman

**difficulty:** medium · **tags:** strings, math · **time limit:** 5000 ms

```
Write the function intToRoman(n).

Return n (1 to 3999) as a Roman numeral in standard subtractive notation.

PARAMETERS
- n: an integer (1 <= n <= 3999)

RETURNS
The Roman numeral string.
```

**Tests (args → frozen expected):**

- #1 `[3]` → `"\"III\""`
- #2 `[58]` → `"\"LVIII\""`
- #3 HIDDEN `[1994]` → `"\"MCMXCIV\""`
- #4 HIDDEN `[1]` → `"\"I\""`
- #5 HIDDEN `[3999]` → `"\"MMMCMXCIX\""`

<details><summary>starter code (javascript)</summary>

```js
function intToRoman(n) {
  // greedy: take the biggest symbol that still fits
}
```

</details>

---

## is-anagram — Anagram Check

**difficulty:** easy · **tags:** strings, hashmap · **time limit:** 5000 ms

```
Write the function isAnagram(a, b).

Return true if b is an anagram of a — both contain exactly the same
characters with the same counts. Inputs use lowercase letters only.

PARAMETERS
- a: a string of lowercase letters (up to 100000 characters)
- b: a string of lowercase letters

RETURNS
true or false.
```

**Tests (args → frozen expected):**

- #1 `["listen","silent"]` → `"true"`
- #2 `["hello","world"]` → `"false"`
- #3 HIDDEN `["aabb","abab"]` → `"true"`
- #4 HIDDEN `["abc","ab"]` → `"false"`
- #5 HIDDEN `["xyzqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq… (100013 chars)` → `"true"`

<details><summary>starter code (javascript)</summary>

```js
function isAnagram(a, b) {
  // different lengths can never be anagrams
}
```

</details>

---

## is-palindrome-phrase — Phrase Palindrome

**difficulty:** easy · **tags:** strings, two-pointers · **time limit:** 5000 ms

```
Write the function isPalindromePhrase(s).

Return true if s, read the same forwards and backwards after removing
everything except letters and digits and lowercasing, otherwise false. An
empty s (or one with no letters/digits) is a palindrome.

PARAMETERS
- s: a string of up to 10000 ASCII characters

RETURNS
true or false.
```

**Tests (args → frozen expected):**

- #1 `["A man, a plan, a canal: Panama"]` → `"true"`
- #2 `["race a car"]` → `"false"`
- #3 HIDDEN `[""]` → `"true"`
- #4 HIDDEN `["0P"]` → `"false"`
- #5 HIDDEN `["Madam, in Eden, I'm Adam"]` → `"true"`

<details><summary>starter code (javascript)</summary>

```js
function isPalindromePhrase(s) {
  // keep only letters+digits, lowercase, then compare ends inward
}
```

</details>

---

## islands-count — Island Count

**difficulty:** hard · **tags:** graph, flood-fill · **time limit:** 5000 ms

```
Write the function islandsCount(grid).

grid is a matrix of 0s and 1s; 1 is land, 0 is water. Two land cells are
the same island if they touch horizontally or vertically (not diagonally).
Return how many separate islands there are.

PARAMETERS
- grid: matrix of 0/1 (1 <= rows, cols <= 100)

RETURNS
The number of islands.
```

**Tests (args → frozen expected):**

- #1 `[[[1,1,0],[0,1,0],[0,0,1]]]` → `"2"`
- #2 `[[[0,0],[0,0]]]` → `"0"`
- #3 HIDDEN `[[[1]]]` → `"1"`
- #4 HIDDEN `[[[1,0],[0,1]]]` → `"2"`
- #5 HIDDEN `[[[0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0… (20203 chars)` → `"5000"`

<details><summary>starter code (javascript)</summary>

```js
function islandsCount(grid) {
  // flood fill from every unvisited land cell - a stack avoids recursion limits
}
```

</details>

---

## josephus-survivor — Josephus Survivor

**difficulty:** hard · **tags:** math, simulation · **time limit:** 5000 ms

```
Write the function josephus(n, k).

n people stand in a circle, numbered 1..n. Starting the count at person 1,
every k-th person is eliminated (the count continues around the circle
from the next person). Return the number of the LAST person left.

PARAMETERS
- n: the number of people (1 <= n <= 1000000)
- k: the elimination step (1 <= k <= 1000)

RETURNS
The 1-based number of the survivor.
```

**Tests (args → frozen expected):**

- #1 `[5,2]` → `"3"`
- #2 `[7,3]` → `"4"`
- #3 HIDDEN `[1,5]` → `"1"`
- #4 HIDDEN `[10,1]` → `"10"`
- #5 HIDDEN `[1000000,7]` → `"206072"`

<details><summary>starter code (javascript)</summary>

```js
function josephus(n, k) {
  // survivor(n, k) = (survivor(n-1, k) + k) mod n - one pass, no simulation
}
```

</details>

---

## kth-largest — Kth Largest

**difficulty:** medium · **tags:** arrays, sorting · **time limit:** 5000 ms

```
Write the function kthLargest(nums, k).

Return the k-th LARGEST value of nums counting duplicates (in [3,2,3,1]
the 2nd largest is 3). 1 <= k <= length of nums.

PARAMETERS
- nums: array of integers (1 <= length <= 100000, values up to ±10^9)
- k: which largest to return (1 <= k <= length)

RETURNS
The k-th largest value.
```

**Tests (args → frozen expected):**

- #1 `[[3,2,1,5,6,4],2]` → `"5"`
- #2 `[[3,2,3,1],2]` → `"3"`
- #3 HIDDEN `[[7],1]` → `"7"`
- #4 HIDDEN `[[-1,-1,-2],3]` → `"-2"`
- #5 HIDDEN `[[-1000000000,-999999909,-999999818,-999999727,-999999636,-999999545,-999999454,-999999363,-999999272,-999999181,-999999090,-999998999,-9999… (1100009 chars)` → `"-991012294"`

<details><summary>starter code (javascript)</summary>

```js
function kthLargest(nums, k) {
  // sort descending, take slot k-1 - a heap also works
}
```

</details>

---

## lcs-length — Common Subsequence

**difficulty:** hard · **tags:** dynamic-programming, strings · **time limit:** 5000 ms

```
Write the function lcsLength(a, b).

Return the length of the LONGEST COMMON SUBSEQUENCE of a and b: the
longest string that can be read in both by deleting characters (keeping
the order, not necessarily contiguous).

PARAMETERS
- a: a string of up to 1000 characters
- b: a string of up to 1000 characters

RETURNS
The length of the longest common subsequence.
```

**Tests (args → frozen expected):**

- #1 `["abcde","ace"]` → `"3"`
- #2 `["abc","abc"]` → `"3"`
- #3 HIDDEN `["abc","def"]` → `"0"`
- #4 HIDDEN `["","x"]` → `"0"`
- #5 HIDDEN `["abcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabc… (607 chars)` → `"200"`

<details><summary>starter code (javascript)</summary>

```js
function lcsLength(a, b) {
  // dp over prefixes; keep two rows, not the whole table
}
```

</details>

---

## length-last-word — Last Word Length

**difficulty:** easy · **tags:** strings · **time limit:** 5000 ms

```
Write the function lengthOfLastWord(s).

Return the length of the LAST word in s (words are runs of non-space
characters, separated by spaces). If s has no words, return 0.

PARAMETERS
- s: a string of up to 10000 characters (letters, digits, spaces)

RETURNS
The length of the last word, or 0.
```

**Tests (args → frozen expected):**

- #1 `["Hello World"]` → `"5"`
- #2 `["   "]` → `"0"`
- #3 HIDDEN `["day"]` → `"3"`
- #4 HIDDEN `["one two  three   "]` → `"5"`
- #5 HIDDEN `["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa… (5004 chars)` → `"5000"`

<details><summary>starter code (javascript)</summary>

```js
function lengthOfLastWord(s) {
  // trim, split on spaces, look at the last piece
}
```

</details>

---

## majority-element — Majority Element

**difficulty:** medium · **tags:** arrays, hashmap · **time limit:** 5000 ms

```
Write the function majorityElement(nums).

One value appears MORE THAN half the time in nums. Return that value.

PARAMETERS
- nums: array of integers (1 <= length <= 100000; a strict majority exists)

RETURNS
The majority value.
```

**Tests (args → frozen expected):**

- #1 `[[3,2,3]]` → `"3"`
- #2 `[[2,2,1,1,1,2,2]]` → `"2"`
- #3 HIDDEN `[[1]]` → `"1"`
- #4 HIDDEN `[[-1,-1,5]]` → `"-1"`
- #5 HIDDEN `[[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,… (392007 chars)` → `"7"`

<details><summary>starter code (javascript)</summary>

```js
function majorityElement(nums) {
  // count occurrences - or use the Boyer-Moore vote
}
```

</details>

---

## max-subarray — Max Subarray Sum

**difficulty:** medium · **tags:** dynamic-programming, arrays · **time limit:** 5000 ms

```
Write the function maxSubarray(nums).

Return the largest possible sum of a NON-EMPTY run of consecutive values
in nums. All values may be negative - then the answer is the largest
single value.

PARAMETERS
- nums: array of integers (1 <= length <= 100000, values in [-10000, 10000])

RETURNS
The maximum contiguous subarray sum.
```

**Tests (args → frozen expected):**

- #1 `[[-2,1,-3,4,-1,2,1,-5,4]]` → `"6"`
- #2 `[[-3,-1,-2]]` → `"-1"`
- #3 HIDDEN `[[5]]` → `"5"`
- #4 HIDDEN `[[1,2,3,4]]` → `"10"`
- #5 HIDDEN `[[-10000,-9963,-9926,-9889,-9852,-9815,-9778,-9741,-9704,-9667,-9630,-9593,-9556,-9519,-9482,-9445,-9408,-9371,-9334,-9297,-9260,-9223,-9186… (538928 chars)` → `"1372568"`

<details><summary>starter code (javascript)</summary>

```js
function maxSubarray(nums) {
  // Kadane: either extend the run or start fresh here
}
```

</details>

---

## merge-sorted — Merge Sorted Lists

**difficulty:** easy · **tags:** arrays, two-pointers · **time limit:** 5000 ms

```
Write the function mergeSorted(a, b).

a and b are each sorted in ascending order (duplicates allowed). Return
one array holding all their values together in ascending order.

PARAMETERS
- a: sorted array of integers (up to 100000 values)
- b: sorted array of integers (up to 100000 values)

RETURNS
The merged sorted array.
```

**Tests (args → frozen expected):**

- #1 `[[1,3,5],[2,4,6]]` → `"[1,2,3,4,5,6]"`
- #2 `[[1,1,2],[1,3]]` → `"[1,1,1,2,3]"`
- #3 HIDDEN `[[],[1,2]]` → `"[1,2]"`
- #4 HIDDEN `[[5],[]]` → `"[5]"`
- #5 HIDDEN `[[0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94… (588895 chars)` → `"[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,"… (588891 chars)`

<details><summary>starter code (javascript)</summary>

```js
function mergeSorted(a, b) {
  // walk both lists with two fingers, always take the smaller head
}
```

</details>

---

## most-frequent-char — Most Frequent Character

**difficulty:** easy · **tags:** strings, hashmap · **time limit:** 5000 ms

```
Write the function mostFrequentChar(s).

Return the character that appears most often in s. If several characters
tie, return the one whose FIRST occurrence in s comes earliest. s is
non-empty.

PARAMETERS
- s: a non-empty string of up to 100000 characters

RETURNS
The single most frequent character (ties broken by first occurrence).
```

**Tests (args → frozen expected):**

- #1 `["aabbbcc"]` → `"\"b\""`
- #2 `["abcabc"]` → `"\"a\""`
- #3 HIDDEN `["z"]` → `"\"z\""`
- #4 HIDDEN `["xyxyy"]` → `"\"y\""`
- #5 HIDDEN `["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb… (454 chars)` → `"\"b\""`

<details><summary>starter code (javascript)</summary>

```js
function mostFrequentChar(s) {
  // count, then walk s again keeping the strict maximum
}
```

</details>

---

## move-zeroes — Move Zeroes

**difficulty:** medium · **tags:** arrays, two-pointers · **time limit:** 5000 ms

```
Write the function moveZeroes(nums).

Return a new array with all the zeros of nums moved to the END, keeping
the relative order of the non-zero values.

PARAMETERS
- nums: array of integers (up to 100000 values)

RETURNS
The non-zero values in their original order, followed by all the zeros.
```

**Tests (args → frozen expected):**

- #1 `[[0,1,0,3,12]]` → `"[1,3,12,0,0]"`
- #2 `[[0]]` → `"[0]"`
- #3 HIDDEN `[[1,2,3]]` → `"[1,2,3]"`
- #4 HIDDEN `[[0,0,0,1]]` → `"[1,0,0,0]"`
- #5 HIDDEN `[[0,1,2,0,4,5,0,7,8,0,10,11,0,13,14,0,16,17,0,19,20,0,22,23,0,25,26,0,28,29,0,31,32,0,34,35,0,37,38,0,40,41,0,43,44,0,46,47,0,49,50,0,52,53,… (459263 chars)` → `"[1,2,4,5,7,8,10,11,13,14,16,17,19,20,22,23,25,26,28,29,31,32,34,35,37,38,40,41,43,44,46,47"… (459261 chars)`

<details><summary>starter code (javascript)</summary>

```js
function moveZeroes(nums) {
  // collect non-zeros in order, count the zeros
}
```

</details>

---

## n-queens-count — N-Queens Count

**difficulty:** hard · **tags:** backtracking · **time limit:** 5000 ms

```
Write the function nQueensCount(n).

Count the ways to place n chess queens on an n x n board so that no two
queens attack each other (no shared row, column, or diagonal).

PARAMETERS
- n: the board size (1 <= n <= 9)

RETURNS
The number of distinct placements.
```

**Tests (args → frozen expected):**

- #1 `[4]` → `"2"`
- #2 `[1]` → `"1"`
- #3 HIDDEN `[2]` → `"0"`
- #4 HIDDEN `[6]` → `"4"`
- #5 HIDDEN `[9]` → `"352"`

<details><summary>starter code (javascript)</summary>

```js
function nQueensCount(n) {
  // backtrack row by row; bitmasks for the columns and both diagonals
}
```

</details>

---

## no-repeat-length — Longest Unique Run

**difficulty:** medium · **tags:** sliding-window, strings · **time limit:** 5000 ms

```
Write the function lengthOfLongestSubstring(s).

Return the length of the longest run of consecutive characters in s that
contains NO repeated character.

PARAMETERS
- s: a string of up to 100000 characters

RETURNS
The length of the longest run without repeats (0 for empty s).
```

**Tests (args → frozen expected):**

- #1 `["abcabcbb"]` → `"3"`
- #2 `["bbbbb"]` → `"1"`
- #3 HIDDEN `[""]` → `"0"`
- #4 HIDDEN `["pwwkew"]` → `"3"`
- #5 HIDDEN `["ababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababab… (100004 chars)` → `"2"`

<details><summary>starter code (javascript)</summary>

```js
function lengthOfLongestSubstring(s) {
  // slide a window; remember each character's last position
}
```

</details>

---

## palindrome-sub-length — Longest Palindrome

**difficulty:** hard · **tags:** strings, two-pointers · **time limit:** 5000 ms

```
Write the function longestPalindromeLength(s).

Return the LENGTH of the longest run of consecutive characters in s that
reads the same forwards and backwards (a substring - characters must be
contiguous). The empty string has length 0.

PARAMETERS
- s: a string of up to 1000 lowercase letters

RETURNS
The length of the longest palindromic substring.
```

**Tests (args → frozen expected):**

- #1 `["babad"]` → `"3"`
- #2 `["cbbd"]` → `"2"`
- #3 HIDDEN `[""]` → `"0"`
- #4 HIDDEN `["abcdefggfedcba"]` → `"14"`
- #5 HIDDEN `["ababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababab… (1004 chars)` → `"999"`

<details><summary>starter code (javascript)</summary>

```js
function longestPalindromeLength(s) {
  // expand around each of the 2n-1 centers
}
```

</details>

---

## pascal-row — Pascal's Row

**difficulty:** medium · **tags:** math, dynamic-programming · **time limit:** 5000 ms

```
Write the function pascalRow(n).

Return row n of Pascal's triangle (0-indexed: row 0 is [1]), with every
value reduced modulo 1000000007.

PARAMETERS
- n: the row index (0 <= n <= 2000)

RETURNS
An array of n+1 values — row n, each modulo 1000000007.
```

**Tests (args → frozen expected):**

- #1 `[0]` → `"[1]"`
- #2 `[4]` → `"[1,4,6,4,1]"`
- #3 HIDDEN `[1]` → `"[1,1]"`
- #4 HIDDEN `[10]` → `"[1,10,45,120,210,252,210,120,45,10,1]"`
- #5 HIDDEN `[2000]` → `"[1,2000,1999000,331333993,668494852,663143055,995064251,594014662,733901640,436895186,1858"… (19786 chars)`

<details><summary>starter code (javascript)</summary>

```js
function pascalRow(n) {
  // each row from the previous one, keep values under the modulus
}
```

</details>

---

## range-sum — Range Sum

**difficulty:** easy · **tags:** math · **time limit:** 5000 ms

```
Write the function rangeSum(a, b).

Return the sum of every integer from a through b inclusive (a <= b). A
closed-form formula is fine - no loop needed.

PARAMETERS
- a: range start (0 <= a <= b <= 10^6)
- b: range end

RETURNS
The sum a + (a+1) + ... + b.
```

**Tests (args → frozen expected):**

- #1 `[1,5]` → `"15"`
- #2 `[10,10]` → `"10"`
- #3 HIDDEN `[0,0]` → `"0"`
- #4 HIDDEN `[7,8]` → `"15"`
- #5 HIDDEN `[0,1000000]` → `"500000500000"`

<details><summary>starter code (javascript)</summary>

```js
function rangeSum(a, b) {
  // (a + b) counts * (b - a + 1) / 2
}
```

</details>

---

## roman-to-int — Roman to Integer

**difficulty:** medium · **tags:** strings, math · **time limit:** 5000 ms

```
Write the function romanToInt(s).

s is a valid Roman numeral (I, V, X, L, C, D, M with standard subtractive
notation) representing a value from 1 to 3999. Return that value.

PARAMETERS
- s: a valid Roman numeral (1 to 3999)

RETURNS
The integer value.
```

**Tests (args → frozen expected):**

- #1 `["III"]` → `"3"`
- #2 `["MCMXCIV"]` → `"1994"`
- #3 HIDDEN `["IX"]` → `"9"`
- #4 HIDDEN `["LVIII"]` → `"58"`
- #5 HIDDEN `["MMMDCCCLXXXVIII"]` → `"3888"`

<details><summary>starter code (javascript)</summary>

```js
function romanToInt(s) {
  // a smaller value before a bigger one means subtract
}
```

</details>

---

## second-largest — Second Largest

**difficulty:** easy · **tags:** arrays · **time limit:** 5000 ms

```
Write the function secondLargest(nums).

Return the SECOND LARGEST DISTINCT value in nums. If nums has fewer than
two distinct values, return -1.

PARAMETERS
- nums: array of integers (1 <= length <= 100000, values up to ±10^9)

RETURNS
The second largest distinct value, or -1.
```

**Tests (args → frozen expected):**

- #1 `[[1,2,3,4]]` → `"3"`
- #2 `[[5,5,5]]` → `"-1"`
- #3 HIDDEN `[[2,7,7,1]]` → `"2"`
- #4 HIDDEN `[[-1,-5,-3]]` → `"-3"`
- #5 HIDDEN `[[0,1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,… (200003 chars)` → `"8"`

<details><summary>starter code (javascript)</summary>

```js
function secondLargest(nums) {
  // dedupe first - duplicates do not count
}
```

</details>

---

## spiral-order — Spiral Order

**difficulty:** hard · **tags:** matrix, simulation · **time limit:** 5000 ms

```
Write the function spiralOrder(matrix).

Walk the matrix clockwise starting from the top-left corner, spiraling
inward, and return the values in the order visited.

PARAMETERS
- matrix: matrix of integers (1 <= rows, cols <= 100, at least one cell)

RETURNS
All the values in clockwise spiral order.
```

**Tests (args → frozen expected):**

- #1 `[[[1,2,3],[4,5,6],[7,8,9]]]` → `"[1,2,3,6,9,8,7,4,5]"`
- #2 `[[[1,2,3,4]]]` → `"[1,2,3,4]"`
- #3 HIDDEN `[[[1,2],[3,4],[5,6]]]` → `"[1,2,4,6,5,3]"`
- #4 HIDDEN `[[[42]]]` → `"[42]"`
- #5 HIDDEN `[[[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40],[41,42,43,44,45,46,47,48,… (8996 chars)` → `"[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33"… (8894 chars)`

<details><summary>starter code (javascript)</summary>

```js
function spiralOrder(matrix) {
  // shrink four boundaries as you peel each side
}
```

</details>

---

## stock-profit — Best Stock Profit

**difficulty:** medium · **tags:** arrays, greedy · **time limit:** 5000 ms

```
Write the function maxProfit(prices).

prices[i] is the stock price on day i. You may buy on one day and sell on
a LATER day (or the same day, which earns 0). Return the maximum profit,
or 0 when no sequence of days earns anything.

PARAMETERS
- prices: array of integers (1 <= length <= 100000, values in [0, 10^9])

RETURNS
The maximum profit achievable with one buy and one later sell.
```

**Tests (args → frozen expected):**

- #1 `[[7,1,5,3,6,4]]` → `"5"`
- #2 `[[7,6,4,3,1]]` → `"0"`
- #3 HIDDEN `[[5]]` → `"0"`
- #4 HIDDEN `[[2,4,1,7]]` → `"6"`
- #5 HIDDEN `[[0,13,26,39,52,65,78,91,104,117,130,143,156,169,182,195,208,221,234,247,260,273,286,299,312,325,338,351,364,377,390,403,416,429,442,455,468… (714530 chars)` → `"1299987"`

<details><summary>starter code (javascript)</summary>

```js
function maxProfit(prices) {
  // track the cheapest price so far, try selling each day
}
```

</details>

---

## sudoku-valid — Sudoku Validator

**difficulty:** hard · **tags:** matrix, sets · **time limit:** 5000 ms

```
Write the function sudokuValid(grid).

grid is a 9x9 matrix of digits 0-9, where 0 marks an EMPTY cell. Return
true if no digit repeats within any row, any column, or any of the nine
3x3 boxes (empty cells are ignored and always fine). This checks a
POSITION's validity - it does not need to be solvable or complete.

PARAMETERS
- grid: 9x9 matrix of integers 0-9

RETURNS
true or false.
```

**Tests (args → frozen expected):**

- #1 `[[[5,3,0,0,7,0,0,0,0],[6,0,0,1,9,5,0,0,0],[0,9,8,0,0,0,0,6,0],[8,0,0,0,6,0,0,0,3],[4,0,0,8,0,3,0,0,1],[7,0,0,0,2,0,0,0,6],[0,6,0,0,0,0,2,8,0… (183 chars)` → `"true"`
- #2 `[[[5,5,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0… (183 chars)` → `"false"`
- #3 HIDDEN `[[[5,3,4,6,7,8,9,1,2],[6,7,2,1,9,5,3,4,8],[1,9,8,3,4,2,5,6,7],[8,5,9,7,6,1,4,2,3],[4,2,6,8,5,3,7,9,1],[7,1,3,9,2,4,8,5,6],[9,6,1,5,3,7,2,8,4… (183 chars)` → `"true"`
- #4 HIDDEN `[[[5,3,4,6,7,8,9,1,2],[6,7,2,1,9,5,3,4,8],[1,9,8,3,4,2,5,6,7],[8,5,9,7,6,1,4,2,3],[4,2,6,8,5,3,7,9,1],[7,1,3,9,2,4,8,5,6],[9,6,1,5,3,7,2,8,4… (183 chars)` → `"false"`
- #5 HIDDEN `[[[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0… (183 chars)` → `"true"`

<details><summary>starter code (javascript)</summary>

```js
function sudokuValid(grid) {
  // check every row, column, and 3x3 box for a duplicate digit
}
```

</details>

---

## sum-of-evens — Sum of Evens

**difficulty:** easy · **tags:** math, arrays · **time limit:** 5000 ms

```
Write the function sumEvens(nums).

Return the sum of every EVEN value in nums. An empty list sums to 0.

PARAMETERS
- nums: array of integers (up to 100000 values, each in [-10^9, 10^9]; the sum stays below 2^53)

RETURNS
The sum of the even values.
```

**Tests (args → frozen expected):**

- #1 `[[1,2,3,4,6]]` → `"12"`
- #2 `[[1,3,5]]` → `"0"`
- #3 HIDDEN `[[-2,-4,7]]` → `"-6"`
- #4 HIDDEN `[[0]]` → `"0"`
- #5 HIDDEN `[[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,… (588898 chars)` → `"2500050000"`

<details><summary>starter code (javascript)</summary>

```js
function sumEvens(nums) {
  // add only the values divisible by 2
}
```

</details>

---

## swap-case — Swap Case

**difficulty:** easy · **tags:** strings · **time limit:** 5000 ms

```
Write the function swapCase(s).

Return s with every lowercase letter made uppercase and every uppercase
letter made lowercase. Characters that are not letters stay as they are.

PARAMETERS
- s: a string of up to 10000 ASCII characters

RETURNS
The case-swapped string.
```

**Tests (args → frozen expected):**

- #1 `["Hello World!"]` → `"\"hELLO wORLD!\""`
- #2 `["abcDEF"]` → `"\"ABCdef\""`
- #3 HIDDEN `[""]` → `"\"\""`
- #4 HIDDEN `["123 !@#"]` → `"\"123 !@#\""`
- #5 HIDDEN `["The Quick Brown Fox Jumps Over 10 Lazy Dogs"]` → `"\"tHE qUICK bROWN fOX jUMPS oVER 10 lAZY dOGS\""`

<details><summary>starter code (javascript)</summary>

```js
function swapCase(s) {
  // flip a-z to A-Z and back, leave the rest alone
}
```

</details>

---

## value-counts — Value Counts

**difficulty:** medium · **tags:** hashmap, arrays · **time limit:** 5000 ms

```
Write the function valueCounts(nums).

Return the distinct values of nums paired with how many times each
appears, as [value, count] pairs ordered by the value's FIRST appearance.

PARAMETERS
- nums: array of integers (up to 100000 values)

RETURNS
An array of [value, count] pairs in first-appearance order.
```

**Tests (args → frozen expected):**

- #1 `[[1,2,1,3,2,1]]` → `"[[1,3],[2,2],[3,1]]"`
- #2 `[[4,4,4]]` → `"[[4,3]]"`
- #3 HIDDEN `[[]]` → `"[]"`
- #4 HIDDEN `[[7,6,7,6,5]]` → `"[[7,2],[6,2],[5,1]]"`
- #5 HIDDEN `[[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,4… (145003 chars)` → `"[[0,500],[1,500],[2,500],[3,500],[4,500],[5,500],[6,500],[7,500],[8,500],[9,500],[10,500],"… (891 chars)`

<details><summary>starter code (javascript)</summary>

```js
function valueCounts(nums) {
  // one pass with a Map, keyed by first appearance
}
```

</details>
