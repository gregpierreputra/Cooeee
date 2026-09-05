import { describe, expect, it } from 'vitest';
import type { FlagStore } from '../../src/core/acknowledgement';
import { isBlackSkyLatched, latchBlackSky, unlatchBlackSky } from '../../src/core/blacksky-latch';

function memoryStore(): FlagStore {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

const throwingStore: FlagStore = {
  getItem: () => {
    throw new DOMException('site data is blocked');
  },
  setItem: () => {
    throw new DOMException('site data is blocked');
  },
  removeItem: () => {
    throw new DOMException('site data is blocked');
  },
};

describe('the BlackSky latch', () => {
  it('is set by opening the screen and cleared by leaving it', () => {
    const store = memoryStore();
    expect(isBlackSkyLatched(store)).toBe(false);
    latchBlackSky(store);
    expect(isBlackSkyLatched(store)).toBe(true);
    unlatchBlackSky(store);
    expect(isBlackSkyLatched(store)).toBe(false);
  });

  it('reads as not latched when storage is missing or blocked', () => {
    expect(isBlackSkyLatched(null)).toBe(false);
    latchBlackSky(throwingStore);
    expect(isBlackSkyLatched(throwingStore)).toBe(false);
  });
});
