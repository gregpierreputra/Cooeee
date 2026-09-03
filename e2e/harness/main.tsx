import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';

import type {
  Destination,
  ExposureLayer,
  HazardType,
  Pack,
  PendingPlace,
  RecoveryProgram,
  TextPackContent,
} from '../../src/core/types';
import { absenceRow, chosenDestinations, orderByDistance } from '../../src/core/destination';
import { DTP_DATASET_URL } from '../../src/core/constants';
import { destinationsForPack, selectSitesForPack, toDestination } from '../../src/core/nsp';
import { createPackOffer, discardBuildingPack, saveTextOnlyPack, stageTextOnlyPack } from '../../src/data/pack-build';
import { db } from '../../src/data/db';
import { manifestGroup } from '../../src/data/integrity';
import { loadNspSnapshot } from '../../src/data/nsp';
import Home from '../../src/ui/Home';
import Nearby from '../../src/ui/Nearby';
import PackDetail from '../../src/ui/PackDetail';
import AppHeader from '../../src/ui/components/AppHeader';
import { Confirm } from '../../src/ui/PackNew/Confirm';
import { Destinations } from '../../src/ui/PackNew/Destinations';
import { Search } from '../../src/ui/PackNew/Search';
import { Size } from '../../src/ui/PackNew/Size';
import nspFixture from './nsp-fixture.json';
import '../../src/ui/theme.css';

declare global {
  interface Window {
    __confirmedPlace?: PendingPlace;
    __searchAgainCount: number;
    __areaCheckCount: number;
    __downloadCount: number;
    __continueCount: number;
    __keptSavedPlace: boolean;
    __readPacks: () => Promise<Pack[]>;
    __readDestinations: () => Promise<Destination[]>;
    __storageCounts: () => Promise<Record<string, number>>;
  }
}

// The harness stays synthetic: no wizard here copies the real source PDFs.
const noFiles = async () => [];

window.__searchAgainCount = 0;
window.__areaCheckCount = 0;
window.__downloadCount = 0;
window.__continueCount = 0;
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
    search={async () => ({ candidates: [testCandidate], unresolvedCount: 0, returnedCount: 1 })}
    checkArea={syntheticAreaCheck}
    loadFiles={noFiles}
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
  const offer = await createPackOffer(sizeContent);
  let interruptOnce = sizeMode === 'interrupt';
  const download = async () => {
    window.__downloadCount += 1;
    if (interruptOnce) {
      interruptOnce = false;
      await stageTextOnlyPack(sizeContent, offer);
      await discardBuildingPack(sizeContent.pack.id);
      throw new Error('synthetic interrupted save');
    }
    await saveTextOnlyPack(sizeContent, offer, Date.UTC(2026, 7, 28, 4));
  };
  sizeFlow = (
    <Size
      offer={offer}
      address={sizeContent.pack.address}
      download={download}
      onContinue={() => { window.__continueCount += 1; }}
    />
  );
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
  features: [{ planNumber: 'LEGL./25-138', gazettalDate: '10/07/2025' }],
  checkedAt: detailSavedAt,
  source: { ...packSource, retrievedAt: detailSavedAt },
};
const cfaSource = {
  publisher: 'Country Fire Authority',
  url: 'https://www.cfa.vic.gov.au/plan-prepare/neighbourhood-safer-places',
  licence: 'CFA website list — permission to be confirmed',
  retrievedAt: detailSavedAt,
};
const detailDestination: Destination = detailMode === 'absence'
  ? absenceRow('detail-pack', 'Yarra Ranges', cfaSource)
  : {
      id: 'detail-pack:nsp',
      packId: 'detail-pack',
      kind: 'nsp-bushfire',
      name: 'Kalorama Reserve',
      source: cfaSource,
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
  // A synthetic PDF copy of the dataset page, so the file link renders here.
  const bytes = new TextEncoder().encode('%PDF-1.7 synthetic').buffer;
  await db.files.put({
    id: 'detail-pack:bpa.pdf', packId: 'detail-pack', url: DTP_DATASET_URL, name: 'bpa.pdf',
    retrievedAt: detailSavedAt, sizeBytes: bytes.byteLength, sha256: 'test-only', bytes,
  });
}

function DetailLauncher() {
  const [open, setOpen] = useState(false);
  return open
    ? <PackDetail packId="detail-pack" now={detailNow} />
    : <main className="page"><button type="button" onClick={() => setOpen(true)}>Open test pack</button></main>;
}

const detailFlow =
  window.location.pathname === '/detail-launch'
    ? <DetailLauncher />
    : <PackDetail packId="detail-pack" now={detailNow} />;

// E1-US2-AC6. The returning-user home and the fixed header, at a fixed instant
// so the header's age states are exact rather than clock-dependent.
const homeNow = Date.UTC(2026, 8, 1, 9);
const homeMode = new URLSearchParams(window.location.search).get('mode') ?? 'pack';
const homeDays = Number(new URLSearchParams(window.location.search).get('days') ?? '3');
let homeFlow = confirmation;
if (window.location.pathname === '/home') {
  await Promise.all(db.tables.map((table) => table.clear()));
  if (homeMode !== 'none') {
    await db.packs.put({ ...savedPack, verifiedAt: homeNow - homeDays * 86_400_000 });
  }
  homeFlow = (
    <>
      <AppHeader now={homeNow} />
      <Home now={homeNow} />
    </>
  );
}

const destinationsMode = new URLSearchParams(window.location.search).get('mode') ?? 'sites';
const destinationsNow = Date.UTC(2026, 8, 1);
let destinationsFlow = confirmation;
if (window.location.pathname === '/destinations') {
  const centre = { lat: -37.813, lon: 145.362 };
  const lgaName = 'YARRA RANGES';
  const area = 'Yarra Ranges';
  const packId = 'destinations-pack';

  const jsonResponse = (body: unknown): Response =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  const fetchImpl: typeof fetch = destinationsMode === 'empty'
    ? async () => jsonResponse({ ...nspFixture, sites: [] })
    : destinationsMode === 'malformed'
      ? async () => jsonResponse({ listAsAt: 'not-a-date', sites: 'nope' })
      : async () => jsonResponse(nspFixture);

  const selectable = new URLSearchParams(window.location.search).get('select') === '1';
  const hazard =
    (new URLSearchParams(window.location.search).get('hazard') as HazardType | null) ?? 'bushfire';

  try {
    const snapshot = await loadNspSnapshot(fetchImpl);
    const selection = selectSitesForPack(snapshot.sites, centre, lgaName, 5, hazard);
    const { ordered } = orderByDistance(
      selection.located.map((site) => toDestination(site, packId, snapshot)),
      centre,
    );
    const save = async (ids: string[]) => {
      const content = {
        pack: {
          id: packId,
          name: 'Kalorama',
          address: '6 RIDGE ROAD KALORAMA 3766',
          lat: centre.lat,
          lon: centre.lon,
          radiusKm: 6,
          lgaName,
          createdAt: destinationsNow,
          reminder: 'Follow official information during an emergency.',
          sources: [snapshot.source],
          ...(hazard === 'bushfire' ? {} : { hazardType: hazard }),
        },
        layers: [],
        destinations: destinationsForPack(
          chosenDestinations(ordered, ids),
          packId,
          snapshot,
          area,
          hazard,
        ),
        recovery: [],
      };
      const offer = await createPackOffer(content);
      await saveTextOnlyPack(content, offer, destinationsNow);
    };
    destinationsFlow = (
      <Destinations
        ordered={ordered}
        unlocated={selection.unlocated.map((site) => toDestination(site, packId, snapshot))}
        area={area}
        status={hazard === 'bushfire' ? undefined : 'not-bushfire'}
        save={selectable ? save : undefined}
        now={destinationsNow}
      />
    );
  } catch {
    destinationsFlow = (
      <Destinations
        ordered={[]}
        unlocated={[]}
        area={area}
        status="unavailable"
        now={destinationsNow}
      />
    );
  }
}

// Nearby places at a fixed instant (4:00 pm in Melbourne), seeded straight into
// the four stores so the offline states of spec §9 AC4–AC6 are exact. The
// harness has no API, so every sync fails exactly as it would with the radios off.
const nearbyMode = new URLSearchParams(window.location.search).get('mode') ?? 'cached';
const nearbyNow = Date.UTC(2026, 8, 2, 6);
let nearbyFlow = confirmation;
if (window.location.pathname === '/nearby') {
  await Promise.all(db.tables.map((table) => table.clear()));
  if (nearbyMode !== 'empty') {
    const ago = (ms: number) => new Date(nearbyNow - ms).toISOString();
    const feedAge = nearbyMode === 'stale' ? 3 * 3_600_000 : 10 * 60_000;
    const verified = ago(2 * 86_400_000);
    await db.staticFacilities.bulkAdd([
      { facility_id: 1, type: 'NSP', name: 'Kalorama Memorial Reserve', address: 'Ridge Road, Kalorama', lat: -37.808, lon: 145.36, lga_name: 'Yarra Ranges', designation_status: 'designated', last_verified_at: verified },
      { facility_id: 2, type: 'CFR', name: 'Ferny Creek Community Fire Refuge', address: 'School Road, Ferny Creek 3786', lat: -37.88323, lon: 145.333062, lga_name: 'Yarra Ranges', designation_status: 'designated', last_verified_at: verified },
    ]);
    await db.postcodes.bulkAdd([{ postcode: '3766', centroid_lat: -37.813, centroid_lon: 145.362 }]);
    await db.dynamicSnapshot.bulkAdd([
      { activation_id: 1, type: 'RELIEF', name: 'Lilydale Community Centre', address: 'Lilydale', lat: -37.756, lon: 145.35, source_updated_at: ago(feedAge) },
    ]);
    await db.syncMeta.bulkAdd([
      { key: 'static_synced_at', value: ago(2 * 3_600_000) },
      { key: 'static_version', value: '2026-09-01T02:00:00.000Z' },
      { key: 'data_health', value: JSON.stringify({ cfa_nsp_arcgis: { status: 'healthy', last_success_at: ago(86_400_000) }, cfr_static_list: { status: 'healthy', last_success_at: ago(86_400_000) } }) },
      { key: 'dynamic_synced_at', value: ago(feedAge) },
      { key: 'dynamic_generated_at', value: ago(feedAge) },
      { key: 'dynamic_source_status', value: 'healthy' },
      { key: 'dynamic_source_last_success_at', value: ago(feedAge) },
    ]);
  }
  nearbyFlow = <Nearby now={nearbyNow} fetcher={async () => { throw new Error('no network'); }} />;
}

const offerShouldFail = new URLSearchParams(window.location.search).get('offer') === 'fail';
const areaFlow = (
  <Search
    search={async () => ({ candidates: [testCandidate], unresolvedCount: 0, returnedCount: 1 })}
    checkArea={areaMode === 'offline' ? undefined : syntheticAreaCheck}
    loadFiles={noFiles}
    buildOffer={offerShouldFail
      ? async () => { throw new Error('synthetic pack-offer failure'); }
      : undefined}
    onPendingPlace={(place) => { window.__confirmedPlace = place; }}
  />
);

// Screens link back to the pack list, so they need router context. The
// harness has no routes of its own, so ONE in-memory router keeps every
// component mountable in isolation without a second application shell.
createRoot(root).render(
  <StrictMode>
    <MemoryRouter>
    {window.location.pathname === '/home' ? homeFlow
      : window.location.pathname === '/conflict' ? conflictFlow
      : window.location.pathname === '/area' ? areaFlow
        : window.location.pathname === '/size' ? sizeFlow
        : window.location.pathname === '/destinations' ? destinationsFlow
        : window.location.pathname === '/nearby' ? nearbyFlow
        : window.location.pathname === '/detail' || window.location.pathname === '/detail-launch'
          ? detailFlow
        : window.location.pathname === '/search' ? (
      <Search loadFiles={noFiles} onPendingPlace={(place) => { window.__confirmedPlace = place; }} />
    ) : confirmation}
    </MemoryRouter>
  </StrictMode>,
);