import { isInsideVictoria } from '../core/constants';
import type { NspSite, NspSnapshot, Source } from '../core/types';
import { getNspSnapshot, putNspSnapshot } from './db';

// The precached CFA Neighbourhood Safer Places snapshot. Same-origin static
// asset, served from the service-worker precache after the first visit — this is
// the "application shell + snapshots" call, not a sixth network call.
//
// ponytail: one hard-coded snapshot filename; read the current version from
// public/data/index.json once a snapshot-seed layer exists.
export const NSP_SNAPSHOT_PATH = '/data/nsp.v2026-09-02.json';

const GEOCODES = ['exact', 'street', 'township', 'none'] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function fail(message: string): never {
  throw new TypeError(`nsp snapshot: ${message}`);
}

function assertString(value: unknown, field: string): string {
  if (typeof value !== 'string') fail(`${field} must be a string`);
  return value as string;
}

function assertNonEmpty(value: unknown, field: string): string {
  const text = assertString(value, field);
  if (text.trim().length === 0) fail(`${field} must not be empty`);
  return text;
}

function assertPositiveNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    fail(`${field} must be a positive number`);
  }
  return value as number;
}

function assertFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${field} must be a number`);
  return value as number;
}

function assertSource(value: unknown): Source {
  if (typeof value !== 'object' || value === null) fail('source must be an object');
  const raw = value as Record<string, unknown>;
  return {
    publisher: assertNonEmpty(raw.publisher, 'source.publisher'),
    url: assertNonEmpty(raw.url, 'source.url'),
    licence: assertNonEmpty(raw.licence, 'source.licence'),
    retrievedAt: assertPositiveNumber(raw.retrievedAt, 'source.retrievedAt'),
  };
}

function assertSite(value: unknown, index: number): NspSite {
  if (typeof value !== 'object' || value === null) fail(`sites[${index}] must be an object`);
  const raw = value as Record<string, unknown>;
  const at = (field: string) => `sites[${index}].${field}`;

  const geocode = assertString(raw.geocode, at('geocode'));
  if (!(GEOCODES as readonly string[]).includes(geocode)) {
    fail(`${at('geocode')} must be one of ${GEOCODES.join(', ')}`);
  }

  const site: NspSite = {
    id: assertNonEmpty(raw.id, at('id')),
    municipality: assertNonEmpty(raw.municipality, at('municipality')),
    township: assertString(raw.township, at('township')),
    name: assertNonEmpty(raw.name, at('name')),
    subLocation: assertString(raw.subLocation, at('subLocation')),
    street: assertString(raw.street, at('street')),
    geocode: geocode as NspSite['geocode'],
  };
  if (raw.designatedAt !== undefined) {
    if (!ISO_DATE.test(assertString(raw.designatedAt, at('designatedAt')))) {
      fail(`${at('designatedAt')} must be an ISO date (YYYY-MM-DD)`);
    }
    site.designatedAt = raw.designatedAt as string;
  }

  if (geocode === 'none') {
    if (raw.lat !== undefined || raw.lon !== undefined) {
      fail(`${at('geocode')} 'none' must not carry coordinates`);
    }
    return site;
  }

  site.lat = assertFiniteNumber(raw.lat, at('lat'));
  site.lon = assertFiniteNumber(raw.lon, at('lon'));
  if (!isInsideVictoria(site.lat, site.lon)) fail(`${at('lat')}/${at('lon')} must be inside Victoria`);
  return site;
}

/** THE asserting parser for the NSP snapshot. Every external read of this file
 *  goes through here, and it throws on any drift rather than letting a malformed
 *  row reach a screen as fact. */
export function assertNspSnapshot(value: unknown): NspSnapshot {
  if (typeof value !== 'object' || value === null) fail('the file must be a JSON object');
  const raw = value as Record<string, unknown>;

  const listAsAt = assertString(raw.listAsAt, 'listAsAt');
  if (!ISO_DATE.test(listAsAt)) fail('listAsAt must be an ISO date (YYYY-MM-DD)');

  if (!Array.isArray(raw.sites)) fail('sites must be an array');

  return {
    listAsAt,
    retrievedAt: assertPositiveNumber(raw.retrievedAt, 'retrievedAt'),
    source: assertSource(raw.source),
    sites: raw.sites.map(assertSite),
  };
}

/** Copy the precached snapshot into IndexedDB for BlackSky, which cannot fetch.
 *  Called on every app start; the file is precached, so this works offline after
 *  the first visit, and a first visit with no network simply leaves no copy.
 *  The copy is written only when the file is newer than what is stored. */
export async function cacheNspSnapshot(): Promise<void> {
  const snapshot = await loadNspSnapshot();
  const stored = await getNspSnapshot();
  if (stored?.retrievedAt !== snapshot.retrievedAt) await putNspSnapshot(snapshot);
}

/** Read and validate the precached CFA NSP snapshot. `fetchImpl` is injectable
 *  so the build pipeline and tests can supply the bytes without a real request. */
export async function loadNspSnapshot(fetchImpl: typeof fetch = fetch): Promise<NspSnapshot> {
  const response = await fetchImpl(NSP_SNAPSHOT_PATH, { cache: 'force-cache' });
  if (!response.ok) fail(`request failed (${response.status})`);
  return assertNspSnapshot(await response.json());
}
