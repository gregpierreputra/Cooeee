import { describe, expect, it } from 'vitest';
import { GATE_KEY } from '../../src/core/constants';
import { readGate, writeGate } from '../../src/core/gate';

const memoryStore = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
};

describe('the gate flag on this device', () => {
  it('is not passed until it is written, and any other value is not a pass', () => {
    const store = memoryStore();
    expect(readGate(store)).toBe(false);
    store.setItem(GATE_KEY, 'yes');
    expect(readGate(store)).toBe(false);
    expect(writeGate(store)).toBe(true);
    expect(readGate(store)).toBe(true);
  });

  it('reads as not passed, and writes as not kept, when there is no store', () => {
    expect(readGate(null)).toBe(false);
    expect(writeGate(null)).toBe(false);
  });
});
