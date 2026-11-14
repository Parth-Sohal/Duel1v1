/**
 * Static-language support code for the function-call harness (F12).
 *
 * `judge.ts` composes a submission as:
 *   prelude + player code + Main (Java) / main (C++)
 *
 * The player writes one function (`class Solution` in Java, a free function in
 * C++); these preludes supply the JSON reader for the test arguments and the
 * writer for the return value. They are deliberately dependency-free so they
 * compile on the public Judge0 box.
 *
 * Numbers are 64-bit: challenge values exceed 32 bits, and the dynamic
 * languages treat every number as a double.
 */

export const JAVA_PRELUDE = String.raw`import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
`;

/** Everything inside `public class Main` except `main` itself. */
export const JAVA_SUPPORT = String.raw`  static final class Val {
    static final int NUL = 0, BOOL = 1, NUM = 2, STR = 3, ARR = 4;
    int kind = NUL;
    boolean boolValue = false;
    long number = 0;
    String text = "";
    final List<Val> items = new ArrayList<>();
  }

  static final class Parser {
    private final String input;
    private int at = 0;

    Parser(String source) {
      input = source;
    }

    private void skip() {
      while (at < input.length()) {
        char c = input.charAt(at);
        if (c == ' ' || c == '\n' || c == '\r' || c == '\t') {
          at++;
        } else {
          break;
        }
      }
    }

    private RuntimeException fail(String message) {
      return new RuntimeException(message);
    }

    Val parse() {
      skip();
      Val value = readValue();
      skip();
      if (at != input.length()) throw fail("trailing characters after JSON value");
      return value;
    }

    private Val readValue() {
      skip();
      if (at >= input.length()) throw fail("unexpected end of input");
      char c = input.charAt(at);
      if (c == 'n') {
        expect("null");
        return new Val();
      }
      if (c == 't') {
        expect("true");
        Val v = new Val();
        v.kind = Val.BOOL;
        v.boolValue = true;
        return v;
      }
      if (c == 'f') {
        expect("false");
        Val v = new Val();
        v.kind = Val.BOOL;
        return v;
      }
      if (c == '"') return readString();
      if (c == '[') return readArray();
      if (c == '-' || (c >= '0' && c <= '9')) return readNumber();
      throw fail("invalid JSON value");
    }

    private void expect(String literal) {
      if (!input.startsWith(literal, at)) throw fail("invalid literal");
      at += literal.length();
    }

    private Val readArray() {
      at++;
      Val v = new Val();
      v.kind = Val.ARR;
      skip();
      if (at < input.length() && input.charAt(at) == ']') {
        at++;
        return v;
      }
      while (true) {
        v.items.add(readValue());
        skip();
        if (at >= input.length()) throw fail("unterminated array");
        char c = input.charAt(at++);
        if (c == ']') return v;
        if (c != ',') throw fail("expected ',' or ']'");
      }
    }

    private Val readNumber() {
      int start = at;
      if (input.charAt(at) == '-') at++;
      int digits = 0;
      while (at < input.length() && input.charAt(at) >= '0' && input.charAt(at) <= '9') {
        at++;
        digits++;
      }
      if (digits == 0) throw fail("invalid number");
      if (at < input.length()) {
        char c = input.charAt(at);
        if (c == '.' || c == 'e' || c == 'E') throw fail("non-integer number");
      }
      Val v = new Val();
      v.kind = Val.NUM;
      try {
        v.number = Long.parseLong(input.substring(start, at));
      } catch (NumberFormatException e) {
        throw fail("number out of range");
      }
      return v;
    }

    private Val readString() {
      at++;
      Val v = new Val();
      v.kind = Val.STR;
      StringBuilder out = new StringBuilder();
      while (at < input.length()) {
        char c = input.charAt(at++);
        if (c == '"') {
          v.text = out.toString();
          return v;
        }
        if (c == '\\') {
          if (at >= input.length()) throw fail("bad escape");
          char e = input.charAt(at++);
          switch (e) {
            case '"': out.append('"'); break;
            case '\\': out.append('\\'); break;
            case '/': out.append('/'); break;
            case 'b': out.append('\b'); break;
            case 'f': out.append('\f'); break;
            case 'n': out.append('\n'); break;
            case 'r': out.append('\r'); break;
            case 't': out.append('\t'); break;
            case 'u': {
              int code = readHex4();
              if (code >= 0xD800 && code <= 0xDBFF) {
                if (at + 1 >= input.length() || input.charAt(at) != '\\' || input.charAt(at + 1) != 'u') {
                  throw fail("bad surrogate pair");
                }
                at += 2;
                int low = readHex4();
                if (low < 0xDC00 || low > 0xDFFF) throw fail("bad surrogate pair");
                out.appendCodePoint(0x10000 + ((code - 0xD800) << 10) + (low - 0xDC00));
              } else if (code >= 0xDC00 && code <= 0xDFFF) {
                throw fail("bad surrogate pair");
              } else {
                out.append((char) code);
              }
              break;
            }
            default:
              throw fail("bad escape");
          }
        } else {
          if (c < 0x20) throw fail("control character in string");
          out.append(c);
        }
      }
      throw fail("unterminated string");
    }

    private int readHex4() {
      if (at + 4 > input.length()) throw fail("bad unicode escape");
      int value = 0;
      for (int i = 0; i < 4; i++) {
        int digit = Character.digit(input.charAt(at++), 16);
        if (digit < 0) throw fail("bad unicode escape");
        value = value * 16 + digit;
      }
      return value;
    }
  }

  static long asNum(Val v) {
    if (v.kind != Val.NUM) throw new RuntimeException("expected a number argument");
    return v.number;
  }

  static String asStr(Val v) {
    if (v.kind != Val.STR) throw new RuntimeException("expected a string argument");
    return v.text;
  }

  static boolean asBool(Val v) {
    if (v.kind != Val.BOOL) throw new RuntimeException("expected a boolean argument");
    return v.boolValue;
  }

  static long[] asNums(Val v) {
    if (v.kind != Val.ARR) throw new RuntimeException("expected an array argument");
    long[] out = new long[v.items.size()];
    for (int i = 0; i < out.length; i++) out[i] = asNum(v.items.get(i));
    return out;
  }

  static String[] asStrs(Val v) {
    if (v.kind != Val.ARR) throw new RuntimeException("expected a string array argument");
    String[] out = new String[v.items.size()];
    for (int i = 0; i < out.length; i++) out[i] = asStr(v.items.get(i));
    return out;
  }

  static long[][] asMatrix(Val v) {
    if (v.kind != Val.ARR) throw new RuntimeException("expected a matrix argument");
    long[][] out = new long[v.items.size()][];
    for (int i = 0; i < out.length; i++) out[i] = asNums(v.items.get(i));
    return out;
  }

  static String quote(String s) {
    StringBuilder out = new StringBuilder("\"");
    for (int i = 0; i < s.length(); i++) {
      char c = s.charAt(i);
      switch (c) {
        case '"': out.append("\\\""); break;
        case '\\': out.append("\\\\"); break;
        case '\b': out.append("\\b"); break;
        case '\f': out.append("\\f"); break;
        case '\n': out.append("\\n"); break;
        case '\r': out.append("\\r"); break;
        case '\t': out.append("\\t"); break;
        default:
          if (c < 0x20) out.append(String.format("\\u%04x", (int) c));
          else out.append(c);
      }
    }
    return out.append('"').toString();
  }

  static String out(long v) {
    return Long.toString(v);
  }

  static String out(boolean v) {
    return v ? "true" : "false";
  }

  static String out(String v) {
    return quote(v);
  }

  static String out(long[] v) {
    StringBuilder out = new StringBuilder("[");
    for (int i = 0; i < v.length; i++) {
      if (i > 0) out.append(',');
      out.append(out(v[i]));
    }
    return out.append(']').toString();
  }

  static String out(String[] v) {
    StringBuilder out = new StringBuilder("[");
    for (int i = 0; i < v.length; i++) {
      if (i > 0) out.append(',');
      out.append(out(v[i]));
    }
    return out.append(']').toString();
  }

  static String out(long[][] v) {
    StringBuilder out = new StringBuilder("[");
    for (int i = 0; i < v.length; i++) {
      if (i > 0) out.append(',');
      out.append(out(v[i]));
    }
    return out.append(']').toString();
  }`;

/** Includes + the `arena` namespace: JSON reader, converters, serializer. */
export const CPP_PRELUDE = String.raw`#include <bits/stdc++.h>
using namespace std;

namespace arena {

struct Val {
  enum Kind { NUL, BOOL, NUM, STR, ARR };
  Kind kind = NUL;
  bool boolean = false;
  long long number = 0;
  string text;
  vector<Val> items;
};

[[noreturn]] inline void fail(const string& message) {
  throw runtime_error(message);
}

inline void appendUtf8(string& out, unsigned int code) {
  if (code <= 0x7F) {
    out.push_back(static_cast<char>(code));
  } else if (code <= 0x7FF) {
    out.push_back(static_cast<char>(0xC0 | (code >> 6)));
    out.push_back(static_cast<char>(0x80 | (code & 0x3F)));
  } else if (code <= 0xFFFF) {
    out.push_back(static_cast<char>(0xE0 | (code >> 12)));
    out.push_back(static_cast<char>(0x80 | ((code >> 6) & 0x3F)));
    out.push_back(static_cast<char>(0x80 | (code & 0x3F)));
  } else {
    out.push_back(static_cast<char>(0xF0 | (code >> 18)));
    out.push_back(static_cast<char>(0x80 | ((code >> 12) & 0x3F)));
    out.push_back(static_cast<char>(0x80 | ((code >> 6) & 0x3F)));
    out.push_back(static_cast<char>(0x80 | (code & 0x3F)));
  }
}

struct Parser {
  const string& input;
  size_t at = 0;

  explicit Parser(const string& source) : input(source) {}

  void skip() {
    while (at < input.size()) {
      char c = input[at];
      if (c == ' ' || c == '\n' || c == '\r' || c == '\t') {
        at++;
      } else {
        break;
      }
    }
  }

  Val parse() {
    skip();
    Val value = readValue();
    skip();
    if (at != input.size()) fail("trailing characters after JSON value");
    return value;
  }

  void expect(const char* literal) {
    size_t length = strlen(literal);
    if (input.compare(at, length, literal) != 0) fail("invalid literal");
    at += length;
  }

  Val readValue() {
    skip();
    if (at >= input.size()) fail("unexpected end of input");
    char c = input[at];
    if (c == 'n') {
      expect("null");
      return Val();
    }
    if (c == 't') {
      expect("true");
      Val v;
      v.kind = Val::BOOL;
      v.boolean = true;
      return v;
    }
    if (c == 'f') {
      expect("false");
      Val v;
      v.kind = Val::BOOL;
      return v;
    }
    if (c == '"') return readString();
    if (c == '[') return readArray();
    if (c == '-' || (c >= '0' && c <= '9')) return readNumber();
    fail("invalid JSON value");
  }

  Val readArray() {
    at++;
    Val v;
    v.kind = Val::ARR;
    skip();
    if (at < input.size() && input[at] == ']') {
      at++;
      return v;
    }
    while (true) {
      v.items.push_back(readValue());
      skip();
      if (at >= input.size()) fail("unterminated array");
      char c = input[at++];
      if (c == ']') return v;
      if (c != ',') fail("expected ',' or ']'");
    }
  }

  Val readNumber() {
    size_t start = at;
    if (input[at] == '-') at++;
    size_t digits = 0;
    while (at < input.size() && input[at] >= '0' && input[at] <= '9') {
      at++;
      digits++;
    }
    if (digits == 0) fail("invalid number");
    if (at < input.size()) {
      char c = input[at];
      if (c == '.' || c == 'e' || c == 'E') fail("non-integer number");
    }
    Val v;
    v.kind = Val::NUM;
    try {
      v.number = stoll(input.substr(start, at - start));
    } catch (...) {
      fail("number out of range");
    }
    return v;
  }

  Val readString() {
    at++;
    Val v;
    v.kind = Val::STR;
    while (at < input.size()) {
      char c = input[at++];
      if (c == '"') return v;
      if (c == '\\') {
        if (at >= input.size()) fail("bad escape");
        char e = input[at++];
        switch (e) {
          case '"': v.text.push_back('"'); break;
          case '\\': v.text.push_back('\\'); break;
          case '/': v.text.push_back('/'); break;
          case 'b': v.text.push_back('\b'); break;
          case 'f': v.text.push_back('\f'); break;
          case 'n': v.text.push_back('\n'); break;
          case 'r': v.text.push_back('\r'); break;
          case 't': v.text.push_back('\t'); break;
          case 'u': {
            unsigned int code = readHex4();
            if (code >= 0xD800 && code <= 0xDBFF) {
              if (at + 1 >= input.size() || input[at] != '\\' || input[at + 1] != 'u') fail("bad surrogate pair");
              at += 2;
              unsigned int low = readHex4();
              if (low < 0xDC00 || low > 0xDFFF) fail("bad surrogate pair");
              code = 0x10000 + ((code - 0xD800) << 10) + (low - 0xDC00);
            } else if (code >= 0xDC00 && code <= 0xDFFF) {
              fail("bad surrogate pair");
            }
            appendUtf8(v.text, code);
            break;
          }
          default: fail("bad escape");
        }
      } else {
        if (static_cast<unsigned char>(c) < 0x20) fail("control character in string");
        v.text.push_back(c);
      }
    }
    fail("unterminated string");
  }

  unsigned int readHex4() {
    if (at + 4 > input.size()) fail("bad unicode escape");
    unsigned int value = 0;
    for (int i = 0; i < 4; i++) {
      char c = input[at++];
      int digit = (c >= '0' && c <= '9') ? c - '0'
                : (c >= 'a' && c <= 'f') ? c - 'a' + 10
                : (c >= 'A' && c <= 'F') ? c - 'A' + 10
                : -1;
      if (digit < 0) fail("bad unicode escape");
      value = value * 16 + static_cast<unsigned int>(digit);
    }
    return value;
  }
};

inline Val parseArgs(const string& raw) {
  Val root = Parser(raw).parse();
  if (root.kind != Val::ARR) fail("arguments must be an array");
  return root;
}

inline long long asNum(const Val& v) {
  if (v.kind != Val::NUM) fail("expected a number argument");
  return v.number;
}

inline string asStr(const Val& v) {
  if (v.kind != Val::STR) fail("expected a string argument");
  return v.text;
}

inline bool asBool(const Val& v) {
  if (v.kind != Val::BOOL) fail("expected a boolean argument");
  return v.boolean;
}

inline vector<long long> asNums(const Val& v) {
  if (v.kind != Val::ARR) fail("expected an array argument");
  vector<long long> out;
  out.reserve(v.items.size());
  for (const auto& item : v.items) out.push_back(asNum(item));
  return out;
}

inline vector<string> asStrs(const Val& v) {
  if (v.kind != Val::ARR) fail("expected a string array argument");
  vector<string> out;
  out.reserve(v.items.size());
  for (const auto& item : v.items) out.push_back(asStr(item));
  return out;
}

inline vector<vector<long long>> asMatrix(const Val& v) {
  if (v.kind != Val::ARR) fail("expected a matrix argument");
  vector<vector<long long>> out;
  out.reserve(v.items.size());
  for (const auto& item : v.items) out.push_back(asNums(item));
  return out;
}

inline string quote(const string& s) {
  string out = "\"";
  for (unsigned char c : s) {
    switch (c) {
      case '"': out += "\\\""; break;
      case '\\': out += "\\\\"; break;
      case '\b': out += "\\b"; break;
      case '\f': out += "\\f"; break;
      case '\n': out += "\\n"; break;
      case '\r': out += "\\r"; break;
      case '\t': out += "\\t"; break;
      default:
        if (c < 0x20) {
          char buffer[8];
          snprintf(buffer, sizeof(buffer), "\\u%04x", c);
          out += buffer;
        } else {
          out.push_back(static_cast<char>(c));
        }
    }
  }
  return out + '"';
}

inline string encode(long long v) { return to_string(v); }
inline string encode(bool v) { return v ? "true" : "false"; }
inline string encode(const string& v) { return quote(v); }

template <typename T>
inline string encode(const vector<T>& v) {
  string out = "[";
  for (size_t i = 0; i < v.size(); i++) {
    if (i > 0) out += ',';
    out += encode(v[i]);
  }
  return out + ']';
}

} // namespace arena
`;
