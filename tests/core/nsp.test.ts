import { describe, expect, it } from 'vitest';

import { distanceM } from '../../src/core/geo';
import {
  destinationsForPack,
  formatIsoDateShort,
  nspListDateLabel,
  sameLga,
  selectSitesForPack,
  toDestination,
} from '../../src/core/nsp';
import { hasCompleteSource } from '../../src/core/provenance';
import { KALORAMA, destination, nspSite, nspSnapshot, source } from '../fixtures';

describe('sameLga', () => {
  it('matches a bare lgaName to the "Shire" form, ignoring case', () => {
    expect(sameLga('Yarra Ranges Shire', 'YARRA RANGES')).toBe(true);
  });

  it('matches the "City of X" and "X City" forms to the bare name', () => {
    expect(sameLga('City of Casey', 'CASEY')).toBe(true);
    expect(sameLga('Casey City', 'CASEY')).toBe(true);
  });

  it('does not match two different councils', () => {
    expect(sameLga('Murrindindi Shire', 'YARRA RANGES')).toBe(false);
  });

  it('is false for an empty municipality rather than matching an empty lgaName', () => {
    expect(sameLga('', '')).toBe(false);
    expect(sameLga('   ', 'YARRA RANGES')).toBe(false);
  });
});

describe('selectSitesForPack', () => {
  const lga = 'YARRA RANGES';
  const near = { lat: KALORAMA.lat + 0.01, lon: KALORAMA.lon }; // ~1.1 km
  const far = { lat: KALORAMA.lat + 0.1, lon: KALORAMA.lon }; // ~11 km

  it('includes a located site inside the radius and excludes one beyond it', () => {
    const sites = [
      nspSite({ id: 'in', ...near }),
      nspSite({ id: 'out', ...far }),
    ];
    const { located } = selectSitesForPack(sites, KALORAMA, lga, 6);
    expect(located.map((s) => s.id)).toEqual(['in']);
  });

  it('treats a site exactly on the radius as inside (inclusive)', () => {
    const site = nspSite({ id: 'edge', lat: KALORAMA.lat + 0.04, lon: KALORAMA.lon + 0.02 });
    const exactKm = distanceM(KALORAMA, { lat: site.lat!, lon: site.lon! }) / 1000;
    expect(selectSitesForPack([site], KALORAMA, lga, exactKm).located.map((s) => s.id)).toEqual([
      'edge',
    ]);
    expect(selectSitesForPack([site], KALORAMA, lga, exactKm - 1e-9).located).toEqual([]);
  });

  it("counts a 'township' geocode as located", () => {
    const site = nspSite({ id: 't', geocode: 'township', ...near });
    expect(selectSitesForPack([site], KALORAMA, lga, 6).located.map((s) => s.id)).toEqual(['t']);
  });

  it('does not count a site with a missing coordinate as located', () => {
    const site = nspSite({ id: 'nocoord', geocode: 'street', lat: undefined, lon: undefined });
    const { located, unlocated } = selectSitesForPack([site], KALORAMA, lga, 6);
    expect(located).toEqual([]);
    expect(unlocated.map((s) => s.id)).toEqual(['nocoord']); // same LGA, so still retained
  });

  it("retains an un-located site whose council is the pack's LGA", () => {
    const site = nspSite({ id: 'u', geocode: 'none', lat: undefined, lon: undefined });
    const { located, unlocated } = selectSitesForPack([site], KALORAMA, lga, 6);
    expect(located).toEqual([]);
    expect(unlocated.map((s) => s.id)).toEqual(['u']);
  });

  it('excludes an un-located site from another LGA — no substitute from a neighbour', () => {
    const site = nspSite({
      id: 'other',
      municipality: 'Murrindindi Shire',
      geocode: 'none',
      lat: undefined,
      lon: undefined,
    });
    expect(selectSitesForPack([site], KALORAMA, lga, 6).unlocated).toEqual([]);
  });

  it('returns empty arrays for no matches without inventing a row', () => {
    expect(selectSitesForPack([], KALORAMA, lga, 6)).toEqual({ located: [], unlocated: [] });
    expect(selectSitesForPack([nspSite({ ...far })], KALORAMA, lga, 6)).toEqual({
      located: [],
      unlocated: [],
    });
  });

  it('does not widen the radius when the in-range result is empty', () => {
    const site = nspSite({ id: 'just-out', lat: KALORAMA.lat + 0.07, lon: KALORAMA.lon }); // ~7.8 km
    expect(selectSitesForPack([site], KALORAMA, lga, 6).located).toEqual([]);
  });

  it('does not mutate its input', () => {
    const sites = [nspSite({ id: 'a', ...near }), nspSite({ id: 'b', ...far })];
    const snapshot = JSON.stringify(sites);
    selectSitesForPack(sites, KALORAMA, lga, 6);
    expect(JSON.stringify(sites)).toBe(snapshot);
  });
});

describe('selectSitesForPack — the bushfire-only gate', () => {
  const sites = [
    nspSite({ id: 'a', lat: KALORAMA.lat + 0.01, lon: KALORAMA.lon }),
    nspSite({ id: 'b', geocode: 'none', lat: undefined, lon: undefined }),
  ];

  it('returns nothing for a flood pack, whatever the snapshot holds', () => {
    expect(selectSitesForPack(sites, KALORAMA, 'YARRA RANGES', 6, 'flood')).toEqual({
      located: [],
      unlocated: [],
    });
  });

  it('returns nothing for a heat pack', () => {
    expect(selectSitesForPack(sites, KALORAMA, 'YARRA RANGES', 6, 'heat')).toEqual({
      located: [],
      unlocated: [],
    });
  });

  it('is identical for an explicit bushfire hazard and an omitted one', () => {
    const explicit = selectSitesForPack(sites, KALORAMA, 'YARRA RANGES', 6, 'bushfire');
    expect(explicit).toEqual(selectSitesForPack(sites, KALORAMA, 'YARRA RANGES', 6));
    expect(explicit.located.map((s) => s.id)).toEqual(['a']);
    expect(explicit.unlocated.map((s) => s.id)).toEqual(['b']);
  });
});

describe('toDestination', () => {
  const snap = nspSnapshot();

  it('maps municipality to council and always sets kind nsp-bushfire', () => {
    const d = toDestination(nspSite(), 'pack-9', snap);
    expect(d.kind).toBe('nsp-bushfire');
    expect(d.council).toBe('Yarra Ranges Shire');
  });

  it("copies the snapshot's listAsAt and attaches its Source", () => {
    const d = toDestination(nspSite(), 'pack-9', snap);
    expect(d.listAsAt).toBe('2026-08-18');
    expect(d.source).toEqual(source());
  });

  it('builds the id as `${packId}:${site.id}`', () => {
    expect(toDestination(nspSite({ id: 'nsp-x' }), 'pack-9', snap).id).toBe('pack-9:nsp-x');
  });

  it('passes through geocode, lat and lon for a located site', () => {
    const d = toDestination(nspSite({ geocode: 'exact' }), 'pack-9', snap);
    expect(d.geocode).toBe('exact');
    expect(d.lat).toBe(KALORAMA.lat);
    expect(d.lon).toBe(KALORAMA.lon);
  });

  it("omits lat, lon and distanceM for a geocode:'none' site", () => {
    const d = toDestination(
      nspSite({ geocode: 'none', lat: undefined, lon: undefined }),
      'pack-9',
      snap,
    );
    expect(d.lat).toBeUndefined();
    expect(d.lon).toBeUndefined();
    expect(d.distanceM).toBeUndefined();
    expect(d.distanceOrder).toBeUndefined();
  });

  it('composes the address from street, sub-location and township', () => {
    const d = toDestination(
      nspSite({ street: 'Reserve Road', subLocation: 'Near the oval', township: 'Belgrave' }),
      'pack-9',
      snap,
    );
    expect(d.addressText).toBe('Reserve Road, Near the oval, Belgrave');
  });

  it('produces a Source that passes the pack builder’s provenance gate', () => {
    expect(hasCompleteSource(toDestination(nspSite(), 'pack-9', snap).source)).toBe(true);
  });

  it('never pre-selects a site', () => {
    expect(toDestination(nspSite(), 'pack-9', snap).chosen).toBeUndefined();
  });
});

describe('formatIsoDateShort', () => {
  it('formats an ISO date as day, short month, year', () => {
    expect(formatIsoDateShort('2026-08-18')).toBe('18 Aug 2026');
  });

  it('throws on anything that is not an ISO date', () => {
    expect(() => formatIsoDateShort('18/08/2026')).toThrow();
    expect(() => formatIsoDateShort('2026-08-18T00:00:00Z')).toThrow();
    expect(() => formatIsoDateShort('')).toThrow();
  });
});

describe('nspListDateLabel', () => {
  it('is the list’s own date, labelled as the list’s date', () => {
    expect(nspListDateLabel('2026-08-18')).toBe('Country Fire Authority state-wide list as at 18 Aug 2026');
  });
});

describe('destinationsForPack', () => {
  const snap = nspSnapshot();
  const nowhere = { geocode: 'none' as const, lat: undefined, lon: undefined };
  const picks = [
    destination({ id: 'pack-9:a', packId: 'pack-9', chosen: true }),
    destination({ id: 'pack-9:b', packId: 'pack-9', chosen: true }),
  ];

  it('writes exactly one absence row when nothing is published for the area', () => {
    const rows = destinationsForPack({ located: [], unlocated: [] }, [], 'pack-9', snap, 'Yarra Ranges');
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('absence');
    expect(rows[0].id).toBe('pack-9:absence');
    expect(rows[0].reason).toBe(
      'No official place of last resort is published for this area — Yarra Ranges.',
    );
  });

  it('the absence row carries the snapshot Source and no coordinates', () => {
    const [row] = destinationsForPack({ located: [], unlocated: [] }, [], 'pack-9', snap, 'Yarra Ranges');
    expect(row.source).toEqual(snap.source);
    expect(row.lat).toBeUndefined();
    expect(row.lon).toBeUndefined();
    expect(row.chosen).toBeUndefined();
  });

  it('returns exactly the chosen rows — never the whole list — when places are published', () => {
    const rows = destinationsForPack(
      { located: [nspSite({ id: 'a' }), nspSite({ id: 'b' }), nspSite({ id: 'c' })], unlocated: [] },
      picks,
      'pack-9',
      snap,
      'Yarra Ranges',
    );
    expect(rows).toBe(picks);
    expect(rows.map((r) => r.kind)).toEqual(['nsp-bushfire', 'nsp-bushfire']);
  });

  it('un-located sites alone still count as published — the chosen rows are returned', () => {
    const rows = destinationsForPack(
      { located: [], unlocated: [nspSite({ id: 'b', ...nowhere })] },
      picks,
      'pack-9',
      snap,
      'Yarra Ranges',
    );
    expect(rows).toBe(picks);
  });

  it('only out-of-area sites: the selection is empty, so an absence is written, no neighbour substituted', () => {
    const snapshot = nspSnapshot({
      sites: [
        nspSite({ id: 'far', name: 'Far Reserve', lat: KALORAMA.lat + 0.1, lon: KALORAMA.lon }),
        nspSite({
          id: 'nbr',
          name: 'Alexandra Showgrounds',
          municipality: 'Murrindindi Shire',
          ...nowhere,
        }),
      ],
    });
    const selection = selectSitesForPack(snapshot.sites, KALORAMA, 'YARRA RANGES', 6);
    const rows = destinationsForPack(selection, [], 'pack-9', snapshot, 'Yarra Ranges');
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('absence');
  });

  it('a flood or heat pack gets no rows at all — not even an absence marker', () => {
    const populated = { located: [nspSite({ id: 'a' })], unlocated: [] };
    expect(destinationsForPack(populated, picks, 'pack-9', snap, 'Yarra Ranges', 'flood')).toEqual([]);
    expect(destinationsForPack({ located: [], unlocated: [] }, [], 'pack-9', snap, 'Yarra Ranges', 'heat')).toEqual([]);
  });
});
