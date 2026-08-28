import { describe, expect, it } from 'vitest';

import {
  buildAddressSearchUrl,
  fetchAddressCandidates,
  parseAddressFeature,
} from '../../src/data/wfs';

function feature(overrides: Record<string, unknown> = {}) {
  return {
    type: 'Feature',
    bbox: [-37.817939, 145.36594, -37.817939, 145.36594],
    geometry: { type: 'Point', coordinates: [145.36594, -37.817939] },
    properties: {
      ezi_address: '6 RIDGE ROAD KALORAMA 3766',
      locality_name: 'KALORAMA',
      property_status: 'A',
      is_primary: 'Y',
    },
    ...overrides,
  };
}

describe('parseAddressFeature', () => {
  it('reads longitude then latitude from Point geometry and ignores bbox', () => {
    expect(parseAddressFeature(feature())).toEqual({
      address: '6 RIDGE ROAD KALORAMA 3766',
      localityName: 'KALORAMA',
      lat: -37.817939,
      lon: 145.36594,
    });
  });

  it('preserves source strings exactly', () => {
    const result = parseAddressFeature(feature({
      properties: { ezi_address: ' 6 RIDGE ROAD ', locality_name: ' KALORAMA ' },
    }));
    expect(result.address).toBe(' 6 RIDGE ROAD ');
    expect(result.localityName).toBe(' KALORAMA ');
  });

  it.each([
    ['missing geometry', feature({ geometry: null })],
    ['non-Point geometry', feature({ geometry: { type: 'LineString', coordinates: [] } })],
    ['missing coordinates', feature({ geometry: { type: 'Point' } })],
    ['non-finite longitude', feature({ geometry: { type: 'Point', coordinates: [NaN, -37] } })],
    ['missing properties', feature({ properties: null })],
    ['missing address', feature({ properties: { locality_name: 'KALORAMA' } })],
    ['missing locality', feature({ properties: { ezi_address: '6 RIDGE ROAD' } })],
  ])('rejects %s', (_label, value) => {
    expect(() => parseAddressFeature(value)).toThrow(TypeError);
  });
});

describe('address search request', () => {
  it('uses the official WFS, caps results and keeps geometry in the response', () => {
    const url = new URL(buildAddressSearchUrl("o'connor"));
    expect(url.origin + url.pathname).toBe('https://opendata.maps.vic.gov.au/geoserver/wfs');
    expect(url.searchParams.get('count')).toBe('10');
    expect(url.searchParams.get('CQL_FILTER')).toBe(
      "property_status = 'A' AND ezi_address LIKE 'O''CONNOR%'",
    );
    expect(url.searchParams.has('propertyName')).toBe(false);
  });

  it('parses, filters and returns candidates from a successful response', async () => {
    const inactive = feature({
      properties: {
        ezi_address: 'RETIRED ADDRESS', locality_name: 'OLD',
        property_status: 'R', is_primary: 'Y',
      },
    });
    const fetcher = async () => new Response(JSON.stringify({
      type: 'FeatureCollection', features: [feature(), inactive],
    }), { status: 200 });

    await expect(fetchAddressCandidates('ridge', fetcher)).resolves.toEqual([{
      address: '6 RIDGE ROAD KALORAMA 3766',
      localityName: 'KALORAMA',
      lat: -37.817939,
      lon: 145.36594,
    }]);
  });

  it('returns an empty list only for a valid empty feature collection', async () => {
    const fetcher = async () => new Response(JSON.stringify({ features: [] }), { status: 200 });
    await expect(fetchAddressCandidates('unknown', fetcher)).resolves.toEqual([]);
  });

  it('rejects service failures instead of mapping them to no-match', async () => {
    const fetcher = async () => new Response('', { status: 503 });
    await expect(fetchAddressCandidates('ridge', fetcher)).rejects.toThrow('HTTP 503');
  });

  it('rejects a drifted feature-collection shape', async () => {
    const fetcher = async () => new Response(JSON.stringify({ features: null }), { status: 200 });
    await expect(fetchAddressCandidates('ridge', fetcher)).rejects.toThrow(TypeError);
  });
});
