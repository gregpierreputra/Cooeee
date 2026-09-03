import { describe, expect, it } from 'vitest';
import { toFacility } from '../../server/ingest/nsp';
import { firstPoint } from '../../server/ingest/vicemergency';

// The ingest boundary: a coordinate that is not a place in Victoria never
// becomes a facility, whatever else the record says.
const OLINDA = { lon: 145.363, lat: -37.848 };
const feature = (coordinates: unknown) => ({
  geometry: { type: 'Point', coordinates },
  properties: { nsp_id: '1', nsp_name: 'Olinda Recreation Reserve' },
});

describe('toFacility', () => {
  it('keeps a Victorian point and drops Sydney, (0,0) and a swapped lat/lon', () => {
    expect(toFacility(feature([OLINDA.lon, OLINDA.lat]))?.lat).toBe(OLINDA.lat);
    expect(toFacility(feature([151.21, -33.87]))).toBeNull();
    expect(toFacility(feature([0, 0]))).toBeNull();
    expect(toFacility(feature([OLINDA.lat, OLINDA.lon]))).toBeNull();
  });
});

describe('firstPoint', () => {
  it('returns a Victorian point and null for a swapped lat/lon', () => {
    expect(firstPoint({ type: 'Point', coordinates: [OLINDA.lon, OLINDA.lat] })).toEqual(OLINDA);
    expect(firstPoint({ type: 'Point', coordinates: [OLINDA.lat, OLINDA.lon] })).toBeNull();
  });
});
