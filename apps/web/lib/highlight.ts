import type { Language } from '@coding-arena/shared';

/**
 * F12 editor highlighting (docs/features/F12-more-languages.md).
 *
 * A tiny, dependency-free tokenizer. It is intentionally forgiving: unknown
 * constructs stay plain text, and an unterminated string/comment simply runs
 * to the end of the buffer. The same scanner answers "is the caret inside a
 * string or comment?" so auto-pairing never fights the user inside a literal.
 */

export type TokenKind = 'plain' | 'keyword' | 'string' | 'comment' | 'number';
export type Token = { text: string; kind: TokenKind };

const javascriptKeywords = [
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'of', 'in', 'while', 'do',
  'switch', 'case', 'default', 'break', 'continue', 'new', 'class', 'extends', 'super', 'this',
  'null', 'undefined', 'true', 'false', 'typeof', 'instanceof', 'try', 'catch', 'finally', 'throw',
  'async', 'await', 'yield', 'delete', 'void', 'import', 'export', 'from', 'static', 'get', 'set',
];

const pythonKeywords = [
  'def', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'not', 'and', 'or', 'is', 'None',
  'True', 'False', 'import', 'from', 'as', 'class', 'try', 'except', 'finally', 'raise', 'with',
  'lambda', 'yield', 'pass', 'break', 'continue', 'global', 'nonlocal', 'assert', 'del', 'async',
  'await',
];

const javaKeywords = [
  'public', 'private', 'protected', 'class', 'static', 'void', 'int', 'long', 'short', 'byte',
  'double', 'float', 'boolean', 'char', 'String', 'final', 'return', 'if', 'else', 'for', 'while',
  'do', 'switch', 'case', 'default', 'break', 'continue', 'new', 'this', 'super', 'try', 'catch',
  'finally', 'throw', 'throws', 'import', 'package', 'extends', 'implements', 'interface',
  'abstract', 'synchronized', 'volatile', 'transient', 'native', 'instanceof', 'enum', 'record',
  'var', 'true', 'false', 'null',
];

const cppKeywords = [
  'auto', 'bool', 'break', 'case', 'catch', 'char', 'class', 'const', 'constexpr', 'continue',
  'default', 'delete', 'do', 'double', 'else', 'enum', 'explicit', 'extern', 'false', 'float',
  'for', 'friend', 'if', 'inline', 'int', 'long', 'namespace', 'new', 'nullptr', 'operator',
  'private', 'protected', 'public', 'return', 'short', 'signed', 'sizeof', 'static', 'struct',
  'switch', 'template', 'this', 'throw', 'true', 'try', 'typedef', 'typename', 'union', 'unsigned',
  'using', 'virtual', 'void', 'volatile', 'while', 'string', 'vector', 'std', 'size_t',
];

const KEYWORDS: Record<Language, Set<string>> = {
  javascript: new Set(javascriptKeywords),
  python: new Set(pythonKeywords),
  java: new Set(javaKeywords),
  cpp: new Set(cppKeywords),
};

const IDENT_START = /[A-Za-z_$]/;
const IDENT_PART = /[A-Za-z0-9_$]/;

export function tokenize(source: string, language: Language): Token[] {
  const out: Token[] = [];
  const keywords = KEYWORDS[language];
  const push = (text: string, kind: TokenKind): void => {
    if (text.length === 0) return;
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += text;
    else out.push({ text, kind });
  };

  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const n = source[i + 1];

    // Line and block comments (Python uses #).
    if (language !== 'python' && c === '/' && n === '/') {
      const start = i;
      i += 2;
      while (i < source.length && source[i] !== '\n') i++;
      push(source.slice(start, i), 'comment');
      continue;
    }
    if (language !== 'python' && c === '/' && n === '*') {
      const start = i;
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i = Math.min(source.length, i + 2);
      push(source.slice(start, i), 'comment');
      continue;
    }
    if (language === 'python' && c === '#') {
      const start = i;
      while (i < source.length && source[i] !== '\n') i++;
      push(source.slice(start, i), 'comment');
      continue;
    }

    // Python triple-quoted strings (docstrings).
    if (language === 'python' && (source.startsWith("'''", i) || source.startsWith('"""', i))) {
      const triple = source.slice(i, i + 3);
      const start = i;
      i += 3;
      while (i < source.length && !source.startsWith(triple, i)) i++;
      i = Math.min(source.length, i + 3);
      push(source.slice(start, i), 'string');
      continue;
    }

    // Ordinary strings; JS also has template literals.
    if (c === '"' || c === "'" || (language === 'javascript' && c === '`')) {
      const quote = c;
      const start = i;
      i++;
      while (i < source.length) {
        if (source[i] === '\\') {
          i += 2;
          continue;
        }
        if (source[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      push(source.slice(start, i), 'string');
      continue;
    }

    // Identifiers (and therefore keywords).
    if (IDENT_START.test(c)) {
      const start = i;
      i++;
      while (i < source.length && IDENT_PART.test(source[i])) i++;
      const word = source.slice(start, i);
      push(word, keywords.has(word) ? 'keyword' : 'plain');
      continue;
    }

    // Numbers.
    if (c >= '0' && c <= '9') {
      const start = i;
      i++;
      while (i < source.length && /[0-9_]/.test(source[i])) i++;
      if (source[i] === '.' && /[0-9]/.test(source[i + 1] ?? '')) {
        i++;
        while (i < source.length && /[0-9_]/.test(source[i])) i++;
      }
      if (/[eE]/.test(source[i] ?? '') && /[0-9+-]/.test(source[i + 1] ?? '')) {
        i += 2;
        while (i < source.length && /[0-9]/.test(source[i])) i++;
      }
      push(source.slice(start, i), 'number');
      continue;
    }

    push(c, 'plain');
    i++;
  }
  return out;
}

/**
 * Keyword hue per language (F12): four visibly distinct colours so players can
 * tell JS, Python, Java and C++ apart at a glance. Literals, numbers and
 * comments share one readable palette. Written as full Tailwind class strings
 * so the scanner emits them.
 */
export const KEYWORD_CLASS: Record<Language, string> = {
  javascript: 'text-accent', // orange
  python: 'text-[#e5c07b]', // yellow
  java: 'text-[#61afef]', // blue
  cpp: 'text-[#c678dd]', // purple
};

export const TOKEN_CLASS: Record<Exclude<TokenKind, 'keyword'>, string> = {
  plain: 'text-cream',
  string: 'text-[#98c379]',
  comment: 'text-neutral-500 italic',
  number: 'text-[#d19a66]',
};

export function tokenClass(kind: TokenKind, language: Language): string {
  return kind === 'keyword' ? KEYWORD_CLASS[language] : TOKEN_CLASS[kind];
}

/**
 * True when the END of `prefix` sits inside a string or comment. Used with the
 * text before the caret, so a freshly typed quote is not double-closed.
 */
export function inStringOrComment(prefix: string, language: Language): boolean {
  type State = 'code' | 'line' | 'block' | 'single' | 'double' | 'backtick' | 'triple-single' | 'triple-double';
  let state: State = 'code';

  for (let i = 0; i < prefix.length; i++) {
    const c = prefix[i];
    const n = prefix[i + 1];
    switch (state) {
      case 'code':
        if (language === 'python' && c === '#') state = 'line';
        else if (language !== 'python' && c === '/' && n === '/') {
          state = 'line';
          i++;
        } else if (language !== 'python' && c === '/' && n === '*') {
          state = 'block';
          i++;
        } else if (language === 'python' && prefix.startsWith("'''", i)) {
          state = 'triple-single';
          i += 2;
        } else if (language === 'python' && prefix.startsWith('"""', i)) {
          state = 'triple-double';
          i += 2;
        } else if (c === "'") state = 'single';
        else if (c === '"') state = 'double';
        else if (language === 'javascript' && c === '`') state = 'backtick';
        break;
      case 'line':
        if (c === '\n') state = 'code';
        break;
      case 'block':
        if (c === '*' && n === '/') {
          state = 'code';
          i++;
        }
        break;
      case 'single':
        if (c === '\\') i++;
        else if (c === "'") state = 'code';
        break;
      case 'double':
        if (c === '\\') i++;
        else if (c === '"') state = 'code';
        break;
      case 'backtick':
        if (c === '\\') i++;
        else if (c === '`') state = 'code';
        break;
      case 'triple-single':
        if (prefix.startsWith("'''", i)) {
          state = 'code';
          i += 2;
        }
        break;
      case 'triple-double':
        if (prefix.startsWith('"""', i)) {
          state = 'code';
          i += 2;
        }
        break;
    }
  }
  return state !== 'code';
}
