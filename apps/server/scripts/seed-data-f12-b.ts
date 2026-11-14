import { raw, type F12Entry } from './seed-data-f12-types.js';

/** F12 batch B: challenges 11-20 in pool order. */
export const F12_B: Record<string, F12Entry> = {
  'is-palindrome-phrase': {
    entry: { name: 'isPalindromePhrase', params: ['string'], returns: 'boolean' },
    starterCode: {
      java: raw`class Solution {
  static boolean isPalindromePhrase(String s) {
    // TODO: ignore case and non-alphanumerics, then check the palindrome
    return false;
  }
}
`,
      cpp: raw`bool isPalindromePhrase(string s) {
  // TODO: ignore case and non-alphanumerics, then check the palindrome
  return false;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static boolean isPalindromePhrase(String s) {
    StringBuilder t = new StringBuilder();
    for (int i = 0; i < s.length(); i++) {
      char c = Character.toLowerCase(s.charAt(i));
      if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) t.append(c);
    }
    int i = 0;
    int j = t.length() - 1;
    while (i < j) {
      if (t.charAt(i) != t.charAt(j)) return false;
      i++;
      j--;
    }
    return true;
  }
}
`,
      cpp: raw`bool isPalindromePhrase(string s) {
  string t;
  for (char raw : s) {
    char c = (char) tolower((unsigned char) raw);
    if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) t += c;
  }
  size_t i = 0;
  size_t j = t.size();
  while (i + 1 < j) {
    if (t[i] != t[j - 1]) return false;
    i++;
    j--;
  }
  return true;
}
`,
    },
  },

  'second-largest': {
    entry: { name: 'secondLargest', params: ['number[]'], returns: 'number' },
    starterCode: {
      java: raw`class Solution {
  static long secondLargest(long[] nums) {
    // TODO: return the second-largest distinct value, or -1
    return -1;
  }
}
`,
      cpp: raw`long long secondLargest(vector<long long> nums) {
  // TODO: return the second-largest distinct value, or -1
  return -1;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long secondLargest(long[] nums) {
    TreeSet<Long> uniq = new TreeSet<>(Collections.reverseOrder());
    for (long v : nums) uniq.add(v);
    if (uniq.size() < 2) return -1;
    Iterator<Long> it = uniq.iterator();
    it.next();
    return it.next();
  }
}
`,
      cpp: raw`long long secondLargest(vector<long long> nums) {
  set<long long, greater<long long>> uniq(nums.begin(), nums.end());
  if (uniq.size() < 2) return -1;
  auto it = uniq.begin();
  ++it;
  return *it;
}
`,
    },
  },

  'fizzbuzz-list': {
    entry: { name: 'fizzBuzz', params: ['number'], returns: 'string[]' },
    starterCode: {
      java: raw`class Solution {
  static String[] fizzBuzz(long n) {
    // TODO: build the FizzBuzz sequence from 1 to n
    return new String[] {};
  }
}
`,
      cpp: raw`vector<string> fizzBuzz(long long n) {
  // TODO: build the FizzBuzz sequence from 1 to n
  return {};
}
`,
    },
    reference: {
      java: raw`class Solution {
  static String[] fizzBuzz(long n) {
    String[] out = new String[(int) n];
    for (int i = 1; i <= n; i++) {
      if (i % 15 == 0) out[i - 1] = "FizzBuzz";
      else if (i % 3 == 0) out[i - 1] = "Fizz";
      else if (i % 5 == 0) out[i - 1] = "Buzz";
      else out[i - 1] = String.valueOf(i);
    }
    return out;
  }
}
`,
      cpp: raw`vector<string> fizzBuzz(long long n) {
  vector<string> out;
  out.reserve((size_t) n);
  for (long long i = 1; i <= n; i++) {
    if (i % 15 == 0) out.push_back("FizzBuzz");
    else if (i % 3 == 0) out.push_back("Fizz");
    else if (i % 5 == 0) out.push_back("Buzz");
    else out.push_back(to_string(i));
  }
  return out;
}
`,
    },
  },

  'most-frequent-char': {
    entry: { name: 'mostFrequentChar', params: ['string'], returns: 'string' },
    starterCode: {
      java: raw`class Solution {
  static String mostFrequentChar(String s) {
    // TODO: return the character with the highest count
    return "";
  }
}
`,
      cpp: raw`string mostFrequentChar(string s) {
  // TODO: return the character with the highest count
  return "";
}
`,
    },
    reference: {
      java: raw`class Solution {
  static String mostFrequentChar(String s) {
    Map<Character, Integer> counts = new HashMap<>();
    for (int i = 0; i < s.length(); i++) {
      counts.merge(s.charAt(i), 1, Integer::sum);
    }
    char best = s.charAt(0);
    for (int i = 0; i < s.length(); i++) {
      char ch = s.charAt(i);
      if (counts.get(ch) > counts.get(best)) best = ch;
    }
    return String.valueOf(best);
  }
}
`,
      cpp: raw`string mostFrequentChar(string s) {
  unordered_map<char, int> counts;
  for (char ch : s) counts[ch]++;
  char best = s[0];
  for (char ch : s) {
    if (counts[ch] > counts[best]) best = ch;
  }
  return string(1, best);
}
`,
    },
  },

  'digit-sum': {
    entry: { name: 'digitSum', params: ['number'], returns: 'number' },
    starterCode: {
      java: raw`class Solution {
  static long digitSum(long n) {
    // TODO: add up the decimal digits
    return 0;
  }
}
`,
      cpp: raw`long long digitSum(long long n) {
  // TODO: add up the decimal digits
  return 0;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long digitSum(long n) {
    long s = 0;
    while (n > 0) {
      s += n % 10;
      n /= 10;
    }
    return s;
  }
}
`,
      cpp: raw`long long digitSum(long long n) {
  long long s = 0;
  while (n > 0) {
    s += n % 10;
    n /= 10;
  }
  return s;
}
`,
    },
  },

  'swap-case': {
    entry: { name: 'swapCase', params: ['string'], returns: 'string' },
    starterCode: {
      java: raw`class Solution {
  static String swapCase(String s) {
    // TODO: flip the case of every ASCII letter
    return "";
  }
}
`,
      cpp: raw`string swapCase(string s) {
  // TODO: flip the case of every ASCII letter
  return "";
}
`,
    },
    reference: {
      java: raw`class Solution {
  static String swapCase(String s) {
    StringBuilder out = new StringBuilder();
    for (int i = 0; i < s.length(); i++) {
      char ch = s.charAt(i);
      if (ch >= 'a' && ch <= 'z') out.append(Character.toUpperCase(ch));
      else if (ch >= 'A' && ch <= 'Z') out.append(Character.toLowerCase(ch));
      else out.append(ch);
    }
    return out.toString();
  }
}
`,
      cpp: raw`string swapCase(string s) {
  string out;
  for (char ch : s) {
    if (ch >= 'a' && ch <= 'z') out += (char) (ch - 'a' + 'A');
    else if (ch >= 'A' && ch <= 'Z') out += (char) (ch - 'A' + 'a');
    else out += ch;
  }
  return out;
}
`,
    },
  },

  'merge-sorted': {
    entry: { name: 'mergeSorted', params: ['number[]', 'number[]'], returns: 'number[]' },
    starterCode: {
      java: raw`class Solution {
  static long[] mergeSorted(long[] a, long[] b) {
    // TODO: merge two sorted arrays into one sorted array
    return new long[] {};
  }
}
`,
      cpp: raw`vector<long long> mergeSorted(vector<long long> a, vector<long long> b) {
  // TODO: merge two sorted arrays into one sorted array
  return {};
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long[] mergeSorted(long[] a, long[] b) {
    long[] out = new long[a.length + b.length];
    int i = 0;
    int j = 0;
    int k = 0;
    while (i < a.length && j < b.length) {
      out[k++] = a[i] <= b[j] ? a[i++] : b[j++];
    }
    while (i < a.length) out[k++] = a[i++];
    while (j < b.length) out[k++] = b[j++];
    return out;
  }
}
`,
      cpp: raw`vector<long long> mergeSorted(vector<long long> a, vector<long long> b) {
  vector<long long> out;
  out.reserve(a.size() + b.size());
  size_t i = 0;
  size_t j = 0;
  while (i < a.size() && j < b.size()) {
    if (a[i] <= b[j]) out.push_back(a[i++]);
    else out.push_back(b[j++]);
  }
  while (i < a.size()) out.push_back(a[i++]);
  while (j < b.size()) out.push_back(b[j++]);
  return out;
}
`,
    },
  },

  'range-sum': {
    entry: { name: 'rangeSum', params: ['number', 'number'], returns: 'number' },
    starterCode: {
      java: raw`class Solution {
  static long rangeSum(long a, long b) {
    // TODO: add every integer from a to b inclusive
    return 0;
  }
}
`,
      cpp: raw`long long rangeSum(long long a, long long b) {
  // TODO: add every integer from a to b inclusive
  return 0;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long rangeSum(long a, long b) {
    return (a + b) * (b - a + 1) / 2;
  }
}
`,
      cpp: raw`long long rangeSum(long long a, long long b) {
  return (a + b) * (b - a + 1) / 2;
}
`,
    },
  },

  'is-anagram': {
    entry: { name: 'isAnagram', params: ['string', 'string'], returns: 'boolean' },
    starterCode: {
      java: raw`class Solution {
  static boolean isAnagram(String a, String b) {
    // TODO: return true when both strings use the same letters
    return false;
  }
}
`,
      cpp: raw`bool isAnagram(string a, string b) {
  // TODO: return true when both strings use the same letters
  return false;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static boolean isAnagram(String a, String b) {
    if (a.length() != b.length()) return false;
    Map<Character, Integer> counts = new HashMap<>();
    for (int i = 0; i < a.length(); i++) {
      counts.merge(a.charAt(i), 1, Integer::sum);
    }
    for (int i = 0; i < b.length(); i++) {
      char ch = b.charAt(i);
      Integer c = counts.get(ch);
      if (c == null || c == 0) return false;
      counts.put(ch, c - 1);
    }
    return true;
  }
}
`,
      cpp: raw`bool isAnagram(string a, string b) {
  if (a.size() != b.size()) return false;
  unordered_map<char, int> counts;
  for (char ch : a) counts[ch]++;
  for (char ch : b) {
    auto it = counts.find(ch);
    if (it == counts.end() || it->second == 0) return false;
    it->second--;
  }
  return true;
}
`,
    },
  },

  'length-last-word': {
    entry: { name: 'lengthOfLastWord', params: ['string'], returns: 'number' },
    starterCode: {
      java: raw`class Solution {
  static long lengthOfLastWord(String s) {
    // TODO: return the length of the last word, ignoring trailing spaces
    return 0;
  }
}
`,
      cpp: raw`long long lengthOfLastWord(string s) {
  // TODO: return the length of the last word, ignoring trailing spaces
  return 0;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long lengthOfLastWord(String s) {
    String[] words = s.trim().split("\\s+");
    return words[words.length - 1].length();
  }
}
`,
      cpp: raw`long long lengthOfLastWord(string s) {
  istringstream ss(s);
  string w;
  string last;
  while (ss >> w) last = w;
  return (long long) last.size();
}
`,
    },
  },
};
