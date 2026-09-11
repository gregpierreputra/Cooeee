import { describe, expect, it } from 'vitest';

import type { FlagStore } from '../../src/core/acknowledgement';
import { KEPT_KEY, KEPT_MAX } from '../../src/core/constants';
import { pruneKept, readKept, toggleKept } from '../../src/core/kept';

const memoryStore = (seed: Record<string, string> = {}): FlagStore => ({
  getItem: (key) => seed[key] ?? null,
  setItem: (key, value) => { seed[key] = value; },
  removeItem: (key) => { delete seed[key]; },
});

describe('kept programs', () => {
  it('reads nothing from an empty, malformed or missing store', () => {
    expect(readKept(null)).toEqual([]);
    expect(readKept(memoryStore())).toEqual([]);
    expect(readKept(memoryStore({ [KEPT_KEY]: '{not json' }))).toEqual([]);
    expect(readKept(memoryStore({ [KEPT_KEY]: '[1, "a"]' }))).toEqual(['a']);
  });

  it('keeps, releases and caps, and the store holds what the screen shows', () => {
    const store = memoryStore();
    const kept = toggleKept(store, [], 'a');
    expect(kept).toEqual(['a']);
    expect(readKept(store)).toEqual(['a']);
    expect(toggleKept(store, kept, 'a')).toEqual([]);
    const full = Array.from({ length: KEPT_MAX }, (_, i) => `p${i}`);
    expect(toggleKept(store, full, 'new')).toEqual([...full.slice(1), 'new']);
  });

  it('drops the ids a new snapshot no longer holds', () => {
    const store = memoryStore({ [KEPT_KEY]: '["a", "gone"]' });
    pruneKept(store, ['a', 'b']);
    expect(readKept(store)).toEqual(['a']);
  });
});
