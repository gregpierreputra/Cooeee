import { describe, expect, it } from 'vitest';
import type { FlagStore } from '../../src/core/acknowledgement';
import { LAST_VISIT_KEY } from '../../src/core/constants';
import { backAfterAWeek, recordVisit } from '../../src/core/visits';

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

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 15, 9);

describe('back after a week', () => {
  it('asks only once seven or more days have passed since the last visit', () => {
    const store = memoryStore();
    recordVisit(store, now - 7 * DAY);
    expect(backAfterAWeek(store, now)).toBe(true);
    recordVisit(store, now - 6 * DAY);
    expect(backAfterAWeek(store, now)).toBe(false);
  });

  it('never asks on a first visit, an odd value or a store that throws', () => {
    const store = memoryStore();
    expect(backAfterAWeek(store, now)).toBe(false);
    store.setItem(LAST_VISIT_KEY, 'yesterday');
    expect(backAfterAWeek(store, now)).toBe(false);
    const throwing = { ...store, getItem: () => { throw new DOMException('blocked'); } };
    expect(backAfterAWeek(throwing, now)).toBe(false);
    expect(backAfterAWeek(null, now)).toBe(false);
  });

  it('keeps the day alone, nothing finer', () => {
    const store = memoryStore();
    recordVisit(store, now);
    expect(store.getItem(LAST_VISIT_KEY)).toBe(String(Math.floor(now / DAY)));
  });
});
