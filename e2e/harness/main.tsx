import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

import type {
  Destination,
  ExposureLayer,
  Pack,
  PendingPlace,
  RecoveryProgram,
  TextPackContent,
} from '../../src/core/types';
import { createPackOffer, discardBuildingPack, saveTextOnlyPack, stageTextOnlyPack } from '../../src/data/pack-build';
import { db } from '../../src/data/db';
import { manifestGroup } from '../../src/data/integrity';
import PackDetail from '../../src/ui/PackDetail';
import { Confirm } from '../../src/ui/PackNew/Confirm';
import { Search } from '../../src/ui/PackNew/Search';
import { Size, type DownloadChoice } from '../../src/ui/PackNew/Size';
import '../../src/ui/theme.css';

declare global {
  interface Window {
    __confirmedPlace?: PendingPlace;
    __searchAgainCount: number;
    __areaCheckCount: number;
    __downloadCount: number;
    __keptSavedPlace: boolean;
    __readPacks: () => Promise<Pack[]>;
    __readDestinations: () => Promise<Destination[]>;
    __storageCounts: () => Promise<Record<string, number>>;
  }
}

window.__searchAgainCount = 0;
window.__areaCheckCount = 0;
window.__downloadCount = 0;
window.__keptSavedPlace = false;
window.__readPacks = () => db.packs.toArray();
window.__readDestinations = () => db.destinations.toArray();
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

const packSource = {
  publisher: 'Department of Transport and Planning',
  url: 'https://opendata.maps.vic.gov.au/geoserver/wfs',
  licence: 'CC BY 4.0',
  retrievedAt: Date.UTC(2026, 7, 28, 2),
};
const recoveryProgram: RecoveryProgram = {
  id: 'services-australia-example',
  org: 'Services Australia',
  title: 'Test-only recovery snapshot',
  covers: 'A test-only record used to verify local pack assembly.',
  needs: ['money'],
  officialUrl: 'https://www.servicesaustralia.gov.au/',
  snapshotDate: '2026-08-28',
  source: { ...packSource, publisher: 'Services Australia' },
};
const sizeMode = new URLSearchParams(window.location.search).get('mode') ?? 'available';
const sizeContent: TextPackContent = {
  pack: {
    id: 'new-pack',
    name: 'Kalorama',
    address: testCandidate.address,
    lat: testCandidate.lat,
    lon: testCandidate.lon,
    radiusKm: 10,
    lgaName: 'YARRA RANGES',
    createdAt: Date.UTC(2026, 7, 28, 3),
    reminder: 'Follow official information during an emergency.',
    sources: [packSource],
    ...(sizeMode === 'interrupt' ? { supersedes: savedPack.id } : {}),
  },
  layers: [],
  destinations: sizeMode === 'omission' ? [{
    id: 'new-pack:missing-source',
    packId: 'new-pack',
    kind: 'nsp-bushfire',
    name: 'Malformed test-only item',
    source: { ...packSource, publisher: '' },
  }] : [],
  recovery: [recoveryProgram],
};

let sizeFlow = confirmation;
if (window.location.pathname === '/size') {
  await db.programs.put(recoveryProgram);
  if (sizeMode === 'interrupt') await db.packs.put(savedPack);
  const offer = await createPackOffer(sizeContent, {
    bytes: 13_002_342,
    count: 120,
    available: sizeMode !== 'unavailable',
  });
  let interruptOnce = sizeMode === 'interrupt';
  const download = async (choice: DownloadChoice) => {
    window.__downloadCount += 1;
    if (interruptOnce) {
      interruptOnce = false;
      await stageTextOnlyPack(sizeContent, offer);
      await discardBuildingPack(sizeContent.pack.id);
      throw new Error('synthetic interrupted download');
    }
    if (choice === 'both') throw new Error('production map archive is unavailable');
    await saveTextOnlyPack(sizeContent, offer, Date.UTC(2026, 7, 28, 4));
  };
  sizeFlow = <Size offer={offer} download={download} />;
}

const detailNow = Date.UTC(2026, 7, 29, 12);
const detailMode = new URLSearchParams(window.location.search).get('mode') ?? 'fresh';
const detailSavedAt = detailMode === 'stale'
  ? detailNow - 31 * 86_400_000
  : detailNow - 2 * 86_400_000;
const detailLayer: ExposureLayer = {
  id: 'detail-pack:BPA',
  packId: 'detail-pack',
  group: 'designation',
  code: 'BPA',
  status: 'present',
  features: [{ planNumber: 'LEGL./25-138' }],
  checkedAt: detailSavedAt,
  source: { ...packSource, retrievedAt: detailSavedAt },
};
const detailDestination: Destination = {
  id: 'detail-pack:nsp',
  packId: 'detail-pack',
  kind: 'nsp-bushfire',
  name: 'Kalorama Reserve',
  source: {
    publisher: 'Country Fire Authority',
    url: 'https://www.cfa.vic.gov.au/plan-prepare/neighbourhood-safer-places',
    licence: 'CFA website list — permission to be confirmed',
    retrievedAt: detailSavedAt,
  },
};
const detailRecovery: RecoveryProgram = {
  ...recoveryProgram,
  id: 'detail-recovery',
  title: 'Disaster support reference',
  source: {
    publisher: 'Services Australia',
    url: 'https://www.servicesaustralia.gov.au/natural-disaster-support',
    licence: 'Public web content — attributed reference',
    retrievedAt: detailSavedAt,
  },
};

if (window.location.pathname === '/detail' || window.location.pathname === '/detail-launch') {
  await Promise.all(db.tables.map((table) => table.clear()));
  const recoveryManifest = await manifestGroup([detailRecovery]);
  await db.packs.put({
    ...savedPack,
    id: 'detail-pack',
    name: 'Kalorama',
    address: testCandidate.address,
    verifiedAt: detailSavedAt,
    manifest: {
      version: 1,
      groups: {
        layers: { count: 1, sha256: 'test-only' },
        destinations: { count: 1, sha256: 'test-only' },
        recovery: recoveryManifest,
        tiles: { count: 0, bytes: 0 },
      },
    },
  });
  await db.layers.put(detailLayer);
  await db.destinations.put(detailDestination);
  await db.programs.put(detailRecovery);
}

function DetailLauncher() {
  const [open, setOpen] = useState(false);
  return open
    ? <PackDetail packId="detail-pack" now={detailNow} />
    : <main className="page"><button type="button" onClick={() => setOpen(true)}>Open test pack</button></main>;
}

const detailFlow = window.location.pathname === '/detail-launch'
  ? <DetailLauncher />
  : <PackDetail packId="detail-pack" now={detailNow} />;

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
        : window.location.pathname === '/size' ? sizeFlow
        : window.location.pathname === '/detail' || window.location.pathname === '/detail-launch'
          ? detailFlow
        : window.location.pathname === '/search' ? (
      <Search onPendingPlace={(place) => { window.__confirmedPlace = place; }} />
    ) : confirmation}
  </StrictMode>,
);
