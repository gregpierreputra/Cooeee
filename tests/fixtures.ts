import type { Destination, Pack, RecoveryProgram, Source } from '../src/core/types';

/** Kalorama — the register's reference point (Implementation Spec §1). */
export const KALORAMA = { lat: -37.813, lon: 145.362 };

/** Melbourne CBD — the register's control point, which returns zero BPA matches. */
export const CBD = { lat: -37.8136, lon: 144.9631 };

export const source = (over: Partial<Source> = {}): Source => ({
  publisher: 'Country Fire Authority',
  url: 'https://www.cfa.vic.gov.au/example',
  licence: 'CFA website list — permission to be confirmed',
  retrievedAt: 1_756_100_000_000,
  ...over,
});

export const pack = (over: Partial<Pack> = {}): Pack => ({
  id: 'pack-1',
  status: 'complete',
  name: 'Kalorama',
  address: '1 EXAMPLE ROAD KALORAMA 3766',
  lat: KALORAMA.lat,
  lon: KALORAMA.lon,
  radiusKm: 6,
  lgaName: 'YARRA RANGES',
  createdAt: 1_756_100_000_000,
  verifiedAt: 1_756_100_000_000,
  builtWithTiles: false,
  sizeBytes: { text: 1024, tiles: 0 },
  reminder: 'Leave early on a hot, windy day.',
  manifest: {
    version: 1,
    groups: {
      layers: { count: 0, sha256: '' },
      destinations: { count: 0, sha256: '' },
      recovery: { count: 0, sha256: '' },
      tiles: { count: 0, bytes: 0 },
    },
  },
  sources: [source()],
  ...over,
});

export const destination = (over: Partial<Destination> = {}): Destination => ({
  id: 'pack-1:nsp-0001',
  packId: 'pack-1',
  kind: 'nsp-bushfire',
  name: 'Example Reserve',
  geocode: 'street',
  lat: KALORAMA.lat,
  lon: KALORAMA.lon,
  source: source(),
  ...over,
});

export const program = (over: Partial<RecoveryProgram> = {}): RecoveryProgram => ({
  id: 'prog-1',
  org: 'Services Australia',
  title: 'Example payment',
  covers: 'One plain-language line about what this covers.',
  needs: ['money'],
  officialUrl: 'https://www.servicesaustralia.gov.au/example',
  snapshotDate: '2026-08-18',
  source: source({ publisher: 'Services Australia' }),
  ...over,
});
