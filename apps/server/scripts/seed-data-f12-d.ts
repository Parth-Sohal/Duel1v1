import { raw, type F12Entry } from './seed-data-f12-types.js';

/** F12 batch D: challenges 31-40 in pool order. */
export const F12_D: Record<string, F12Entry> = {
  'caesar-shift': {
    entry: { name: 'caesarShift', params: ['string', 'number'], returns: 'string' },
    starterCode: {
      java: raw`class Solution {
  static String caesarShift(String s, long k) {
    // TODO: shift every letter forward by k, wrapping around z
    return "";
  }
}
`,
      cpp: raw`string caesarShift(string s, long long k) {
  // TODO: shift every letter forward by k, wrapping around z
  return "";
}
`,
    },
    reference: {
      java: raw`class Solution {
  static String caesarShift(String s, long k) {
    int shift = (int) (k % 26);
    StringBuilder out = new StringBuilder();
    for (int i = 0; i < s.length(); i++) {
      char ch = s.charAt(i);
      if (ch >= 'a' && ch <= 'z') out.append((char) (((ch - 'a' + shift) % 26) + 'a'));
      else if (ch >= 'A' && ch <= 'Z') out.append((char) (((ch - 'A' + shift) % 26) + 'A'));
      else out.append(ch);
    }
    return out.toString();
  }
}
`,
      cpp: raw`string caesarShift(string s, long long k) {
  int shift = (int) (k % 26);
  string out;
  for (char ch : s) {
    if (ch >= 'a' && ch <= 'z') out += (char) (((ch - 'a' + shift) % 26) + 'a');
    else if (ch >= 'A' && ch <= 'Z') out += (char) (((ch - 'A' + shift) % 26) + 'A');
    else out += ch;
  }
  return out;
}
`,
    },
  },

  'kth-largest': {
    entry: { name: 'kthLargest', params: ['number[]', 'number'], returns: 'number' },
    starterCode: {
      java: raw`class Solution {
  static long kthLargest(long[] nums, long k) {
    // TODO: return the k-th largest value (1 = largest)
    return 0;
  }
}
`,
      cpp: raw`long long kthLargest(vector<long long> nums, long long k) {
  // TODO: return the k-th largest value (1 = largest)
  return 0;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long kthLargest(long[] nums, long k) {
    long[] sorted = nums.clone();
    Arrays.sort(sorted);
    return sorted[sorted.length - (int) k];
  }
}
`,
      cpp: raw`long long kthLargest(vector<long long> nums, long long k) {
  sort(nums.begin(), nums.end(), greater<long long>());
  return nums[(size_t) (k - 1)];
}
`,
    },
  },

  'count-inversions': {
    entry: { name: 'countInversions', params: ['number[]'], returns: 'number' },
    starterCode: {
      java: raw`class Solution {
  static long countInversions(long[] nums) {
    // TODO: count pairs i < j where nums[i] > nums[j]
    return 0;
  }

  // A merge-sort helper keeps the count O(n log n).
}
`,
      cpp: raw`long long countInversions(vector<long long> nums) {
  // TODO: count pairs i < j where nums[i] > nums[j]
  // A merge-sort helper keeps the count O(n log n).
  return 0;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long countInversions(long[] nums) {
    long[] a = nums.clone();
    return sortCount(a, 0, a.length);
  }

  private static long sortCount(long[] a, int lo, int hi) {
    if (hi - lo <= 1) return 0;
    int mid = (lo + hi) >>> 1;
    long inv = sortCount(a, lo, mid) + sortCount(a, mid, hi);
    long[] tmp = new long[hi - lo];
    int i = lo;
    int j = mid;
    int k = 0;
    while (i < mid && j < hi) {
      if (a[i] <= a[j]) {
        tmp[k++] = a[i++];
      } else {
        inv += mid - i;
        tmp[k++] = a[j++];
      }
    }
    while (i < mid) tmp[k++] = a[i++];
    while (j < hi) tmp[k++] = a[j++];
    System.arraycopy(tmp, 0, a, lo, tmp.length);
    return inv;
  }
}
`,
      cpp: raw`long long countInversions(vector<long long> nums) {
  function<long long(int, int)> sortCount = [&](int lo, int hi) -> long long {
    if (hi - lo <= 1) return 0;
    int mid = (lo + hi) / 2;
    long long inv = sortCount(lo, mid) + sortCount(mid, hi);
    vector<long long> tmp;
    tmp.reserve(hi - lo);
    int i = lo;
    int j = mid;
    while (i < mid && j < hi) {
      if (nums[i] <= nums[j]) {
        tmp.push_back(nums[i++]);
      } else {
        inv += mid - i;
        tmp.push_back(nums[j++]);
      }
    }
    while (i < mid) tmp.push_back(nums[i++]);
    while (j < hi) tmp.push_back(nums[j++]);
    for (int k = lo; k < hi; k++) nums[k] = tmp[k - lo];
    return inv;
  };
  return sortCount(0, (int) nums.size());
}
`,
    },
  },

  'islands-count': {
    entry: { name: 'islandsCount', params: ['number[][]'], returns: 'number' },
    starterCode: {
      java: raw`class Solution {
  static long islandsCount(long[][] grid) {
    // TODO: count connected groups of 1s (up, down, left, right)
    return 0;
  }
}
`,
      cpp: raw`long long islandsCount(vector<vector<long long>> grid) {
  // TODO: count connected groups of 1s (up, down, left, right)
  return 0;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long islandsCount(long[][] grid) {
    int rows = grid.length;
    int cols = grid[0].length;
    boolean[][] visited = new boolean[rows][cols];
    int[][] dirs = { { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } };
    long count = 0;
    for (int i = 0; i < rows; i++) {
      for (int j = 0; j < cols; j++) {
        if (grid[i][j] != 1 || visited[i][j]) continue;
        count++;
        visited[i][j] = true;
        Deque<int[]> stack = new ArrayDeque<>();
        stack.push(new int[] { i, j });
        while (!stack.isEmpty()) {
          int[] cell = stack.pop();
          for (int[] d : dirs) {
            int nr = cell[0] + d[0];
            int nc = cell[1] + d[1];
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] == 1 && !visited[nr][nc]) {
              visited[nr][nc] = true;
              stack.push(new int[] { nr, nc });
            }
          }
        }
      }
    }
    return count;
  }
}
`,
      cpp: raw`long long islandsCount(vector<vector<long long>> grid) {
  int rows = (int) grid.size();
  int cols = (int) grid[0].size();
  vector<vector<char>> visited(rows, vector<char>(cols, 0));
  const int dirs[4][2] = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
  long long count = 0;
  for (int i = 0; i < rows; i++) {
    for (int j = 0; j < cols; j++) {
      if (grid[i][j] != 1 || visited[i][j]) continue;
      count++;
      visited[i][j] = 1;
      vector<pair<int, int>> stack{{i, j}};
      while (!stack.empty()) {
        auto [r, c] = stack.back();
        stack.pop_back();
        for (const auto& d : dirs) {
          int nr = r + d[0];
          int nc = c + d[1];
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] == 1 && !visited[nr][nc]) {
            visited[nr][nc] = 1;
            stack.push_back({nr, nc});
          }
        }
      }
    }
  }
  return count;
}
`,
    },
  },

  'spiral-order': {
    entry: { name: 'spiralOrder', params: ['number[][]'], returns: 'number[]' },
    starterCode: {
      java: raw`class Solution {
  static long[] spiralOrder(long[][] matrix) {
    // TODO: read the matrix in clockwise spiral order
    return new long[] {};
  }
}
`,
      cpp: raw`vector<long long> spiralOrder(vector<vector<long long>> matrix) {
  // TODO: read the matrix in clockwise spiral order
  return {};
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long[] spiralOrder(long[][] matrix) {
    int rows = matrix.length;
    int cols = matrix[0].length;
    long[] out = new long[rows * cols];
    int k = 0;
    int top = 0;
    int bottom = rows - 1;
    int left = 0;
    int right = cols - 1;
    while (top <= bottom && left <= right) {
      for (int j = left; j <= right; j++) out[k++] = matrix[top][j];
      top++;
      for (int i = top; i <= bottom; i++) out[k++] = matrix[i][right];
      right--;
      if (top <= bottom) {
        for (int j = right; j >= left; j--) out[k++] = matrix[bottom][j];
        bottom--;
      }
      if (left <= right) {
        for (int i = bottom; i >= top; i--) out[k++] = matrix[i][left];
        left++;
      }
    }
    return out;
  }
}
`,
      cpp: raw`vector<long long> spiralOrder(vector<vector<long long>> matrix) {
  int rows = (int) matrix.size();
  int cols = (int) matrix[0].size();
  vector<long long> out;
  out.reserve((size_t) rows * cols);
  int top = 0;
  int bottom = rows - 1;
  int left = 0;
  int right = cols - 1;
  while (top <= bottom && left <= right) {
    for (int j = left; j <= right; j++) out.push_back(matrix[top][j]);
    top++;
    for (int i = top; i <= bottom; i++) out.push_back(matrix[i][right]);
    right--;
    if (top <= bottom) {
      for (int j = right; j >= left; j--) out.push_back(matrix[bottom][j]);
      bottom--;
    }
    if (left <= right) {
      for (int i = bottom; i >= top; i--) out.push_back(matrix[i][left]);
      left++;
    }
  }
  return out;
}
`,
    },
  },

  'josephus-survivor': {
    entry: { name: 'josephus', params: ['number', 'number'], returns: 'number' },
    starterCode: {
      java: raw`class Solution {
  static long josephus(long n, long k) {
    // TODO: return the 1-based survivor position
    return 0;
  }
}
`,
      cpp: raw`long long josephus(long long n, long long k) {
  // TODO: return the 1-based survivor position
  return 0;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long josephus(long n, long k) {
    long r = 0;
    for (long i = 1; i <= n; i++) r = (r + k) % i;
    return r + 1;
  }
}
`,
      cpp: raw`long long josephus(long long n, long long k) {
  long long r = 0;
  for (long long i = 1; i <= n; i++) r = (r + k) % i;
  return r + 1;
}
`,
    },
  },

  'sudoku-valid': {
    entry: { name: 'sudokuValid', params: ['number[][]'], returns: 'boolean' },
    starterCode: {
      java: raw`class Solution {
  static boolean sudokuValid(long[][] grid) {
    // TODO: check rows, columns and 3x3 boxes; 0 means empty
    return false;
  }
}
`,
      cpp: raw`bool sudokuValid(vector<vector<long long>> grid) {
  // TODO: check rows, columns and 3x3 boxes; 0 means empty
  return false;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static boolean sudokuValid(long[][] grid) {
    for (int i = 0; i < 9; i++) {
      Set<Long> rowSeen = new HashSet<>();
      Set<Long> colSeen = new HashSet<>();
      for (int j = 0; j < 9; j++) {
        long rv = grid[i][j];
        if (rv != 0 && !rowSeen.add(rv)) return false;
        long cv = grid[j][i];
        if (cv != 0 && !colSeen.add(cv)) return false;
      }
    }
    for (int bi = 0; bi < 9; bi += 3) {
      for (int bj = 0; bj < 9; bj += 3) {
        Set<Long> seen = new HashSet<>();
        for (int i = 0; i < 3; i++) {
          for (int j = 0; j < 3; j++) {
            long v = grid[bi + i][bj + j];
            if (v != 0 && !seen.add(v)) return false;
          }
        }
      }
    }
    return true;
  }
}
`,
      cpp: raw`bool sudokuValid(vector<vector<long long>> grid) {
  for (int i = 0; i < 9; i++) {
    bool rowSeen[10] = {};
    bool colSeen[10] = {};
    for (int j = 0; j < 9; j++) {
      long long rv = grid[i][j];
      if (rv != 0) {
        if (rowSeen[rv]) return false;
        rowSeen[rv] = true;
      }
      long long cv = grid[j][i];
      if (cv != 0) {
        if (colSeen[cv]) return false;
        colSeen[cv] = true;
      }
    }
  }
  for (int bi = 0; bi < 9; bi += 3) {
    for (int bj = 0; bj < 9; bj += 3) {
      bool seen[10] = {};
      for (int i = 0; i < 3; i++) {
        for (int j = 0; j < 3; j++) {
          long long v = grid[bi + i][bj + j];
          if (v != 0) {
            if (seen[v]) return false;
            seen[v] = true;
          }
        }
      }
    }
  }
  return true;
}
`,
    },
  },

  'n-queens-count': {
    entry: { name: 'nQueensCount', params: ['number'], returns: 'number' },
    starterCode: {
      java: raw`class Solution {
  static long nQueensCount(long n) {
    // TODO: count the distinct solutions to the n-queens puzzle
    return 0;
  }
}
`,
      cpp: raw`long long nQueensCount(long long n) {
  // TODO: count the distinct solutions to the n-queens puzzle
  return 0;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long nQueensCount(long n) {
    int full = (1 << (int) n) - 1;
    return place(0, 0, 0, full);
  }

  private static long place(int cols, int diag1, int diag2, int full) {
    if (cols == full) return 1;
    long count = 0;
    int free = ~(cols | diag1 | diag2) & full;
    while (free != 0) {
      int pick = free & -free;
      free ^= pick;
      count += place(cols | pick, ((diag1 | pick) << 1) & full, (diag2 | pick) >> 1, full);
    }
    return count;
  }
}
`,
      cpp: raw`long long nQueensCount(long long n) {
  int full = (1 << (int) n) - 1;
  function<long long(int, int, int)> place = [&](int cols, int diag1, int diag2) -> long long {
    if (cols == full) return 1;
    long long count = 0;
    int free = ~(cols | diag1 | diag2) & full;
    while (free != 0) {
      int pick = free & -free;
      free ^= pick;
      count += place(cols | pick, ((diag1 | pick) << 1) & full, (diag2 | pick) >> 1);
    }
    return count;
  };
  return place(0, 0, 0);
}
`,
    },
  },

  'palindrome-sub-length': {
    entry: { name: 'longestPalindromeLength', params: ['string'], returns: 'number' },
    starterCode: {
      java: raw`class Solution {
  static long longestPalindromeLength(String s) {
    // TODO: return the length of the longest palindromic substring
    return 0;
  }
}
`,
      cpp: raw`long long longestPalindromeLength(string s) {
  // TODO: return the length of the longest palindromic substring
  return 0;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long longestPalindromeLength(String s) {
    long best = 0;
    for (int c = 0; c < s.length(); c++) {
      best = Math.max(best, Math.max(expand(s, c, c), expand(s, c, c + 1)));
    }
    return best;
  }

  private static int expand(String s, int l, int r) {
    while (l >= 0 && r < s.length() && s.charAt(l) == s.charAt(r)) {
      l--;
      r++;
    }
    return r - l - 1;
  }
}
`,
      cpp: raw`long long longestPalindromeLength(string s) {
  auto expand = [&](int l, int r) -> int {
    while (l >= 0 && r < (int) s.size() && s[l] == s[r]) {
      l--;
      r++;
    }
    return r - l - 1;
  };
  long long best = 0;
  for (int c = 0; c < (int) s.size(); c++) {
    best = max(best, (long long) max(expand(c, c), expand(c, c + 1)));
  }
  return best;
}
`,
    },
  },

  'lcs-length': {
    entry: { name: 'lcsLength', params: ['string', 'string'], returns: 'number' },
    starterCode: {
      java: raw`class Solution {
  static long lcsLength(String a, String b) {
    // TODO: return the length of the longest common subsequence
    return 0;
  }
}
`,
      cpp: raw`long long lcsLength(string a, string b) {
  // TODO: return the length of the longest common subsequence
  return 0;
}
`,
    },
    reference: {
      java: raw`class Solution {
  static long lcsLength(String a, String b) {
    long[] prev = new long[b.length() + 1];
    long[] cur = new long[b.length() + 1];
    for (int i = 1; i <= a.length(); i++) {
      for (int j = 1; j <= b.length(); j++) {
        cur[j] = a.charAt(i - 1) == b.charAt(j - 1) ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
      }
      System.arraycopy(cur, 0, prev, 0, cur.length);
    }
    return prev[b.length()];
  }
}
`,
      cpp: raw`long long lcsLength(string a, string b) {
  vector<long long> prev(b.size() + 1, 0);
  vector<long long> cur(b.size() + 1, 0);
  for (size_t i = 1; i <= a.size(); i++) {
    for (size_t j = 1; j <= b.size(); j++) {
      cur[j] = a[i - 1] == b[j - 1] ? prev[j - 1] + 1 : max(prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[b.size()];
}
`,
    },
  },
};
