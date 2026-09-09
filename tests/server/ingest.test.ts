import { describe, expect, it } from 'vitest';
import { MAX_SYNC_ROWS } from '../../src/core/constants';
import { fetchNspFacilities, toFacility } from '../../server/ingest/nsp';
import { toFacility as toCoolFacility } from '../../server/ingest/cool';
import { classifyHazard, firstPoint, rings } from '../../server/ingest/vicemergency';

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

describe('cool toFacility', () => {
  it('reads the layer\'s one-member MultiPoint and refuses a point outside Victoria', () => {
    const props = { pfi: 981492, name_label: 'Brookside Community Centre', feature_subtype: 'community centre' };
    const row = toCoolFacility({ geometry: { type: 'MultiPoint', coordinates: [[OLINDA.lon, OLINDA.lat]] }, properties: props });
    expect(row).toMatchObject({ externalRef: '981492', typeCode: 'COOL', name: 'Brookside Community Centre', lat: OLINDA.lat });
    expect(toCoolFacility({ geometry: { type: 'MultiPoint', coordinates: [[151.21, -33.87]] }, properties: props })).toBeNull();
    expect(toCoolFacility({ geometry: { type: 'MultiPoint', coordinates: [[OLINDA.lon, OLINDA.lat]] }, properties: { ...props, feature_subtype: 'hall' } })).toBeNull();
  });
});

describe('classifyHazard and rings', () => {
  it('names heat and severe weather notices and nothing else', () => {
    expect(classifyHazard({ sourceTitle: 'Heat Health Warning' })).toBe('heat');
    expect(classifyHazard({ sourceTitle: 'Heatwave Warning' })).toBe('heat');
    expect(classifyHazard({ cap: { event: 'Severe Thunderstorm' } })).toBe('storm');
    expect(classifyHazard({ category1: 'Fire', category2: 'Bushfire' })).toBeNull();
    expect(classifyHazard({ category1: 'Fire', name: 'Grass fire, Wheatsheaf Road' })).toBeNull();
    expect(classifyHazard({ name: 'Heathcote Relief Centre' })).toBeNull();
  });

  it('keeps every outer ring, rounded, and drops the lot past the point cap', () => {
    const square = [[145.00001, -37.0], [145.2, -37.0], [145.2, -37.2], [145.00001, -37.0]];
    const found = rings({ type: 'GeometryCollection', geometries: [{ type: 'MultiPolygon', coordinates: [[square], [square, square]] }] });
    expect(found).toHaveLength(2);
    expect(found[0][0]).toEqual({ lat: -37, lon: 145 });
    const huge = Array.from({ length: 10_001 }, (_, i) => [145 + i / 1e6, -37]);
    expect(rings({ type: 'Polygon', coordinates: [huge] })).toEqual([]);
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
