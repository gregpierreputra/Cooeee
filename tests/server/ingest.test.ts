import { describe, expect, it } from 'vitest';
import { MAX_SYNC_ROWS } from '../../src/core/constants';
import { fetchNspFacilities, toFacility } from '../../server/ingest/nsp';
import { firstPoint } from '../../server/ingest/vicemergency';

// The ingest boundary: a coordinate that is not a place in Victoria never
// becomes a facility, whatever else the record says.
const OLINDA = { lon: 145.363, lat: -37.848 };
const feature = (coordinates: unknown, id = '1') => ({
  geometry: { type: 'Point', coordinates },
  properties: { nsp_id: id, nsp_name: 'Olinda Recreation Reserve' },
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

  // A point wrapped in `depth` nested GeometryCollections.
  const nested = (depth: number) => {
    let geometry = { type: 'Point', coordinates: [OLINDA.lon, OLINDA.lat] } as Parameters<typeof firstPoint>[0];
    for (let i = 0; i < depth; i += 1) geometry = { type: 'GeometryCollection', geometries: [geometry] };
    return geometry;
  };

  it('reads a point inside a shallow collection and skips one nested past the depth limit', () => {
    expect(firstPoint(nested(2))).toEqual(OLINDA);
    expect(firstPoint(nested(20))).toBeNull();
    expect(() => firstPoint(nested(10_000))).not.toThrow(); // no stack exhaustion, whatever the feed sends
  });
});

describe('fetchNspFacilities', () => {
  it('stops paging at the row cap when the upstream always claims there is more', async () => {
    let pages = 0;
    const page = Array.from({ length: 1000 }, (_, i) => feature([OLINDA.lon, OLINDA.lat], String(i)));
    const alwaysMore = async () => {
      pages += 1;
      return Response.json({ features: page, properties: { exceededTransferLimit: true } });
    };
    const { rows } = await fetchNspFacilities(alwaysMore as unknown as typeof fetch);
    expect(rows).toHaveLength(MAX_SYNC_ROWS);
    expect(pages).toBe(MAX_SYNC_ROWS / 1000);
  });
});
