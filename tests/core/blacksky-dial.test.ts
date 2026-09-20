import { describe, expect, it } from 'vitest';
import { deriveState, type Confidence, type Placed, type Screen } from '../../src/core/blacksky';
import {
  dialCentre,
  dialModel,
  freshHeading,
  headingSource,
  positionTrust,
  relativeBearing,
  splitSiteName,
} from '../../src/core/blacksky-dial';
import {
  ACCURACY_MAX_M,
  COMPASS_SILENT_MS,
  FIX_STALE_MS,
  HEADING_FROM_MOVEMENT_MPS,
} from '../../src/core/constants';
import type { Fix, PackWithPlaces } from '../../src/core/types';
import { KALORAMA, destination, nspSite, nspSnapshot, pack } from '../fixtures';

const NOW = 1_800_000_000_000;
const km = (n: number) => ({ lat: KALORAMA.lat + n / 111.195, lon: KALORAMA.lon });
const fix = (over: Partial<Fix> = {}): Fix => ({ ...KALORAMA, accuracyM: 10, at: NOW, ...over });

// Two chosen places at 2 km and 3 km, and a state-wide list whose nearest site
// is only 1 km away: nearer than anything the person chose.
const chosenNear = destination({ id: 'pack-1:nsp-near', name: 'Chosen near', chosen: true, ...km(2) });
const chosenFar = destination({ id: 'pack-1:nsp-far', name: 'Chosen far', chosen: true, ...km(-3) });
const saved: PackWithPlaces = {
  pack: pack(),
  places: [chosenFar, chosenNear],
  notes: [],
  placesVerified: true,
};
const sites = nspSnapshot({
  sites: [
    nspSite({ id: 'nsp-1km', name: 'Listed 1 km', ...km(1) }),
    nspSite({ id: 'nsp-4km', name: 'Listed 4 km', ...km(4) }),
    nspSite({ id: 'nsp-5km', name: 'Listed 5 km', ...km(-5) }),
  ],
});

const inArea = () => deriveState(NOW, [saved], fix(), 'granted', sites);
const ids = (places: Placed[]) => places.map((place) => place.id);

describe('which place is first', () => {
  it('inside the pack area, the nearest chosen place beats a nearer state-wide site', () => {
    const model = dialModel(inArea(), null)!;
    expect(model.first.id).toBe('pack-1:nsp-near');
    expect(model.label).toBe('chosen');
    // Every other place, chosen or listed, folded together nearest first.
    expect(ids(model.others)).toEqual(['nsp-1km', 'pack-1:nsp-far', 'nsp-4km', 'nsp-5km']);
  });

  it('with no pack, the nearest state-wide site is first', () => {
    const model = dialModel(deriveState(NOW, [], fix(), 'granted', sites), null)!;
    expect(model.first.id).toBe('nsp-1km');
    expect(model.label).toBe('nearest');
    expect(ids(model.others)).toEqual(['nsp-4km', 'nsp-5km']);
  });

  it('outside the pack area, the chosen places are not pointed at and the nearest site is first', () => {
    const screen = deriveState(NOW, [saved], fix(km(40)), 'granted', sites);
    expect(screen.kind).toBe('OUT_OF_AREA');
    const model = dialModel(screen, null)!;
    expect(model.label).toBe('nearest');
    expect(ids([model.first, ...model.others]).some((id) => id.startsWith('pack-1:'))).toBe(false);
  });

  it('inside the area with no chosen place that can be pointed at, the nearest site is first', () => {
    const empty: PackWithPlaces = { ...saved, places: [] };
    const model = dialModel(deriveState(NOW, [empty], fix(), 'granted', sites), null)!;
    expect(model.first.id).toBe('nsp-1km');
    expect(model.label).toBe('nearest');
  });

  it('a place picked with Show becomes first, and stays first as the position moves', () => {
    const picked = dialModel(inArea(), 'pack-1:nsp-far')!;
    expect(picked.first.id).toBe('pack-1:nsp-far');
    expect(picked.label).toBe('chosen');
    expect(ids(picked.others)).toEqual(['nsp-1km', 'pack-1:nsp-near', 'nsp-4km', 'nsp-5km']);

    // A later fix that makes the other chosen place nearer still does not
    // change the subject by itself.
    const moved = deriveState(NOW + 5_000, [saved], fix(km(1.5)), 'granted', sites);
    expect(dialModel(moved, 'pack-1:nsp-far')!.first.id).toBe('pack-1:nsp-far');
  });

  it('a picked state-wide site that is not the nearest one is not called nearest', () => {
    expect(dialModel(inArea(), 'nsp-4km')!.label).toBe('listed');
    expect(dialModel(inArea(), 'nsp-1km')!.label).toBe('nearest');
  });

  it('a picked id that has vanished falls back to the first-place rule', () => {
    const model = dialModel(inArea(), 'pack-9:gone')!;
    expect(model.first.id).toBe('pack-1:nsp-near');
    expect(model.label).toBe('chosen');
  });

  it('has no subject without a position, or with nothing to point at', () => {
    expect(dialModel(deriveState(NOW, [saved], null, 'granted', sites), null)).toBeNull();
    expect(dialModel(deriveState(NOW, [], fix(), 'granted', null), null)).toBeNull();
    const noPlaces: Screen = { ...(inArea() as Extract<Screen, { kind: 'IN_AREA' }>), places: [], nearby: [] };
    expect(dialModel(noPlaces, null)).toBeNull();
  });
});

describe('name split', () => {
  it('puts the bracketed site first and the suburb second', () => {
    expect(splitSiteName('Dederang (Community Hall) Neighbourhood Safer Place')).toEqual({
      site: 'Community Hall',
      suburb: 'Dederang',
    });
  });

  it('splits on the outermost brackets when the site name has its own', () => {
    expect(
      splitSiteName(
        'Darley (Darley Civic and Community Hub (Former Secondary School Campus) Oval) Neighbourhood Safer Place',
      ),
    ).toEqual({
      site: 'Darley Civic and Community Hub (Former Secondary School Campus) Oval',
      suburb: 'Darley',
    });
    expect(splitSiteName('Wallan (Hadfield Park (outdoors area)) Neighbourhood Safer Place')).toEqual({
      site: 'Hadfield Park (outdoors area)',
      suburb: 'Wallan',
    });
  });

  it('shows a name with no brackets whole', () => {
    expect(splitSiteName(' Olinda Recreation Reserve ')).toEqual({
      site: 'Olinda Recreation Reserve',
      suburb: null,
    });
  });

  it('shows a name that cannot be split whole', () => {
    for (const name of ['Darley (Oval', '(Community Hall) Neighbourhood Safer Place', 'Gordon () Hall'])
      expect(splitSiteName(name)).toEqual({ site: name, suburb: null });
  });
});

describe('heading source', () => {
  const kmh = (n: number) => n / 3.6;

  it('the threshold is 10 km/h', () => {
    expect(HEADING_FROM_MOVEMENT_MPS).toBeCloseTo(2.7778, 4);
  });

  it('at 9.9 km/h the compass drives the dial', () => {
    expect(headingSource(40, 200, kmh(9.9))).toEqual({ from: 'compass', deg: 40 });
  });

  it('at 10.1 km/h with a GPS heading, movement drives the dial', () => {
    expect(headingSource(40, 200, kmh(10.1))).toEqual({ from: 'movement', deg: 200 });
  });

  it('exactly at the threshold the compass still drives', () => {
    expect(headingSource(40, 200, HEADING_FROM_MOVEMENT_MPS)).toEqual({ from: 'compass', deg: 40 });
  });

  it('a fast phone with no GPS heading stays on the compass', () => {
    expect(headingSource(40, null, kmh(60))).toEqual({ from: 'compass', deg: 40 });
    expect(headingSource(40, undefined, kmh(60))).toEqual({ from: 'compass', deg: 40 });
    // A phone that is not moving reports NaN, which is no reading.
    expect(headingSource(40, Number.NaN, kmh(60))).toEqual({ from: 'compass', deg: 40 });
    expect(headingSource(40, 200, null)).toEqual({ from: 'compass', deg: 40 });
  });

  it('movement turns the dial when there is no compass at all', () => {
    expect(headingSource(null, 200, kmh(60))).toEqual({ from: 'movement', deg: 200 });
  });

  it('with neither reading nothing turns the dial', () => {
    expect(headingSource(null, null, null)).toEqual({ from: 'none', deg: null });
    expect(headingSource(null, 200, kmh(5))).toEqual({ from: 'none', deg: null });
  });
});

describe('silent sensor', () => {
  it('a reading counts until COMPASS_SILENT_MS has passed, inclusive', () => {
    expect(COMPASS_SILENT_MS).toBe(3_000);
    const reading = { deg: 123, at: NOW };
    expect(freshHeading(reading, NOW)).toBe(123);
    expect(freshHeading(reading, NOW + COMPASS_SILENT_MS)).toBe(123);
    expect(freshHeading(reading, NOW + COMPASS_SILENT_MS + 1)).toBeNull();
    expect(freshHeading(null, NOW)).toBeNull();
  });
});

describe('relative bearing', () => {
  it('is the bearing seen from the top of the phone', () => {
    expect(relativeBearing(90, 0)).toBe(90);
    expect(relativeBearing(90, 90)).toBe(0);
    expect(relativeBearing(0, 90)).toBe(270);
  });

  it('wraps at 0 and 360', () => {
    expect(relativeBearing(10, 350)).toBe(20);
    expect(relativeBearing(350, 10)).toBe(340);
    expect(relativeBearing(0, 360)).toBe(0);
    expect(relativeBearing(360, 0)).toBe(0);
    expect(relativeBearing(725, -10)).toBe(15);
  });
});

describe('how far the position is trusted', () => {
  const confidence = (over: Partial<Confidence> = {}): Confidence => ({
    accuracyM: 10,
    ageS: 0,
    approximate: false,
    stale: false,
    ...over,
  });
  const at = (f: Fix, now = NOW) => {
    const screen = deriveState(now, [saved], f, 'granted', sites);
    if (screen.kind !== 'IN_AREA') throw new Error(screen.kind);
    return positionTrust(screen.confidence, false);
  };

  it('a fresh, accurate fix has no bar and a plain distance', () => {
    expect(at(fix())).toEqual({ bar: null, about: false });
  });

  it('the bar appears past the stale limit, not at it, and goes with a fresh fix', () => {
    expect(at(fix(), NOW + FIX_STALE_MS)).toEqual({ bar: null, about: false });
    expect(at(fix(), NOW + FIX_STALE_MS + 1)).toEqual({ bar: 'stale', about: true });
    expect(at(fix({ at: NOW + FIX_STALE_MS + 1 }), NOW + FIX_STALE_MS + 1)).toEqual({
      bar: null,
      about: false,
    });
  });

  it('a vague fix is prefixed past the accuracy limit, not at it, with no bar while fresh', () => {
    expect(at(fix({ accuracyM: ACCURACY_MAX_M }))).toEqual({ bar: null, about: false });
    expect(at(fix({ accuracyM: ACCURACY_MAX_M + 1 }))).toEqual({ bar: null, about: true });
  });

  it('a position from a mark carries its own bar and is always prefixed', () => {
    expect(positionTrust(confidence(), true)).toEqual({ bar: 'mark', about: true });
  });

  // The arrow always points at the place, so the only thing left to draw
  // differently is how far the position under it can be trusted. There is no
  // dot for north up and no glyph for a mark any more.
  it('draws the arrow solid on a fresh position and hollow on an old or marked one', () => {
    expect(dialCentre(positionTrust(confidence(), false))).toBe('arrow');
    expect(dialCentre(positionTrust(confidence({ approximate: true }), false))).toBe('arrow');
    expect(dialCentre(positionTrust(confidence({ stale: true }), false))).toBe('outline');
    expect(dialCentre(positionTrust(confidence(), true))).toBe('outline');
  });
});
