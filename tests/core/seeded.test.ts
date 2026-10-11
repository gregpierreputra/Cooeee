import { describe, expect, it } from 'vitest';
import { cyclePick, mulberry32, seededShuffle, seedFrom } from '../../src/core/seeded';

describe('the seeded random source', () => {
  it('gives the same run for the same seed, and a different one for another', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);
    const runA = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(runA);
    expect([c(), c(), c()]).not.toEqual(runA);
    for (const value of runA) expect(value >= 0 && value < 1).toBe(true);
  });

  it('spreads its numbers evenly enough', () => {
    const random = mulberry32(7);
    const buckets = Array.from({ length: 10 }, () => 0);
    for (let i = 0; i < 10_000; i++) buckets[Math.floor(random() * 10)] += 1;
    for (const count of buckets) expect(count).toBeGreaterThan(850);
  });

  it('mixes words and numbers into one seed', () => {
    expect(seedFrom('a', 1)).toBe(seedFrom('a', 1));
    expect(seedFrom('a', 1)).not.toBe(seedFrom('a', 2));
    expect(seedFrom('a', 12)).not.toBe(seedFrom('a1', 2));
  });

  it('shuffles a copy, keeping every item once', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const shuffled = seededShuffle(items, 9);
    expect(items).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
    expect(shuffled).toEqual(seededShuffle(items, 9));
    expect(shuffled).not.toEqual(items);
  });
});

describe('picking through cycles', () => {
  it('shows every thing once in each cycle', () => {
    for (const cycle of [0, 1, 5, -1]) {
      const picks = Array.from({ length: 40 }, (_, i) => cyclePick(cycle * 40 + i, 40, 'test'));
      expect(new Set(picks).size).toBe(40);
    }
  });

  it('never shows the same thing twice running across a cycle edge', () => {
    for (let cycle = -5; cycle < 30; cycle++) {
      const last = cyclePick(cycle * 40 + 39, 40, 'test');
      const first = cyclePick((cycle + 1) * 40, 40, 'test');
      expect(first).not.toBe(last);
    }
  });

  it('orders each cycle afresh, and differently for another salt', () => {
    const cycle = (n: number, salt: string) => Array.from({ length: 40 }, (_, i) => cyclePick(n * 40 + i, 40, salt));
    expect(cycle(0, 'test')).not.toEqual(cycle(1, 'test'));
    expect(cycle(0, 'test')).not.toEqual(cycle(0, 'other'));
  });

  it('copes with one or two things', () => {
    expect(cyclePick(5, 1, 'x')).toBe(0);
    expect(new Set([cyclePick(0, 2, 'x'), cyclePick(1, 2, 'x')])).toEqual(new Set([0, 1]));
  });
});
