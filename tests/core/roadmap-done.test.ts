import { describe, expect, it } from 'vitest';
import type { FlagStore } from '../../src/core/acknowledgement';
import { ROADMAP_DONE_KEY } from '../../src/core/constants';
import { NEED_PHRASE, ROADMAP_STAGES } from '../../src/core/copy';
import { readDone, toggleDone } from '../../src/core/roadmap-done';

const memoryStore = (seed: Record<string, string> = {}): FlagStore => ({
  getItem: (key) => seed[key] ?? null,
  setItem: (key, value) => { seed[key] = value; },
  removeItem: (key) => { delete seed[key]; },
});

describe('recovery roadmap ticks', () => {
  it('reads nothing from an empty or malformed store, and drops unknown ids', () => {
    expect(readDone(null)).toEqual([]);
    expect(readDone(memoryStore({ [ROADMAP_DONE_KEY]: '{not json' }))).toEqual([]);
    expect(readDone(memoryStore({ [ROADMAP_DONE_KEY]: '["insurer", "made-up", 3]' }))).toEqual(['insurer']);
  });

  it('ticks and unticks a step, and keeps the ticks on the phone', () => {
    const store = memoryStore();
    const done = toggleDone(store, [], 'insurer');
    expect(readDone(store)).toEqual(['insurer']);
    expect(toggleDone(store, done, 'insurer')).toEqual([]);
    expect(readDone(store)).toEqual([]);
  });

  it('gives every step a unique id and links only to needs Recover offers', () => {
    const steps = ROADMAP_STAGES.flatMap((stage) => stage.steps);
    expect(new Set(steps.map((step) => step.id)).size).toBe(steps.length);
    for (const { link } of steps) {
      if (link && !['calls', 'nearby', 'redcross'].includes(link)) expect(NEED_PHRASE).toHaveProperty(link);
    }
  });
});
