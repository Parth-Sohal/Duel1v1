/**
 * F12 editor gate (docs/features/F12-more-languages.md): language-aware
 * tokenizing, four distinct keyword hues, and the pure auto-pairing edits.
 *
 * Run from the repo root:
 *   npx tsx apps/web/scripts/f12-editor-check.ts
 */
import assert from 'node:assert/strict';
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  entryName,
  entrySignature,
  type Language,
} from '@coding-arena/shared';
import { KEYWORD_CLASS, inStringOrComment, tokenClass, tokenize } from '../lib/highlight';
import { keyEdit, type EditorEdit } from '../lib/editor';

let checks = 0;
function check(label: string, fn: () => void): void {
  fn();
  checks++;
  console.log(`PASS ${label}`);
}

function keywords(source: string, language: Language): string[] {
  return tokenize(source, language)
    .filter((token) => token.kind === 'keyword')
    .map((token) => token.text);
}

function edit(
  source: string,
  start: number,
  end: number,
  key: string,
  language: Language = 'javascript',
): EditorEdit | null {
  return keyEdit({ source, start, end, key, language });
}

// --- Shared language model -------------------------------------------------

check('four languages with distinct chip labels', () => {
  assert.deepEqual([...LANGUAGES], ['javascript', 'python', 'java', 'cpp']);
  assert.equal(new Set(LANGUAGES.map((l) => LANGUAGE_LABELS[l])).size, 4);
});

check('entryName / entrySignature read both entry-point shapes', () => {
  assert.equal(entryName('pairTargetSum'), 'pairTargetSum');
  assert.equal(entryName(undefined), '');
  const typed = { name: 'pairTargetSum', params: ['number[]' as const], returns: 'number[]' as const };
  assert.equal(entryName(typed), 'pairTargetSum');
  assert.deepEqual(entrySignature(typed), typed);
  assert.equal(entrySignature('pairTargetSum'), null);
});

// --- Tokenizer: language-aware keywords ------------------------------------

check('JS keywords tokenize', () => {
  assert.deepEqual(keywords('const let function async', 'javascript'), [
    'const',
    'let',
    'function',
    'async',
  ]);
});

check('Python keywords tokenize', () => {
  assert.deepEqual(keywords('def lambda None await', 'python'), ['def', 'lambda', 'None', 'await']);
});

check('Java keywords tokenize', () => {
  assert.deepEqual(keywords('public static void final', 'java'), [
    'public',
    'static',
    'void',
    'final',
  ]);
});

check('C++ keywords tokenize', () => {
  assert.deepEqual(keywords('auto constexpr nullptr namespace', 'cpp'), [
    'auto',
    'constexpr',
    'nullptr',
    'namespace',
  ]);
});

check('keywords do not bleed between languages', () => {
  const source = 'def public namespace undefined';
  assert.deepEqual(keywords(source, 'javascript'), ['undefined']);
  assert.deepEqual(keywords(source, 'python'), ['def']);
  assert.deepEqual(keywords(source, 'java'), ['public']);
  assert.deepEqual(keywords(source, 'cpp'), ['public', 'namespace']);
});

// --- Tokenizer: literals, comments, numbers --------------------------------

check('strings, comments and numbers are classified', () => {
  const js = tokenize('const s = "hi"; // note\nconst n = 3.14e2;', 'javascript');
  assert.ok(js.some((t) => t.kind === 'string' && t.text === '"hi"'));
  assert.ok(js.some((t) => t.kind === 'comment' && t.text === '// note'));
  assert.ok(js.some((t) => t.kind === 'number' && t.text === '3.14e2'));

  const java = tokenize('int x; /* block */', 'java');
  assert.ok(java.some((t) => t.kind === 'comment' && t.text === '/* block */'));

  const python = tokenize('# python comment\nx = 1', 'python');
  assert.ok(python.some((t) => t.kind === 'comment' && t.text === '# python comment'));
});

check('Python docstrings and JS template literals are strings', () => {
  const python = tokenize('"""doc"""\ndef f(): pass', 'python');
  assert.ok(python.some((t) => t.kind === 'string' && t.text === '"""doc"""'));

  const js = tokenize('const s = `hi ${name}`;', 'javascript');
  assert.ok(js.some((t) => t.kind === 'string' && t.text.startsWith('`')));
});

check('unterminated strings run to end of buffer', () => {
  const tokens = tokenize('s = "abc', 'java');
  assert.ok(tokens.some((t) => t.kind === 'string' && t.text === '"abc'));
});

// --- Distinct keyword hues -------------------------------------------------

check('each language has its own keyword colour', () => {
  const hues = LANGUAGES.map((l) => KEYWORD_CLASS[l]);
  assert.equal(new Set(hues).size, 4);
  assert.notEqual(tokenClass('keyword', 'javascript'), tokenClass('keyword', 'python'));
  assert.notEqual(tokenClass('keyword', 'python'), tokenClass('keyword', 'java'));
  assert.notEqual(tokenClass('keyword', 'java'), tokenClass('keyword', 'cpp'));
  // Non-keyword tokens are language-independent.
  assert.equal(tokenClass('string', 'java'), tokenClass('string', 'javascript'));
});

// --- Auto-pairing ----------------------------------------------------------

check('opening bracket inserts a pair and keeps the caret inside', () => {
  assert.deepEqual(edit('foo', 3, 3, '('), { next: 'foo()', selectionStart: 4, selectionEnd: 4 });
  assert.deepEqual(edit('', 0, 0, '{'), { next: '{}', selectionStart: 1, selectionEnd: 1 });
  assert.deepEqual(edit('', 0, 0, '['), { next: '[]', selectionStart: 1, selectionEnd: 1 });
});

check('quotes insert a pair', () => {
  assert.deepEqual(edit('x = ', 4, 4, '"'), { next: 'x = ""', selectionStart: 5, selectionEnd: 5 });
  assert.deepEqual(edit("s = ", 4, 4, "'"), { next: "s = ''", selectionStart: 5, selectionEnd: 5 });
});

check('selection is wrapped and stays selected inside', () => {
  assert.deepEqual(edit('abc', 0, 3, '('), { next: '(abc)', selectionStart: 1, selectionEnd: 4 });
  assert.deepEqual(edit('abc', 0, 3, "'"), { next: "'abc'", selectionStart: 1, selectionEnd: 4 });
});

check('typing a closer over an auto-inserted closer moves past it', () => {
  assert.deepEqual(edit('foo()', 4, 4, ')'), {
    next: 'foo()',
    selectionStart: 5,
    selectionEnd: 5,
  });
  assert.deepEqual(edit('x = ""', 5, 5, '"'), {
    next: 'x = ""',
    selectionStart: 6,
    selectionEnd: 6,
  });
});

check('Backspace between a pair deletes both characters', () => {
  assert.deepEqual(edit('foo()', 4, 4, 'Backspace'), {
    next: 'foo',
    selectionStart: 3,
    selectionEnd: 3,
  });
  assert.deepEqual(edit('x = ""', 5, 5, 'Backspace'), {
    next: 'x = ',
    selectionStart: 4,
    selectionEnd: 4,
  });
  assert.equal(edit('foo', 3, 3, 'Backspace'), null);
});

check('brackets and quotes stay literal inside strings and comments', () => {
  assert.equal(edit('const s = "abc', 14, 14, '"'), null);
  assert.equal(edit("s = 'abc", 8, 8, "'", 'python'), null);
  assert.equal(edit('// note', 7, 7, '('), null);
  assert.equal(edit('# note', 6, 6, '{', 'python'), null);
  assert.equal(edit('/* x', 4, 4, '(', 'java'), null);
  assert.equal(edit('std::string s = "', 17, 17, '{', 'cpp'), null);
});

check('Tab inserts two spaces at the caret', () => {
  assert.deepEqual(edit('ab', 1, 1, 'Tab'), { next: 'a  b', selectionStart: 3, selectionEnd: 3 });
});

check('plain typing is left to the browser', () => {
  assert.equal(edit('abc', 3, 3, 'x'), null);
  assert.equal(edit('abc', 0, 3, ')'), null);
});

// --- String/comment scanner -----------------------------------------------

check('inStringOrComment tracks quotes and comments', () => {
  assert.equal(inStringOrComment('const s = "abc', 'javascript'), true);
  assert.equal(inStringOrComment('const s = "abc"', 'javascript'), false);
  assert.equal(inStringOrComment('const s = "a\\"b', 'javascript'), true);
  assert.equal(inStringOrComment('// note (', 'javascript'), true);
  assert.equal(inStringOrComment('/* note (', 'java'), true);
  assert.equal(inStringOrComment('# note (', 'python'), true);
  assert.equal(inStringOrComment('"""doc""" (', 'python'), false);
});

console.log(`\nRESULT: ${checks}/${checks} editor checks passed`);
