import { raw, type F12Entry } from './seed-data-f12-types.js';

/** F12 batch C: challenges 21-30 in pool order. */
export const F12_C: Record<string, F12Entry> = {
  'majority-element': {
    entry: { name: 'majorityElement', params: ['number[]'], returns: 'number' },
    starterCode: {
      java: raw`class Solution {
  static long majorityElement(long[] nums) {
    // TODO: return the value that appears more than half the time
    return 0;
  }
}
`,
      cpp: raw`long long majorityElement(vector<long long> nums) {
  // TODO: return the value that appears more than half the time
  return 0;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long majorityElement(long[] nums) {
    long candidate = nums[0];
    long votes = 0;
    for (long v : nums) {
      if (votes == 0) candidate = v;
      votes += v == candidate ? 1 : -1;
    }
    return candidate;
  }
}
`,
      cpp: raw`long long majorityElement(vector<long long> nums) {
  long long candidate = nums[0];
  long long votes = 0;
  for (long long v : nums) {
    if (votes == 0) candidate = v;
    votes += (v == candidate) ? 1 : -1;
  }
  return candidate;
}
`,
    },
  },

  'value-counts': {
    entry: { name: 'valueCounts', params: ['number[]'], returns: 'number[][]' },
    starterCode: {
      java: raw`class Solution {
  static long[][] valueCounts(long[] nums) {
    // TODO: return [value, count] pairs in first-seen order
    return new long[][] {};
  }
}
`,
      cpp: raw`vector<vector<long long>> valueCounts(vector<long long> nums) {
  // TODO: return [value, count] pairs in first-seen order
  return {};
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long[][] valueCounts(long[] nums) {
    Map<Long, Integer> index = new LinkedHashMap<>();
    List<long[]> order = new ArrayList<>();
    for (long v : nums) {
      Integer at = index.get(v);
      if (at == null) {
        index.put(v, order.size());
        order.add(new long[] { v, 1 });
      } else {
        order.get(at)[1]++;
      }
    }
    return order.toArray(new long[0][]);
  }
}
`,
      cpp: raw`vector<vector<long long>> valueCounts(vector<long long> nums) {
  vector<vector<long long>> order;
  unordered_map<long long, size_t> index;
  for (long long v : nums) {
    auto it = index.find(v);
    if (it == index.end()) {
      index[v] = order.size();
      order.push_back({v, 1});
    } else {
      order[it->second][1]++;
    }
  }
  return order;
}
`,
    },
  },

  'roman-to-int': {
    entry: { name: 'romanToInt', params: ['string'], returns: 'number' },
    starterCode: {
      java: raw`class Solution {
  static long romanToInt(String s) {
    // TODO: convert a Roman numeral to an integer
    return 0;
  }
}
`,
      cpp: raw`long long romanToInt(string s) {
  // TODO: convert a Roman numeral to an integer
  return 0;
}
`,
    },
    reference: {
      java: raw`class Solution {
  private static int romanValue(char c) {
    switch (c) {
      case 'I': return 1;
      case 'V': return 5;
      case 'X': return 10;
      case 'L': return 50;
      case 'C': return 100;
      case 'D': return 500;
      case 'M': return 1000;
      default: return 0;
    }
  }

  static long romanToInt(String s) {
    long total = 0;
    for (int i = 0; i < s.length(); i++) {
      int v = romanValue(s.charAt(i));
      if (i + 1 < s.length() && v < romanValue(s.charAt(i + 1))) total -= v;
      else total += v;
    }
    return total;
  }
}
`,
      cpp: raw`long long romanToInt(string s) {
  auto value = [](char c) -> long long {
    switch (c) {
      case 'I': return 1;
      case 'V': return 5;
      case 'X': return 10;
      case 'L': return 50;
      case 'C': return 100;
      case 'D': return 500;
      case 'M': return 1000;
      default: return 0;
    }
  };
  long long total = 0;
  for (size_t i = 0; i < s.size(); i++) {
    long long v = value(s[i]);
    if (i + 1 < s.size() && v < value(s[i + 1])) total -= v;
    else total += v;
  }
  return total;
}
`,
    },
  },

  'int-to-roman': {
    entry: { name: 'intToRoman', params: ['number'], returns: 'string' },
    starterCode: {
      java: raw`class Solution {
  static String intToRoman(long n) {
    // TODO: convert an integer to a Roman numeral
    return "";
  }
}
`,
      cpp: raw`string intToRoman(long long n) {
  // TODO: convert an integer to a Roman numeral
  return "";
}
`,
    },
    reference: {
      java: raw`class Solution {
  static String intToRoman(long n) {
    long[] values = { 1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1 };
    String[] symbols = { "M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I" };
    StringBuilder out = new StringBuilder();
    for (int i = 0; i < values.length; i++) {
      while (n >= values[i]) {
        out.append(symbols[i]);
        n -= values[i];
      }
    }
    return out.toString();
  }
}
`,
      cpp: raw`string intToRoman(long long n) {
  const vector<pair<long long, string>> pairs = {
    {1000, "M"}, {900, "CM"}, {500, "D"}, {400, "CD"}, {100, "C"}, {90, "XC"},
    {50, "L"}, {40, "XL"}, {10, "X"}, {9, "IX"}, {5, "V"}, {4, "IV"}, {1, "I"}
  };
  string out;
  for (const auto& [v, sym] : pairs) {
    while (n >= v) {
      out += sym;
      n -= v;
    }
  }
  return out;
}
`,
    },
  },

  'coin-min': {
    entry: { name: 'minCoins', params: ['number', 'number[]'], returns: 'number' },
    starterCode: {
      java: raw`class Solution {
  static long minCoins(long amount, long[] coins) {
    // TODO: return the fewest coins that make amount, or -1
    return -1;
  }
}
`,
      cpp: raw`long long minCoins(long long amount, vector<long long> coins) {
  // TODO: return the fewest coins that make amount, or -1
  return -1;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long minCoins(long amount, long[] coins) {
    int a = (int) amount;
    long inf = amount + 1;
    long[] dp = new long[a + 1];
    Arrays.fill(dp, inf);
    dp[0] = 0;
    for (int x = 1; x <= a; x++) {
      for (long c : coins) {
        if (c <= x && dp[x - (int) c] + 1 < dp[x]) dp[x] = dp[x - (int) c] + 1;
      }
    }
    return dp[a] > amount ? -1 : dp[a];
  }
}
`,
      cpp: raw`long long minCoins(long long amount, vector<long long> coins) {
  const long long inf = amount + 1;
  vector<long long> dp((size_t) amount + 1, inf);
  dp[0] = 0;
  for (long long a = 1; a <= amount; a++) {
    for (long long c : coins) {
      if (c <= a && dp[(size_t) (a - c)] + 1 < dp[(size_t) a]) {
        dp[(size_t) a] = dp[(size_t) (a - c)] + 1;
      }
    }
  }
  return dp[(size_t) amount] > amount ? -1 : dp[(size_t) amount];
}
`,
    },
  },

  'pascal-row': {
    entry: { name: 'pascalRow', params: ['number'], returns: 'number[]' },
    starterCode: {
      java: raw`class Solution {
  static long[] pascalRow(long n) {
    // TODO: return row n of Pascal's triangle, modulo 1000000007
    return new long[] {};
  }
}
`,
      cpp: raw`vector<long long> pascalRow(long long n) {
  // TODO: return row n of Pascal's triangle, modulo 1000000007
  return {};
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long[] pascalRow(long n) {
    final long M = 1000000007L;
    long[] row = { 1 };
    for (int i = 1; i <= n; i++) {
      long[] next = new long[row.length + 1];
      next[0] = 1;
      next[next.length - 1] = 1;
      for (int j = 1; j < next.length - 1; j++) {
        next[j] = (row[j - 1] + row[j]) % M;
      }
      row = next;
    }
    return row;
  }
}
`,
      cpp: raw`vector<long long> pascalRow(long long n) {
  const long long M = 1000000007LL;
  vector<long long> row{1};
  for (long long i = 1; i <= n; i++) {
    vector<long long> next(row.size() + 1, 1);
    for (size_t j = 1; j + 1 < next.size(); j++) {
      next[j] = (row[j - 1] + row[j]) % M;
    }
    row = next;
  }
  return row;
}
`,
    },
  },

  'no-repeat-length': {
    entry: { name: 'lengthOfLongestSubstring', params: ['string'], returns: 'number' },
    starterCode: {
      java: raw`class Solution {
  static long lengthOfLongestSubstring(String s) {
    // TODO: find the longest run of characters with no repeats
    return 0;
  }
}
`,
      cpp: raw`long long lengthOfLongestSubstring(string s) {
  // TODO: find the longest run of characters with no repeats
  return 0;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long lengthOfLongestSubstring(String s) {
    Map<Character, Integer> last = new HashMap<>();
    int start = 0;
    int best = 0;
    for (int i = 0; i < s.length(); i++) {
      char ch = s.charAt(i);
      Integer seen = last.get(ch);
      if (seen != null && seen >= start) start = seen + 1;
      last.put(ch, i);
      best = Math.max(best, i - start + 1);
    }
    return best;
  }
}
`,
      cpp: raw`long long lengthOfLongestSubstring(string s) {
  unordered_map<char, int> last;
  int start = 0;
  int best = 0;
  for (int i = 0; i < (int) s.size(); i++) {
    auto it = last.find(s[i]);
    if (it != last.end() && it->second >= start) start = it->second + 1;
    last[s[i]] = i;
    best = max(best, i - start + 1);
  }
  return best;
}
`,
    },
  },

  'max-subarray': {
    entry: { name: 'maxSubarray', params: ['number[]'], returns: 'number' },
    starterCode: {
      java: raw`class Solution {
  static long maxSubarray(long[] nums) {
    // TODO: return the largest sum of a contiguous subarray
    return 0;
  }
}
`,
      cpp: raw`long long maxSubarray(vector<long long> nums) {
  // TODO: return the largest sum of a contiguous subarray
  return 0;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long maxSubarray(long[] nums) {
    long best = nums[0];
    long cur = nums[0];
    for (int i = 1; i < nums.length; i++) {
      cur = Math.max(nums[i], cur + nums[i]);
      best = Math.max(best, cur);
    }
    return best;
  }
}
`,
      cpp: raw`long long maxSubarray(vector<long long> nums) {
  long long best = nums[0];
  long long cur = nums[0];
  for (size_t i = 1; i < nums.size(); i++) {
    cur = max(nums[i], cur + nums[i]);
    best = max(best, cur);
  }
  return best;
}
`,
    },
  },

  'stock-profit': {
    entry: { name: 'maxProfit', params: ['number[]'], returns: 'number' },
    starterCode: {
      java: raw`class Solution {
  static long maxProfit(long[] prices) {
    // TODO: return the best profit from one buy and one later sell
    return 0;
  }
}
`,
      cpp: raw`long long maxProfit(vector<long long> prices) {
  // TODO: return the best profit from one buy and one later sell
  return 0;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long maxProfit(long[] prices) {
    long cheapest = prices[0];
    long profit = 0;
    for (long p : prices) {
      if (p - cheapest > profit) profit = p - cheapest;
      if (p < cheapest) cheapest = p;
    }
    return profit;
  }
}
`,
      cpp: raw`long long maxProfit(vector<long long> prices) {
  long long cheapest = prices[0];
  long long profit = 0;
  for (long long p : prices) {
    if (p - cheapest > profit) profit = p - cheapest;
    if (p < cheapest) cheapest = p;
  }
  return profit;
}
`,
    },
  },

  'move-zeroes': {
    entry: { name: 'moveZeroes', params: ['number[]'], returns: 'number[]' },
    starterCode: {
      java: raw`class Solution {
  static long[] moveZeroes(long[] nums) {
    // TODO: move every zero to the end, keeping the other values in order
    return new long[] {};
  }
}
`,
      cpp: raw`vector<long long> moveZeroes(vector<long long> nums) {
  // TODO: move every zero to the end, keeping the other values in order
  return {};
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long[] moveZeroes(long[] nums) {
    long[] out = new long[nums.length];
    int k = 0;
    for (long v : nums) {
      if (v != 0) out[k++] = v;
    }
    return out;
  }
}
`,
      cpp: raw`vector<long long> moveZeroes(vector<long long> nums) {
  vector<long long> out;
  out.reserve(nums.size());
  for (long long v : nums) {
    if (v != 0) out.push_back(v);
  }
  while (out.size() < nums.size()) out.push_back(0);
  return out;
}
`,
    },
  },
};
