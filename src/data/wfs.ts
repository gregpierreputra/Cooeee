import { addressQueryForCql, visibleAddressCandidates } from '../core/address-search';
import { ADDRESS_RESULT_LIMIT, ADDRESS_SEARCH_TIMEOUT_MS } from '../core/constants';
import type { AddressCandidate, AddressRecord } from '../core/types';

const WFS_BASE_URL = 'https://opendata.maps.vic.gov.au/geoserver/wfs';

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

function parseAddressRecord(value: unknown): AddressRecord {
  assertRecord(value, 'feature');
  assertRecord(value.properties, 'feature.properties');
  assertString(value.properties.property_status, 'feature.properties.property_status');
  assertString(value.properties.is_primary, 'feature.properties.selection flag');

  return {
    candidate: parseAddressFeature(value),
    propertyStatus: value.properties.property_status,
    isPrimary: value.properties.is_primary === 'Y',
  };
}

export function buildAddressSearchUrl(query: string): string {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    outputFormat: 'application/json',
    typeNames: 'open-data-platform:address',
    count: String(ADDRESS_RESULT_LIMIT),
    CQL_FILTER: `property_status = 'A' AND ezi_address LIKE '${addressQueryForCql(query)}%'`,
  });
  return `${WFS_BASE_URL}?${params.toString()}`;
}

export async function fetchAddressCandidates(
  query: string,
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
): Promise<AddressCandidate[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ADDRESS_SEARCH_TIMEOUT_MS);

  try {
    const response = await fetcher(buildAddressSearchUrl(query), {
      method: 'GET',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Vicmap address search returned HTTP ${response.status}`);

    const payload: unknown = await response.json();
    assertRecord(payload, 'response');
    if (!Array.isArray(payload.features)) throw new TypeError('response.features must be an array');
    return visibleAddressCandidates(payload.features.map(parseAddressRecord));
  } finally {
    clearTimeout(timeout);
  }
}
