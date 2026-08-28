import { describe, expect, it } from 'vitest';
import { NO_DESTINATION_PUBLISHED } from '../../src/core/copy';
import {
  absenceRow,
  chooseRules,
  ordinalLabel,
  orderByDistance,
} from '../../src/core/destination';
import { KALORAMA, destination, source } from '../fixtures';

const at = (km: number, id: string) =>
  destination({ id, name: id, lat: KALORAMA.lat + km / 111.195, lon: KALORAMA.lon });

describe('orderByDistance', () => {
  it('orders strictly ascending and numbers the display order from zero', () => {
    const { ordered } = orderByDistance([at(3, 'c'), at(1, 'a'), at(2, 'b')], KALORAMA);
    expect(ordered.map((d) => d.id)).toEqual(['a', 'b', 'c']);
    expect(ordered.map((d) => d.distanceOrder)).toEqual([0, 1, 2]);
    expect(ordered[0].distanceM!).toBeLessThan(ordered[1].distanceM!);
    expect(ordered[1].distanceM!).toBeLessThan(ordered[2].distanceM!);
  });

  it('returns un-geocoded sites separately — never sorted in, never dropped', () => {
    const nowhere = destination({ id: 'x', geocode: 'none', lat: undefined, lon: undefined });
    const { ordered, ungeocoded } = orderByDistance([at(1, 'a'), nowhere], KALORAMA);
    expect(ordered.map((d) => d.id)).toEqual(['a']);
    expect(ungeocoded.map((d) => d.id)).toEqual(['x']);
    expect(ungeocoded[0].distanceM).toBeUndefined();
    expect(ungeocoded[0].distanceOrder).toBeUndefined();
  });

  it('handles an empty list without inventing a row', () => {
    expect(orderByDistance([], KALORAMA)).toEqual({ ordered: [], ungeocoded: [] });
  });

  it('does not mutate its input', () => {
    const sites = [at(2, 'b'), at(1, 'a')];
    orderByDistance(sites, KALORAMA);
    expect(sites.map((d) => d.id)).toEqual(['b', 'a']);
    expect(sites[0].distanceM).toBeUndefined();
  });
});

describe('ordinalLabel', () => {
  it('labels the first three positions and stops', () => {
    expect(ordinalLabel(0)).toBe('nearest');
    expect(ordinalLabel(1)).toBe('second nearest');
    expect(ordinalLabel(2)).toBe('third nearest');
    expect(ordinalLabel(3)).toBeUndefined();
  });

  it('never returns a superlative of worth', () => {
    for (let i = 0; i < 10; i++) {
      expect(ordinalLabel(i) ?? '').not.toMatch(/best|safest|recommended/i);
    }
  });
});

describe('chooseRules', () => {
  it('starts with nothing selected and adds the first choice', () => {
    expect(chooseRules([], 'a')).toEqual(['a']);
  });

  it('allows a second, because both places are equals', () => {
    expect(chooseRules(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('refuses a third and says so by returning null rather than dropping the tap', () => {
    expect(chooseRules(['a', 'b'], 'c')).toBeNull();
  });

  it('toggles an existing choice off', () => {
    expect(chooseRules(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('does not mutate the current selection', () => {
    const chosen = ['a'];
    chooseRules(chosen, 'b');
    expect(chosen).toEqual(['a']);
  });
});

describe('absenceRow', () => {
  const row = absenceRow('pack-1', 'Yarra Ranges', source());

  it('is a real row, not an empty array', () => {
    expect(row.kind).toBe('absence');
    expect(row.id).toBe('pack-1:absence');
    expect(row.packId).toBe('pack-1');
  });

  it('carries the mandated line and the area it applies to', () => {
    expect(row.reason).toContain(NO_DESTINATION_PUBLISHED);
    expect(row.reason).toContain('Yarra Ranges');
  });

  it('carries the caller’s source — core never invents provenance', () => {
    expect(row.source).toEqual(source());
    expect(row.source.licence).not.toBe('');
  });

  it('has no coordinates, so nothing can draw a direction to it', () => {
    expect(row.lat).toBeUndefined();
    expect(row.lon).toBeUndefined();
    expect(row.chosen).toBeUndefined();
  });
});
