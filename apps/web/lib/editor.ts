import type { Language } from '@coding-arena/shared';
import { inStringOrComment } from './highlight';

/**
 * F12 editor behaviour (docs/features/F12-more-languages.md).
 *
 * Pure key-edit logic for the workbench textarea: bracket/quote pairing,
 * pair-aware Backspace, typing over an auto-inserted closer, and Tab indent.
 * Keeping it here (instead of inside the React component) lets the F12 gate
 * exercise it without a browser.
 */

/** Opening character -> closing character. */
export const PAIRS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '"': '"',
  "'": "'",
  '`': '`',
};

/** Characters that can close a pair. */
export const CLOSERS = new Set([')', ']', '}', '"', "'", '`']);

/** Tab inserts two spaces, matching the rest of the editor. */
export const INDENT = '  ';

export type EditorEdit = {
  /** Full replacement source text. */
  next: string;
  /** Caret/selection to restore after React commits the edit. */
  selectionStart: number;
  selectionEnd: number;
};

/**
 * Decide what a keypress should do. Returns null when the browser's default
 * text insertion should win (ordinary characters, Backspace outside a pair).
 */
export function keyEdit(input: {
  source: string;
  start: number;
  end: number;
  key: string;
  language: Language;
}): EditorEdit | null {
  const { source, key, language } = input;
  const start = Math.max(0, Math.min(source.length, input.start));
  const end = Math.max(start, Math.min(source.length, input.end));

  if (key === 'Tab') {
    return {
      next: `${source.slice(0, start)}${INDENT}${source.slice(end)}`,
      selectionStart: start + INDENT.length,
      selectionEnd: start + INDENT.length,
    };
  }

  // Backspace between a matching pair removes both characters.
  if (key === 'Backspace' && start === end && start > 0) {
    const previous = source[start - 1];
    const next = source[start];
    if (next !== undefined && PAIRS[previous] === next) {
      return {
        next: source.slice(0, start - 1) + source.slice(start + 1),
        selectionStart: start - 1,
        selectionEnd: start - 1,
      };
    }
    return null;
  }

  // Typing a closing character over an existing closer moves past it instead
  // of creating a duplicate.
  if (CLOSERS.has(key) && start === end && source[start] === key) {
    return { next: source, selectionStart: start + 1, selectionEnd: start + 1 };
  }

  if (!(key in PAIRS)) return null;

  // Inside a string or comment, brackets and quotes are literal text.
  if (inStringOrComment(source.slice(0, start), language)) return null;

  const selected = source.slice(start, end);
  return {
    next: `${source.slice(0, start)}${key}${selected}${PAIRS[key]}${source.slice(end)}`,
    // A non-empty selection stays selected inside the new pair; an empty one
    // puts the caret between the pair.
    selectionStart: start + 1,
    selectionEnd: end + 1,
  };
}
