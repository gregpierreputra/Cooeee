import type { AddressCandidate } from '../core/types';

type UnknownRecord = Record<string, unknown>;

function assertRecord(value: unknown, field: string): asserts value is UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new TypeError(`${field} must be a string`);
  }
}

function assertFiniteNumber(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${field} must be a finite number`);
  }
}

/** Convert one external GeoJSON feature at the data boundary. Coordinates use
 * GeoJSON [longitude, latitude]; bbox is deliberately ignored. */
export function parseAddressFeature(value: unknown): AddressCandidate {
  assertRecord(value, 'feature');
  assertRecord(value.properties, 'feature.properties');
  assertRecord(value.geometry, 'feature.geometry');

  if (value.geometry.type !== 'Point') {
    throw new TypeError('feature.geometry.type must be Point');
  }

  const coordinates = value.geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    throw new TypeError('feature.geometry.coordinates must contain longitude and latitude');
  }

  const [lon, lat] = coordinates;
  assertFiniteNumber(lon, 'feature.geometry.coordinates[0]');
  assertFiniteNumber(lat, 'feature.geometry.coordinates[1]');
  assertString(value.properties.ezi_address, 'feature.properties.ezi_address');
  assertString(value.properties.locality_name, 'feature.properties.locality_name');

  return {
    address: value.properties.ezi_address,
    localityName: value.properties.locality_name,
    lat,
    lon,
  };
}
