import type { FunctionParamType } from '@coding-arena/shared';

/**
 * F12 addendum to seed-data.ts: typed Java/C++ entry points, starter code and
 * reference solutions for every published challenge. The dynamic languages
 * (JS/Python) live in seed-data.ts / seed-data-pool2.ts; this file adds the two
 * static languages without touching existing challenge versions or submissions.
 *
 * Split into four batches purely to keep each file reviewable.
 */

export type F12Entry = {
  entry: { name: string; params: FunctionParamType[]; returns: FunctionParamType };
  starterCode: { java: string; cpp: string };
  reference: { java: string; cpp: string };
};

/** Tagged-template shorthand: Java/C++ snippets contain regex backslashes. */
export const raw = String.raw;
