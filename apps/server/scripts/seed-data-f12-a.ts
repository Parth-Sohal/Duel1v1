import { raw, type F12Entry } from './seed-data-f12-types.js';

/** F12 batch A: challenges 1-10 in pool order. */
export const F12_A: Record<string, F12Entry> = {
  'pair-target-sum': {
    entry: { name: 'pairTargetSum', params: ['number[]', 'number'], returns: 'number[]' },
    starterCode: {
      java: raw`class Solution {
  static long[] pairTargetSum(long[] nums, long target) {
    // TODO: return the two values that add up to target
    return new long[] {};
  }
}
`,
      cpp: raw`vector<long long> pairTargetSum(vector<long long> nums, long long target) {
  // TODO: return the two values that add up to target
  return {};
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long[] pairTargetSum(long[] nums, long target) {
    for (int i = 0; i < nums.length; i++) {
      for (int j = i + 1; j < nums.length; j++) {
        if (nums[i] + nums[j] == target) return new long[] { nums[i], nums[j] };
      }
    }
    return new long[] {};
  }
}
`,
      cpp: raw`vector<long long> pairTargetSum(vector<long long> nums, long long target) {
  for (size_t i = 0; i < nums.size(); i++) {
    for (size_t j = i + 1; j < nums.size(); j++) {
      if (nums[i] + nums[j] == target) return {nums[i], nums[j]};
    }
  }
  return {};
}
`,
    },
  },

  'reverse-words': {
    entry: { name: 'reverseWords', params: ['string[]'], returns: 'string[]' },
    starterCode: {
      java: raw`class Solution {
  static String[] reverseWords(String[] lines) {
    // TODO: reverse the words on every line
    return new String[] {};
  }
}
`,
      cpp: raw`vector<string> reverseWords(vector<string> lines) {
  // TODO: reverse the words on every line
  return {};
}
`,
    },
    reference: {
      java: raw`class Solution {
  static String[] reverseWords(String[] lines) {
    String[] out = new String[lines.length];
    for (int i = 0; i < lines.length; i++) {
      String[] words = lines[i].trim().split("\\s+");
      StringBuilder sb = new StringBuilder();
      for (int j = words.length - 1; j >= 0; j--) {
        if (words[j].isEmpty()) continue;
        if (sb.length() > 0) sb.append(' ');
        sb.append(words[j]);
      }
      out[i] = sb.toString();
    }
    return out;
  }
}
`,
      cpp: raw`vector<string> reverseWords(vector<string> lines) {
  vector<string> out;
  for (const string& line : lines) {
    istringstream ss(line);
    vector<string> words;
    string w;
    while (ss >> w) words.push_back(w);
    string joined;
    for (size_t i = words.size(); i-- > 0;) {
      if (!joined.empty()) joined += ' ';
      joined += words[i];
    }
    out.push_back(joined);
  }
  return out;
}
`,
    },
  },

  'first-duplicate': {
    entry: { name: 'firstDuplicate', params: ['number[]'], returns: 'number' },
    starterCode: {
      java: raw`class Solution {
  static long firstDuplicate(long[] nums) {
    // TODO: return the first value that appears twice, or -1
    return -1;
  }
}
`,
      cpp: raw`long long firstDuplicate(vector<long long> nums) {
  // TODO: return the first value that appears twice, or -1
  return -1;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long firstDuplicate(long[] nums) {
    Set<Long> seen = new HashSet<>();
    for (long v : nums) {
      if (!seen.add(v)) return v;
    }
    return -1;
  }
}
`,
      cpp: raw`long long firstDuplicate(vector<long long> nums) {
  unordered_set<long long> seen;
  for (long long v : nums) {
    if (!seen.insert(v).second) return v;
  }
  return -1;
}
`,
    },
  },

  'max-window-sum': {
    entry: { name: 'maxWindowSum', params: ['number[]', 'number'], returns: 'number' },
    starterCode: {
      java: raw`class Solution {
  static long maxWindowSum(long[] nums, long k) {
    // TODO: return the largest sum of any k consecutive values
    return 0;
  }
}
`,
      cpp: raw`long long maxWindowSum(vector<long long> nums, long long k) {
  // TODO: return the largest sum of any k consecutive values
  return 0;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long maxWindowSum(long[] nums, long k) {
    long sum = 0;
    for (int i = 0; i < k; i++) sum += nums[i];
    long best = sum;
    for (int i = (int) k; i < nums.length; i++) {
      sum += nums[i] - nums[i - (int) k];
      if (sum > best) best = sum;
    }
    return best;
  }
}
`,
      cpp: raw`long long maxWindowSum(vector<long long> nums, long long k) {
  long long sum = 0;
  for (long long i = 0; i < k; i++) sum += nums[(size_t) i];
  long long best = sum;
  for (size_t i = (size_t) k; i < nums.size(); i++) {
    sum += nums[i] - nums[i - (size_t) k];
    if (sum > best) best = sum;
  }
  return best;
}
`,
    },
  },

  'bracket-check': {
    entry: { name: 'bracketCheck', params: ['string'], returns: 'boolean' },
    starterCode: {
      java: raw`class Solution {
  static boolean bracketCheck(String s) {
    // TODO: return true when every bracket is closed in the right order
    return false;
  }
}
`,
      cpp: raw`bool bracketCheck(string s) {
  // TODO: return true when every bracket is closed in the right order
  return false;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static boolean bracketCheck(String s) {
    Deque<Character> stack = new ArrayDeque<>();
    for (int i = 0; i < s.length(); i++) {
      char ch = s.charAt(i);
      if (ch == '(' || ch == '[' || ch == '{') {
        stack.push(ch);
      } else if (ch == ')' || ch == ']' || ch == '}') {
        if (stack.isEmpty()) return false;
        char open = stack.pop();
        if ((ch == ')' && open != '(') || (ch == ']' && open != '[') || (ch == '}' && open != '{')) {
          return false;
        }
      }
    }
    return stack.isEmpty();
  }
}
`,
      cpp: raw`bool bracketCheck(string s) {
  unordered_map<char, char> pairs{{')', '('}, {']', '['}, {'}', '{'}};
  vector<char> stack;
  for (char ch : s) {
    if (ch == '(' || ch == '[' || ch == '{') {
      stack.push_back(ch);
    } else if (ch == ')' || ch == ']' || ch == '}') {
      if (stack.empty() || stack.back() != pairs[ch]) return false;
      stack.pop_back();
    }
  }
  return stack.empty();
}
`,
    },
  },

  'climb-stairs': {
    entry: { name: 'climbStairs', params: ['number'], returns: 'number' },
    starterCode: {
      java: raw`class Solution {
  static long climbStairs(long n) {
    // TODO: count the ways to climb n steps, modulo 1000000007
    return 0;
  }
}
`,
      cpp: raw`long long climbStairs(long long n) {
  // TODO: count the ways to climb n steps, modulo 1000000007
  return 0;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long climbStairs(long n) {
    final long M = 1000000007L;
    long a = 1;
    long b = 1;
    for (long i = 2; i <= n; i++) {
      long c = (a + b) % M;
      a = b;
      b = c;
    }
    return b;
  }
}
`,
      cpp: raw`long long climbStairs(long long n) {
  const long long M = 1000000007LL;
  long long a = 1;
  long long b = 1;
  for (long long i = 2; i <= n; i++) {
    long long c = (a + b) % M;
    a = b;
    b = c;
  }
  return b;
}
`,
    },
  },

  'rotate-array': {
    entry: { name: 'rotateArray', params: ['number[]', 'number'], returns: 'number[]' },
    starterCode: {
      java: raw`class Solution {
  static long[] rotateArray(long[] nums, long k) {
    // TODO: rotate the array right by k positions
    return new long[] {};
  }
}
`,
      cpp: raw`vector<long long> rotateArray(vector<long long> nums, long long k) {
  // TODO: rotate the array right by k positions
  return {};
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long[] rotateArray(long[] nums, long k) {
    int n = nums.length;
    if (n == 0) return new long[] {};
    int r = (int) (k % n);
    long[] out = new long[n];
    for (int i = 0; i < n; i++) out[i] = nums[(i + n - r) % n];
    return out;
  }
}
`,
      cpp: raw`vector<long long> rotateArray(vector<long long> nums, long long k) {
  size_t n = nums.size();
  if (n == 0) return {};
  size_t r = (size_t) (k % (long long) n);
  vector<long long> out(n);
  for (size_t i = 0; i < n; i++) out[i] = nums[(i + n - r) % n];
  return out;
}
`,
    },
  },

  'missing-number': {
    entry: { name: 'missingNumber', params: ['number', 'number[]'], returns: 'number' },
    starterCode: {
      java: raw`class Solution {
  static long missingNumber(long n, long[] nums) {
    // TODO: return the one integer missing from 1..n
    return 0;
  }
}
`,
      cpp: raw`long long missingNumber(long long n, vector<long long> nums) {
  // TODO: return the one integer missing from 1..n
  return 0;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long missingNumber(long n, long[] nums) {
    long total = n * (n + 1) / 2;
    long sum = 0;
    for (long v : nums) sum += v;
    return total - sum;
  }
}
`,
      cpp: raw`long long missingNumber(long long n, vector<long long> nums) {
  long long total = n * (n + 1) / 2;
  long long sum = 0;
  for (long long v : nums) sum += v;
  return total - sum;
}
`,
    },
  },

  'sum-of-evens': {
    entry: { name: 'sumEvens', params: ['number[]'], returns: 'number' },
    starterCode: {
      java: raw`class Solution {
  static long sumEvens(long[] nums) {
    // TODO: add up the even values
    return 0;
  }
}
`,
      cpp: raw`long long sumEvens(vector<long long> nums) {
  // TODO: add up the even values
  return 0;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long sumEvens(long[] nums) {
    long total = 0;
    for (long v : nums) {
      if (v % 2 == 0) total += v;
    }
    return total;
  }
}
`,
      cpp: raw`long long sumEvens(vector<long long> nums) {
  long long total = 0;
  for (long long v : nums) {
    if (v % 2 == 0) total += v;
  }
  return total;
}
`,
    },
  },

  'count-vowels': {
    entry: { name: 'countVowels', params: ['string'], returns: 'number' },
    starterCode: {
      java: raw`class Solution {
  static long countVowels(String s) {
    // TODO: count the vowels (a, e, i, o, u), case-insensitive
    return 0;
  }
}
`,
      cpp: raw`long long countVowels(string s) {
  // TODO: count the vowels (a, e, i, o, u), case-insensitive
  return 0;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long countVowels(String s) {
    long n = 0;
    for (int i = 0; i < s.length(); i++) {
      char c = Character.toLowerCase(s.charAt(i));
      if (c == 'a' || c == 'e' || c == 'i' || c == 'o' || c == 'u') n++;
    }
    return n;
  }
}
`,
      cpp: raw`long long countVowels(string s) {
  long long n = 0;
  for (char raw : s) {
    char c = (char) tolower((unsigned char) raw);
    if (c == 'a' || c == 'e' || c == 'i' || c == 'o' || c == 'u') n++;
  }
  return n;
}
`,
    },
  },
};
