import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import type { Pack, PendingPlace } from '../../src/core/types';
import { db } from '../../src/data/db';
import { Confirm } from '../../src/ui/PackNew/Confirm';
import { Search } from '../../src/ui/PackNew/Search';
import '../../src/ui/theme.css';

declare global {
  interface Window {
    __confirmedPlace?: PendingPlace;
    __searchAgainCount: number;
    __areaCheckCount: number;
    __keptSavedPlace: boolean;
    __readPacks: () => Promise<Pack[]>;
    __storageCounts: () => Promise<Record<string, number>>;
  }
}

window.__searchAgainCount = 0;
window.__areaCheckCount = 0;
window.__keptSavedPlace = false;
window.__readPacks = () => db.packs.toArray();
window.__storageCounts = async () => Object.fromEntries(
  await Promise.all(db.tables.map(async (table) => [table.name, await table.count()])),
);

// Synthetic data exists only in this harness, which is excluded from the PWA build.
const testCandidate = {
  address: '6 RIDGE ROAD KALORAMA 3766',
  localityName: 'KALORAMA',
  lat: -37.817939,
  lon: 145.36594,
};

const root = document.querySelector<HTMLDivElement>('#root');
if (!root) throw new Error('Test harness root is missing');

const confirmation = (
  <Confirm
    candidate={testCandidate}
    onConfirm={(pendingPlace) => {
      window.__confirmedPlace = pendingPlace;
    }}
    onSearchAgain={() => {
      window.__searchAgainCount += 1;
    }}
  />
);

const areaMode = new URLSearchParams(window.location.search).get('mode') ?? 'present';
let areaAttempts = 0;
const syntheticAreaCheck = async () => {
  areaAttempts += 1;
  window.__areaCheckCount += 1;
  if (areaMode === 'failure' || (areaMode === 'retry' && areaAttempts === 1)) {
    throw new Error('synthetic area-check failure');
  }
  const status = areaMode === 'none'
    ? 'none-mapped-here'
    : areaMode === 'unpublished'
      ? 'not-published'
      : 'present';
  return {
    status,
    checkedAt: Date.UTC(2026, 7, 28, 2),
    lgaName: status === 'not-published' ? 'MELBOURNE' : 'YARRA RANGES',
    source: {
      publisher: 'Department of Transport and Planning',
      url: 'https://opendata.maps.vic.gov.au/geoserver/wfs',
      licence: 'CC BY 4.0',
      retrievedAt: Date.UTC(2026, 7, 28, 2),
    },
    snapshotDisagreed: false,
  } as const;
};

const savedPack: Pack = {
  id: 'saved-pack',
  status: 'complete',
  name: 'Ferny Creek',
  address: '10 OLD ROAD FERNY CREEK 3786',
  lat: -37.88,
  lon: 145.34,
  radiusKm: 6,
  lgaName: 'YARRA RANGES',
  createdAt: Date.UTC(2026, 7, 20),
  verifiedAt: Date.UTC(2026, 7, 20),
  builtWithTiles: false,
  sizeBytes: { text: 1_024, tiles: 0 },
  reminder: 'Use official information during an emergency.',
  manifest: {
    version: 1,
    groups: {
      layers: { count: 0, sha256: '' },
      destinations: { count: 0, sha256: '' },
      recovery: { count: 0, sha256: '' },
      tiles: { count: 0, bytes: 0 },
    },
  },
  sources: [{
    publisher: 'Department of Transport and Planning',
    url: 'https://opendata.maps.vic.gov.au/geoserver/wfs',
    licence: 'CC BY 4.0',
    retrievedAt: Date.UTC(2026, 7, 20),
  }],
};

if (window.location.pathname === '/conflict' && await db.packs.count() === 0) {
  await db.packs.put(savedPack);
}

const conflictMode = new URLSearchParams(window.location.search).get('mode');
const conflictFlow = (
  <Search
    search={async () => [testCandidate]}
    checkArea={syntheticAreaCheck}
    loadPacks={conflictMode === 'unavailable'
      ? async () => { throw new Error('synthetic store failure'); }
      : conflictMode === 'multiple'
        ? async () => [savedPack, { ...savedPack, id: 'second-pack' }]
        : undefined}
    onKeepSavedPlace={() => { window.__keptSavedPlace = true; }}
    onPendingPlace={(place) => { window.__confirmedPlace = place; }}
  />
);

const areaFlow = (
  <Search
    search={async () => [testCandidate]}
    checkArea={areaMode === 'offline' ? undefined : syntheticAreaCheck}
    onPendingPlace={(place) => { window.__confirmedPlace = place; }}
  />
);

createRoot(root).render(
  <StrictMode>
    {window.location.pathname === '/conflict' ? conflictFlow
      : window.location.pathname === '/area' ? areaFlow
        : window.location.pathname === '/search' ? (
      <Search onPendingPlace={(place) => { window.__confirmedPlace = place; }} />
    ) : confirmation}
  </StrictMode>,
);
