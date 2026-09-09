import { describe, expect, it } from 'vitest';
import { conditionsAt, noticeView, pointInRing } from '../../src/core/conditions';
import * as copy from '../../src/core/copy';
import type { Condition } from '../../src/core/types';
import { KALORAMA } from '../fixtures';

const NOW = Date.UTC(2026, 8, 2, 6);
const ago = (ms: number): string => new Date(NOW - ms).toISOString();
// A square of the Dandenongs holding Kalorama.
const SQUARE = [
  { lat: -37.7, lon: 145.3 },
  { lat: -37.7, lon: 145.4 },
  { lat: -37.9, lon: 145.4 },
  { lat: -37.9, lon: 145.3 },
];
const condition = (over: Partial<Condition> = {}): Condition => ({
  condition_id: 'h1',
  hazard: 'heat',
  title: 'Heatwave Warning',
  publisher: 'Bureau of Meteorology',
  statewide: false,
  rings: [SQUARE],
  source_updated_at: ago(60_000),
  ...over,
});
const meta = (feedAgeMs: number) => ({ dynamic_synced_at: ago(feedAgeMs), dynamic_source_last_success_at: ago(feedAgeMs) });

describe('pointInRing', () => {
  it('is true inside, false outside and false for a degenerate ring', () => {
    expect(pointInRing(KALORAMA, SQUARE)).toBe(true);
    expect(pointInRing({ lat: -37.0, lon: 145.0 }, SQUARE)).toBe(false);
    expect(pointInRing(KALORAMA, SQUARE.slice(0, 2))).toBe(false);
  });
});

describe('conditionsAt', () => {
  it('keeps a notice whose area holds the point, and every statewide one', () => {
    const melbourne = condition({ condition_id: 'm', rings: [[{ lat: -37.7, lon: 144.9 }, { lat: -37.7, lon: 145.0 }, { lat: -37.9, lon: 144.9 }]] });
    const statewide = condition({ condition_id: 's', statewide: true, rings: [] });
    expect(conditionsAt(KALORAMA, [condition(), melbourne, statewide]).map((c) => c.condition_id)).toEqual(['h1', 's']);
  });
});

describe('noticeView', () => {
  it('lists the matching notices with the feed time', () => {
    const view = noticeView(NOW, { conditions: [condition()], meta: meta(10 * 60_000) }, KALORAMA);
    expect(view?.lines).toEqual([copy.NOTICE_LINE('Heatwave Warning', 'Bureau of Meteorology')]);
    expect(view?.asOf).toBe(copy.AS_OF('3:50 pm, 2 September'));
  });

  it('says none apply with a fresh snapshot, and nothing at all with a stale or missing one', () => {
    expect(noticeView(NOW, { conditions: [], meta: meta(10 * 60_000) }, KALORAMA)?.lines).toEqual([]);
    expect(noticeView(NOW, { conditions: [condition()], meta: meta(61 * 60_000) }, KALORAMA)).toBeNull();
    expect(noticeView(NOW, { conditions: [condition()], meta: {} }, KALORAMA)).toBeNull();
  });
});
