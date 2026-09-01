import { describe, expect, it } from 'vitest';
import { deriveState, estimateFix } from '../../src/core/blacksky';
import {
  ACCURACY_MAX_M,
  FIX_STALE_MS,
  MARK_DRIFT_M_PER_S,
  MARK_START_ACCURACY_M,
} from '../../src/core/constants';
import { distanceM } from '../../src/core/geo';
import type { Destination, Fix, PackWithPlaces } from '../../src/core/types';
import { KALORAMA, destination, pack, source } from '../fixtures';

const NOW = 1_800_000_000_000;

const km = (n: number) => ({ lat: KALORAMA.lat + n / 111.195, lon: KALORAMA.lon });

const fix = (over: Partial<Fix> = {}): Fix => ({
  lat: KALORAMA.lat,
  lon: KALORAMA.lon,
  accuracyM: 10,
  at: NOW,
  ...over,
});

const north = destination({ id: 'north', name: 'North', chosen: true, ...km(2) });
const south = destination({ id: 'south', name: 'South', chosen: true, ...km(-2) });
const unchosen = destination({ id: 'other', name: 'Other', ...km(1) });

const kalorama = (places: Destination[] = [north, south]): PackWithPlaces => ({
  pack: pack(),
  places,
});

const faraway: PackWithPlaces = {
  pack: pack({ id: 'pack-2', name: 'Elsewhere', ...km(40) }),
  places: [],
};

describe('precedence', () => {
  it('1 — NO_PACK wins over everything, even a perfect fix', () => {
    expect(deriveState(NOW, [], fix(), 'granted')).toEqual({ kind: 'NO_PACK' });
  });

  it('2 — a denied permission is ACQUIRING, even when a fresh accurate fix exists', () => {
    const s = deriveState(NOW, [kalorama()], fix(), 'denied');
    expect(s.kind).toBe('ACQUIRING');
    expect(s.kind === 'ACQUIRING' && s.reason).toBe('denied');
  });

  it('2 — no fix at all is ACQUIRING', () => {
    const s = deriveState(NOW, [kalorama()], null, 'granted');
    expect(s.kind === 'ACQUIRING' && s.reason).toBe('no-fix');
  });

  it('3 — LOW_ACCURACY is decided BEFORE area membership, so a vague fix inside a pack never draws an arrow', () => {
    const s = deriveState(NOW, [kalorama()], fix({ accuracyM: 800 }), 'granted');
    expect(s.kind).toBe('LOW_ACCURACY');
    expect(s.kind === 'LOW_ACCURACY' && s.accuracyM).toBe(800);
  });

  it('2 beats 3 — a stale fix is ACQUIRING even when it is also inaccurate', () => {
    const s = deriveState(
      NOW,
      [kalorama()],
      fix({ at: NOW - FIX_STALE_MS - 1, accuracyM: 800 }),
      'granted',
    );
    expect(s.kind === 'ACQUIRING' && s.reason).toBe('stale');
  });
});

describe('fix staleness boundary', () => {
  it('29 s old is usable', () => {
    expect(deriveState(NOW, [kalorama()], fix({ at: NOW - 29_000 }), 'granted').kind).toBe(
      'IN_AREA',
    );
  });

  it('exactly 30 s old is still usable — the rule is "older than", not "at"', () => {
    expect(FIX_STALE_MS).toBe(30_000);
    expect(deriveState(NOW, [kalorama()], fix({ at: NOW - 30_000 }), 'granted').kind).toBe(
      'IN_AREA',
    );
  });

  it('31 s old is ACQUIRING', () => {
    const s = deriveState(NOW, [kalorama()], fix({ at: NOW - 31_000 }), 'granted');
    expect(s.kind === 'ACQUIRING' && s.reason).toBe('stale');
  });
});

describe('accuracy boundary', () => {
  it('99 m shows the direction', () => {
    expect(deriveState(NOW, [kalorama()], fix({ accuracyM: 99 }), 'granted').kind).toBe(
      'IN_AREA',
    );
  });

  it('exactly 100 m shows the direction — the threshold is inclusive', () => {
    expect(ACCURACY_MAX_M).toBe(100);
    expect(deriveState(NOW, [kalorama()], fix({ accuracyM: 100 }), 'granted').kind).toBe(
      'IN_AREA',
    );
  });

  it('101 m withholds the direction and reports the figure', () => {
    const s = deriveState(NOW, [kalorama()], fix({ accuracyM: 101 }), 'granted');
    expect(s.kind).toBe('LOW_ACCURACY');
    expect(s.kind === 'LOW_ACCURACY' && s.accuracyM).toBe(101);
  });
});

describe('containment', () => {
  const edge = km(6);
  const exactRadiusKm = distanceM(KALORAMA, edge) / 1000;

  it('is INCLUSIVE at exactly the pack radius', () => {
    const p: PackWithPlaces = { pack: pack({ radiusKm: exactRadiusKm }), places: [] };
    expect(deriveState(NOW, [p], fix(edge), 'granted').kind).toBe('IN_AREA');
  });

  it('a metre beyond the radius is outside', () => {
    const p: PackWithPlaces = {
      pack: pack({ radiusKm: exactRadiusKm - 0.001 }),
      places: [],
    };
    expect(deriveState(NOW, [p], fix(edge), 'granted').kind).toBe('OUT_OF_AREA');
  });
});

describe('OUT_OF_AREA', () => {
  // 15 km north: 15 km from the Kalorama pack, 25 km from the far one, so the
  // ordering is unambiguous rather than a coin flip between two equal distances.
  const s = deriveState(NOW, [faraway, kalorama()], fix(km(15)), 'granted');

  it('names every stored pack with the distance to its AREA edge, nearest first', () => {
    expect(s.kind).toBe('OUT_OF_AREA');
    if (s.kind !== 'OUT_OF_AREA') return;
    expect(s.packs.map((p) => p.pack.id)).toEqual(['pack-1', 'pack-2']);
    expect(s.packs[0].distanceKm).toBeLessThan(s.packs[1].distanceKm);
    // 15 km and 25 km from the centres, minus each pack's 6 km radius.
    expect(s.packs[0].distanceKm).toBeCloseTo(9, 0);
    expect(s.packs[1].distanceKm).toBeCloseTo(19, 0);
  });

  it('carries no bearing to an out-of-area point — there is no arrow on this screen', () => {
    expect(s).not.toHaveProperty('places');
  });
});

describe('IN_AREA', () => {
  it('gives each chosen place a true bearing and a live distance', () => {
    const s = deriveState(NOW, [kalorama()], fix(), 'granted');
    if (s.kind !== 'IN_AREA') throw new Error(s.kind);
    expect(s.places).toHaveLength(2);
    expect(s.places[0].bearingDeg).toBeGreaterThanOrEqual(0);
    expect(s.places[0].bearingDeg).toBeLessThan(360);
    expect(s.places[0].distanceM).toBeCloseTo(2000, -2);
  });

  it('re-sorts by LIVE distance as the user moves, so the order swaps', () => {
    const near = deriveState(NOW, [kalorama()], fix(km(1)), 'granted');
    const far = deriveState(NOW, [kalorama()], fix(km(-1)), 'granted');
    if (near.kind !== 'IN_AREA' || far.kind !== 'IN_AREA') throw new Error('expected IN_AREA');
    expect(near.places.map((p) => p.d.id)).toEqual(['north', 'south']);
    expect(far.places.map((p) => p.d.id)).toEqual(['south', 'north']);
  });

  it('shows only the chosen places', () => {
    const s = deriveState(NOW, [kalorama([north, unchosen])], fix(), 'granted');
    if (s.kind !== 'IN_AREA') throw new Error(s.kind);
    expect(s.places.map((p) => p.d.id)).toEqual(['north']);
  });

  it('picks the nearest pack when two contain the fix', () => {
    const overlapping: PackWithPlaces = {
      pack: pack({ id: 'pack-3', name: 'Overlapping', ...km(1) }),
      places: [],
    };
    const s = deriveState(NOW, [kalorama(), overlapping], fix(km(1)), 'granted');
    expect(s.kind === 'IN_AREA' && s.pack.id).toBe('pack-3');
  });
});

describe('absence', () => {
  const absent = destination({
    id: 'pack-1:absence',
    kind: 'absence',
    name: undefined,
    lat: undefined,
    lon: undefined,
    reason: 'No official place of last resort is published for this area — Yarra Ranges.',
    source: source(),
  });

  it('surfaces the absence row on IN_AREA instead of leaving an empty list to interpret', () => {
    const s = deriveState(NOW, [kalorama([absent])], fix(), 'granted');
    if (s.kind !== 'IN_AREA') throw new Error(s.kind);
    expect(s.places).toEqual([]);
    expect(s.absence?.id).toBe('pack-1:absence');
    expect(s.absence?.reason).toContain('No official place of last resort is published');
  });

  it('carries the absence row through ACQUIRING, where there is no fix to place it by', () => {
    const s = deriveState(NOW, [kalorama([absent, north])], null, 'granted');
    if (s.kind !== 'ACQUIRING') throw new Error(s.kind);
    expect(s.places.map((d) => d.id)).toEqual(['pack-1:absence', 'north']);
  });

  it('leaves absence undefined when the pack has real chosen places', () => {
    const s = deriveState(NOW, [kalorama()], fix(), 'granted');
    expect(s.kind === 'IN_AREA' && s.absence).toBeUndefined();
  });
});

// E3-US1-AC4: the marked-position estimate. Its whole safety contract is that
// uncertainty grows and the estimate dies at the same threshold a GPS fix would.
describe('estimateFix', () => {
  const mark = { lat: KALORAMA.lat, lon: KALORAMA.lon, at: NOW };

  it('starts at the marked point with the published starting uncertainty', () => {
    expect(estimateFix(mark, NOW)).toEqual({
      lat: mark.lat,
      lon: mark.lon,
      accuracyM: MARK_START_ACCURACY_M,
      at: NOW,
    });
  });

  it('grows the uncertainty at walking pace', () => {
    const after10s = estimateFix(mark, NOW + 10_000);
    expect(after10s?.accuracyM).toBe(Math.round(MARK_START_ACCURACY_M + 10 * MARK_DRIFT_M_PER_S));
  });

  it('cannot be maintained past the confidence threshold — null, never a vague fix', () => {
    const secondsToThreshold = (ACCURACY_MAX_M - MARK_START_ACCURACY_M) / MARK_DRIFT_M_PER_S;
    const justBefore = estimateFix(mark, NOW + Math.floor(secondsToThreshold) * 1000);
    const wellPast = estimateFix(mark, NOW + Math.ceil(secondsToThreshold + 1) * 1000);
    expect(justBefore?.accuracyM).toBeLessThanOrEqual(ACCURACY_MAX_M);
    expect(wellPast).toBeNull();
  });

  it('is never stale: the returned fix carries the caller clock', () => {
    expect(estimateFix(mark, NOW + 20_000)?.at).toBe(NOW + 20_000);
  });
});
