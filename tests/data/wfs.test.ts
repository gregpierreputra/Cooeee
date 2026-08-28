import { describe, expect, it } from 'vitest';

import { parseAddressFeature } from '../../src/data/wfs';

function feature(overrides: Record<string, unknown> = {}) {
  return {
    type: 'Feature',
    bbox: [-37.817939, 145.36594, -37.817939, 145.36594],
    geometry: { type: 'Point', coordinates: [145.36594, -37.817939] },
    properties: {
      ezi_address: '6 RIDGE ROAD KALORAMA 3766',
      locality_name: 'KALORAMA',
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
