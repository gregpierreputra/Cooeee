import {
  addressQueryForCql,
  resolveAddressCandidates,
  type AddressCandidateResolution,
} from '../core/address-search';
import { extentSnapshotDisagrees, resolveBushfireAreaStatus } from '../core/area-check';
import {
  ADDRESS_RESULT_LIMIT,
  ADDRESS_SEARCH_TIMEOUT_MS,
  AREA_CHECK_TIMEOUT_MS,
  DTP_LICENCE,
  DTP_PUBLISHER,
} from '../core/constants';
import type {
  AddressCandidate,
  AddressRecord,
  BushfireAreaResult,
  PendingPlace,
} from '../core/types';

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

/** The search runs while the user types, so a caller may supersede its own
 * request. `signal` is the caller's cancellation, chained into the request's own
 * timeout controller: when the typed query changes, the earlier request is
 * aborted on the wire rather than left running and ignored. */
export async function fetchAddressCandidates(
  query: string,
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
  onUnresolvedDuplicates: (message: string) => void = console.error,
  signal?: AbortSignal,
): Promise<AddressCandidateResolution> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ADDRESS_SEARCH_TIMEOUT_MS);
  const abortWithCaller = () => controller.abort(signal?.reason);
  if (signal?.aborted) controller.abort(signal.reason);
  else signal?.addEventListener('abort', abortWithCaller, { once: true });

  try {
    const response = await fetcher(buildAddressSearchUrl(query), {
      method: 'GET',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Vicmap address search returned HTTP ${response.status}`);

    const payload: unknown = await response.json();
    assertRecord(payload, 'response');
    if (!Array.isArray(payload.features)) throw new TypeError('response.features must be an array');
    const resolution = resolveAddressCandidates(payload.features.map(parseAddressRecord));
    // A bare count. The searched text, the returned addresses and their points
    // are the user's business and none of them belongs in a diagnostic.
    if (resolution.unresolvedCount > 0) {
      onUnresolvedDuplicates(
        `Vicmap address search left ${resolution.unresolvedCount} group(s) unresolved`,
      );
    }
    return resolution;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortWithCaller);
  }
}

function pointFilter({ lat, lon }: Pick<PendingPlace, 'lat' | 'lon'>): string {
  return `INTERSECTS(geom, POINT(${lat} ${lon}))`;
}

function buildWfsUrl(params: Record<string, string>): string {
  return `${WFS_BASE_URL}?${new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    outputFormat: 'application/json',
    ...params,
  }).toString()}`;
}

export function buildLgaAtPointUrl(place: Pick<PendingPlace, 'lat' | 'lon'>): string {
  return buildWfsUrl({
    typeNames: 'open-data-platform:lga_polygon',
    propertyName: 'lga_name',
    count: '1',
    CQL_FILTER: pointFilter(place),
  });
}

export function buildBushfireAreaAtPointUrl(place: Pick<PendingPlace, 'lat' | 'lon'>): string {
  return buildWfsUrl({
    typeNames: 'open-data-platform:bushfire_prone_area',
    propertyName: 'lga_name,plan_number,gazettal_date',
    count: '1',
    CQL_FILTER: pointFilter(place),
  });
}

export function buildBushfireAreaExistenceUrl(lgaName: string): string {
  return buildWfsUrl({
    typeNames: 'open-data-platform:bushfire_prone_area',
    propertyName: 'lga_name',
    count: '1',
    CQL_FILTER: `lga_name='${lgaName.replaceAll("'", "''")}'`,
  });
}

function parseFeatures(value: unknown, field: string): UnknownRecord[] {
  assertRecord(value, field);
  if (!Array.isArray(value.features)) throw new TypeError(`${field}.features must be an array`);
  return value.features.map((feature, index) => {
    assertRecord(feature, `${field}.features[${index}]`);
    return feature;
  });
}

export function parseLgaName(value: unknown): string {
  const features = parseFeatures(value, 'lga response');
  if (features.length !== 1) throw new TypeError('lga response must contain exactly one feature');
  assertRecord(features[0].properties, 'lga feature.properties');
  assertString(features[0].properties.lga_name, 'lga feature.properties.lga_name');
  return features[0].properties.lga_name;
}

function parseBushfireAreaPointHits(value: unknown): number {
  const features = parseFeatures(value, 'bushfire-area response');
  for (const [index, feature] of features.entries()) {
    assertRecord(feature.properties, `bushfire-area response.features[${index}].properties`);
    assertString(
      feature.properties.lga_name,
      `bushfire-area response.features[${index}].properties.lga_name`,
    );
    assertString(
      feature.properties.plan_number,
      `bushfire-area response.features[${index}].properties.plan_number`,
    );
    assertString(
      feature.properties.gazettal_date,
      `bushfire-area response.features[${index}].properties.gazettal_date`,
    );
  }
  return features.length;
}

function parseBushfireAreaExistence(value: unknown): boolean {
  const features = parseFeatures(value, 'bushfire-area existence response');
  for (const [index, feature] of features.entries()) {
    assertRecord(feature.properties, `bushfire-area existence response.features[${index}].properties`);
    assertString(
      feature.properties.lga_name,
      `bushfire-area existence response.features[${index}].properties.lga_name`,
    );
  }
  return features.length > 0;
}

type ExtentIndex = { file: string };

function parseExtentIndex(value: unknown): ExtentIndex {
  assertRecord(value, 'extent index');
  assertRecord(value.layerExtent, 'extent index.layerExtent');
  assertString(value.layerExtent.file, 'extent index.layerExtent.file');
  if (!/^layer-extent\.v\d{4}-\d{2}-\d{2}\.json$/.test(value.layerExtent.file)) {
    throw new TypeError('extent index file is not a valid layer-extent filename');
  }
  return { file: value.layerExtent.file };
}

function parseBpaPublishedIn(value: unknown): string[] {
  assertRecord(value, 'extent snapshot');
  assertRecord(value.layers, 'extent snapshot.layers');
  assertRecord(value.layers.BPA, 'extent snapshot.layers.BPA');
  if (!Array.isArray(value.layers.BPA.publishedIn)) {
    throw new TypeError('extent snapshot.layers.BPA.publishedIn must be an array');
  }
  return value.layers.BPA.publishedIn.map((name, index) => {
    assertString(name, `extent snapshot.layers.BPA.publishedIn[${index}]`);
    return name;
  });
}

async function fetchJson(
  url: string,
  signal: AbortSignal,
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): Promise<unknown> {
  const response = await fetcher(url, { method: 'GET', signal });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
}

/** E1-US1-AC5–AC7 official area check. It performs no device write. A positive
 * point hit returns immediately; a zero is resolved by snapshot plus live
 * existence probe, with the live probe controlling any disagreement. */
export async function fetchBushfireAreaResult(
  place: PendingPlace,
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
  now: () => number = Date.now,
  onSnapshotDrift: (message: string) => void = console.error,
): Promise<BushfireAreaResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AREA_CHECK_TIMEOUT_MS);
  const pointUrl = buildBushfireAreaAtPointUrl(place);

  try {
    const [lgaPayload, pointPayload] = await Promise.all([
      fetchJson(buildLgaAtPointUrl(place), controller.signal, fetcher),
      fetchJson(pointUrl, controller.signal, fetcher),
    ]);
    const lgaName = parseLgaName(lgaPayload);
    const pointHits = parseBushfireAreaPointHits(pointPayload);

    let liveLayerExists = true;
    let snapshotDisagreed = false;
    if (pointHits === 0) {
      const index = parseExtentIndex(
        await fetchJson('/data/index.json', controller.signal, fetcher),
      );
      const [snapshotPayload, probePayload] = await Promise.all([
        fetchJson(`/data/${index.file}`, controller.signal, fetcher),
        fetchJson(buildBushfireAreaExistenceUrl(lgaName), controller.signal, fetcher),
      ]);
      const snapshotPublishedIn = parseBpaPublishedIn(snapshotPayload);
      liveLayerExists = parseBushfireAreaExistence(probePayload);
      snapshotDisagreed = extentSnapshotDisagrees(
        snapshotPublishedIn,
        lgaName,
        liveLayerExists,
      );
      if (snapshotDisagreed) {
        onSnapshotDrift(`BPA extent snapshot disagrees with live probe for ${lgaName}`);
      }
    }

    const checkedAt = now();
    const status = resolveBushfireAreaStatus(
      pointHits,
      liveLayerExists ? 'published' : 'unpublished',
    );
    // Successful response parsing makes this unreachable today. Keeping the
    // guard means a future three-state probe cannot accidentally persist an
    // unknown check as a confident result.
    if (status === 'unknown') throw new Error('bushfire-area publication could not be verified');
    return {
      status,
      checkedAt,
      lgaName,
      source: {
        publisher: DTP_PUBLISHER,
        url: pointUrl,
        licence: DTP_LICENCE,
        retrievedAt: checkedAt,
      },
      snapshotDisagreed,
    };
  } finally {
    clearTimeout(timeout);
  }
}