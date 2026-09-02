import { describe, expect, it } from 'vitest';
import { openDb } from '../../server/db';
import { findNearest, haversineKm } from '../../server/geo';
import { upsertFacilities } from '../../server/ingest/static';

const GPO = { lat: -37.8136, lon: 144.9631 };
// Reference figures computed independently of this code (python3 haversine,
// R = 6371.0088 km), so a wrong formula fails here rather than on a screen.
const GEELONG = { lat: -38.1499, lon: 144.3617 };
const GPO_TO_GEELONG_KM = 64.627;
const BALLARAT = { lat: -37.5622, lon: 143.8503 };
const GPO_TO_BALLARAT_KM = 101.832;

const facility = (externalRef: string, typeCode: 'NSP' | 'CFR', name: string, at: { lat: number; lon: number }) => ({
  externalRef,
  typeCode,
  name,
  address: null,
  lgaName: null,
  ...at,
});

describe('haversineKm', () => {
  it('spec AC7: matches independent figures for two Victorian pairs within 0.5 km', () => {
    expect(Math.abs(haversineKm(GPO, GEELONG) - GPO_TO_GEELONG_KM)).toBeLessThan(0.5);
    expect(Math.abs(haversineKm(GPO, BALLARAT) - GPO_TO_BALLARAT_KM)).toBeLessThan(0.5);
  });

  it('is symmetric and zero against itself', () => {
    expect(haversineKm(GPO, GEELONG)).toBeCloseTo(haversineKm(GEELONG, GPO), 9);
    expect(haversineKm(GPO, GPO)).toBe(0);
  });
});

describe('findNearest', () => {
  it('returns the nearest row of the requested type, widening the box until one is found', () => {
    const db = openDb(':memory:');
    upsertFacilities(db, 'cfa_nsp_arcgis', [
      facility('near', 'NSP', 'Near', { lat: -37.82, lon: 144.97 }),
      facility('far', 'NSP', 'Far', GEELONG),
    ]);
    upsertFacilities(db, 'cfr_static_list', [facility('refuge', 'CFR', 'Refuge', BALLARAT)]);

    const nsp = findNearest<{ name: string; lat: number; lon: number }>(db, 'facilities', GPO, 'NSP');
    expect(nsp?.row.name).toBe('Near');
    expect(nsp?.distanceKm).toBeLessThan(1);

    // Beyond the 20 km and 50 km boxes — reached through the 250 km rung.
    const cfr = findNearest<{ name: string; lat: number; lon: number }>(db, 'facilities', GPO, 'CFR');
    expect(cfr?.row.name).toBe('Refuge');
    expect(cfr?.distanceKm).toBeCloseTo(GPO_TO_BALLARAT_KM, 0);
  });

  it('returns null when nothing of that type exists statewide', () => {
    const db = openDb(':memory:');
    expect(findNearest(db, 'facilities', GPO, 'CFR')).toBeNull();
    expect(findNearest(db, 'activations', GPO, 'RELIEF')).toBeNull();
  });
});
