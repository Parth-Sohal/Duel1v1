import type { F12Entry } from './seed-data-f12-types.js';
import { F12_A } from './seed-data-f12-a.js';
import { F12_B } from './seed-data-f12-b.js';
import { F12_C } from './seed-data-f12-c.js';
import { F12_D } from './seed-data-f12-d.js';

/** All 40 published challenges get Java + C++ entry metadata. */
export const F12: Record<string, F12Entry> = { ...F12_A, ...F12_B, ...F12_C, ...F12_D };
