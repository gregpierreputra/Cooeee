import { describe, expect, it } from 'vitest';
import { RETRY_SCHEDULE_MS } from '../../src/core/constants';
import { diffSnapshot, matchNeeds, nextRetryDelay } from '../../src/core/recovery';
import { program } from '../fixtures';

const money = program({ id: 'a', needs: ['money'] });
const stayFood = program({ id: 'b', needs: ['stay', 'food'] });
const health = program({ id: 'c', needs: ['health'] });

describe('matchNeeds', () => {
  it('returns the union across the selected needs, in snapshot order', () => {
    expect(matchNeeds([money, stayFood, health], ['money', 'food']).map((p) => p.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('deduplicates a program that matches on two needs at once', () => {
    expect(matchNeeds([stayFood], ['stay', 'food']).map((p) => p.id)).toEqual(['b']);
  });

  it('returns an HONEST empty result rather than a near match', () => {
    expect(matchNeeds([money, stayFood], ['documents'])).toEqual([]);
  });

  it('returns nothing when nothing is selected', () => {
    expect(matchNeeds([money, stayFood, health], [])).toEqual([]);
  });

  it('handles an empty snapshot', () => {
    expect(matchNeeds([], ['money'])).toEqual([]);
  });
});

describe('diffSnapshot', () => {
  it('sees an addition', () => {
    expect(diffSnapshot([money], [money, health])).toEqual({
      added: ['c'],
      removed: [],
      changed: [],
    });
  });

  it('sees a removal — a program that is gone must not silently vanish', () => {
    expect(diffSnapshot([money, health], [money])).toEqual({
      added: [],
      removed: ['c'],
      changed: [],
    });
  });

  it('sees a changed user-visible field', () => {
    const renamed = program({ id: 'a', needs: ['money'], title: 'Renamed payment' });
    expect(diffSnapshot([money], [renamed]).changed).toEqual(['a']);
  });

  it('sees a changed needs list', () => {
    const rescoped = program({ id: 'a', needs: ['money', 'food'] });
    expect(diffSnapshot([money], [rescoped]).changed).toEqual(['a']);
  });

  it('reports no change when nothing a reader would notice moved', () => {
    expect(diffSnapshot([money], [program({ id: 'a', needs: ['money'] })])).toEqual({
      added: [],
      removed: [],
      changed: [],
    });
  });

  it('handles a first run against an empty live set', () => {
    expect(diffSnapshot([], [money, health])).toEqual({
      added: ['a', 'c'],
      removed: [],
      changed: [],
    });
  });
});

describe('nextRetryDelay', () => {
  it('follows the published schedule', () => {
    expect(RETRY_SCHEDULE_MS).toEqual([0, 30_000, 300_000]);
    expect(nextRetryDelay(0)).toBe(0);
    expect(nextRetryDelay(1)).toBe(30_000);
    expect(nextRetryDelay(2)).toBe(300_000);
  });

  it('stops rather than retrying forever, so a manual check can be offered instead', () => {
    expect(nextRetryDelay(3)).toBeNull();
    expect(nextRetryDelay(99)).toBeNull();
  });
});
