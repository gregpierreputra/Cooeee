import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';

import type { Destination, ExposureLayer, HazardType, NspSnapshot, Pack, PackFile, PackProgram, PendingPlace, RecoveryProgram, TextPackContent } from '../../src/core/types';
import { absenceRow, chosenDestinations, orderByDistance } from '../../src/core/destination';
import { DTP_DATASET_URL } from '../../src/core/constants';
import { destinationsForPack, selectSitesForPack, toDestination } from '../../src/core/nsp';
import { createPackOffer, discardBuildingPack, saveTextOnlyPack, stageTextOnlyPack } from '../../src/data/pack-build';
import { db } from '../../src/data/db';
import { fileMeta, manifestGroup, sha256Hex } from '../../src/data/integrity';
import { loadNspSnapshot } from '../../src/data/nsp';
import BlackSky from '../../src/ui/BlackSky';
import Home from '../../src/ui/Home';
import Nearby from '../../src/ui/Nearby';
import PackDetail from '../../src/ui/PackDetail';
import Recover from '../../src/ui/Recover';
import Choose from '../../src/ui/Rehearsal/Choose';
import RehearsalEntry from '../../src/ui/Rehearsal/Entry';
import { startRun } from '../../src/ui/Rehearsal/run-state';
import AppHeader from '../../src/ui/components/AppHeader';
import BackBar from '../../src/ui/components/BackBar';
import BottomNav from '../../src/ui/components/BottomNav';
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

// The saved pack carries the one candidate's own address: confirming that
// address is what reaches the keep-or-replace step.
if (window.location.pathname === '/conflict' && await db.packs.count() === 0) {
  await db.packs.put({ ...savedPack, address: testCandidate.address });
}

const conflictMode = new URLSearchParams(window.location.search).get('mode');
const conflictFlow = (
  <Search
    search={async () => ({ candidates: [testCandidate], returnedCount: 1 })}
    checkArea={syntheticAreaCheck}
    loadFiles={noFiles}
    loadPacks={conflictMode === 'unavailable'
      ? async () => { throw new Error('synthetic store failure'); }
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
  recovery: [{ ...recoveryProgram, id: 'new-pack:services-australia-example', packId: 'new-pack', programId: 'services-australia-example' }],
};

let sizeFlow = confirmation;
if (window.location.pathname === '/size') {
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
const detailRecovery: PackProgram = {
  ...recoveryProgram,
  id: 'detail-pack:services-australia-example',
  packId: 'detail-pack',
  programId: 'services-australia-example',
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
  // A synthetic PDF copy of the dataset page, so the file link renders here.
  const bytes = new TextEncoder().encode('%PDF-1.7 synthetic').buffer;
  const detailFile: PackFile = {
    id: 'detail-pack:bpa.pdf', packId: 'detail-pack', url: DTP_DATASET_URL, name: 'bpa.pdf',
    retrievedAt: detailSavedAt, sizeBytes: bytes.byteLength, sha256: await sha256Hex(bytes), bytes,
  };
  // The saved program's own page copy, so its file link renders here.
  const programFile: PackFile = { ...detailFile, id: 'detail-pack:program.pdf', url: detailRecovery.officialUrl, name: 'program.pdf' };
  // Real hashes: the reads re-verify every group against the manifest.
  await db.packs.put({
    ...savedPack,
    id: 'detail-pack',
    name: 'Kalorama',
    address: testCandidate.address,
    verifiedAt: detailSavedAt,
    manifest: {
      version: 1,
      groups: {
        layers: await manifestGroup([detailLayer]),
        destinations: await manifestGroup([detailDestination]),
        recovery: await manifestGroup([detailRecovery]),
        tiles: { count: 0, bytes: 0 },
        files: await manifestGroup([fileMeta(detailFile), fileMeta(programFile)]),
      },
    },
  });
  await db.layers.put(detailLayer);
  await db.destinations.put(detailDestination);
  // E5-US5. ?mode=rehearsed: the pack has been rehearsed once, and walked.
  if (detailMode === 'rehearsed') {
    await db.rehearsals.put({
      id: 'detail-run',
      packId: 'detail-pack',
      condition: 'no-data',
      startedAt: Date.UTC(2026, 2, 3, 1),
      finishedAt: Date.UTC(2026, 2, 3, 1, 14),
      ending: 'walked',
      elapsedMs: 14 * 60_000,
      gaps: [],
    });
  }
  await db.packPrograms.put(detailRecovery);
  await db.files.bulkPut([detailFile, programFile]);
}

// Recover at a fixed instant, from the programs on the device and no pack.
// ?mode=none leaves nothing on the device; ?mode=stale back-dates the snapshot
// past RECOVERY_STALE_DAYS.
const recoverMode = new URLSearchParams(window.location.search).get('mode') ?? 'cached';
const recoverNow = Date.UTC(2026, 8, 11, 6);
const recoverSnapshotAt = recoverMode === 'stale' ? Date.UTC(2026, 4, 1) : Date.UTC(2026, 8, 9);
const recoverSnapshotDate = new Date(recoverSnapshotAt).toISOString().slice(0, 10);
const recoverPrograms: RecoveryProgram[] = [
  {
    ...recoveryProgram,
    id: 'recover:payment',
    title: 'Example disaster payment',
    needs: ['money', 'property'],
    telephone: '180 22 66',
    snapshotDate: recoverSnapshotDate,
    source: { ...recoveryProgram.source, retrievedAt: recoverSnapshotAt },
  },
  {
    id: 'recover:coping',
    org: 'Australian Red Cross',
    title: 'Coping after a crisis',
    covers: 'Where to find someone to talk to after an emergency.',
    needs: ['health'],
    officialUrl: 'https://www.redcross.org.au/emergencies/coping-after-a-crisis/',
    snapshotDate: recoverSnapshotDate,
    source: {
      publisher: 'Australian Red Cross',
      url: 'https://www.redcross.org.au/emergencies/coping-after-a-crisis/',
      licence: 'Link only, all rights reserved',
      retrievedAt: recoverSnapshotAt,
    },
  },
];
let recoverFlow = confirmation;
if (window.location.pathname === '/recover') {
  await Promise.all(db.tables.map((table) => table.clear()));
  if (recoverMode !== 'none') await db.programs.bulkPut(recoverPrograms);
  // ?mode=saved: a pack already carries the first program.
  if (recoverMode === 'saved') {
    await db.packs.put(savedPack);
    await db.packPrograms.put({ ...recoverPrograms[0], id: `${savedPack.id}:recover:payment`, packId: savedPack.id, programId: 'recover:payment' });
  }
  recoverFlow = <Recover now={recoverNow} />;
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
const homePacks = Number(new URLSearchParams(window.location.search).get('packs') ?? '1');
let homeFlow = confirmation;
if (window.location.pathname === '/home') {
  await Promise.all(db.tables.map((table) => table.clear()));
  if (homeMode !== 'none') {
    await db.packs.put({ ...savedPack, verifiedAt: homeNow - homeDays * 86_400_000 });
  }
  // A second, one-day-fresher pack, so the list has an order to assert.
  if (homePacks > 1) {
    await db.packs.put({
      ...savedPack,
      id: 'second-pack',
      name: 'Kalorama',
      address: testCandidate.address,
      lat: testCandidate.lat,
      lon: testCandidate.lon,
      verifiedAt: homeNow - (homeDays - 1) * 86_400_000,
    });
  }
  // ?mode=kept: one pack, the programs table, and a kept id no pack carries yet;
  // Home mirrors it into the pack on arrival, so no nudge is shown.
  if (homeMode === 'kept') {
    await db.programs.put(recoveryProgram);
    window.localStorage.setItem('cooeee.kept.v1', JSON.stringify([recoveryProgram.id]));
  }
  homeFlow = (
    <>
      <AppHeader now={homeNow} />
      <Home now={homeNow} />
      <BottomNav />
    </>
  );
}

// The BlackSky pack picker: two complete packs, in the mode's own colours.
// Headless Chromium denies geolocation, so the chosen pack shows as reference
// text with its mark control.
let blackSkyFlow = confirmation;
if (window.location.pathname === '/blacksky') {
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.packs.bulkPut([
    savedPack,
    {
      ...savedPack,
      id: 'second-pack',
      name: 'Kalorama',
      address: testCandidate.address,
      lat: testCandidate.lat,
      lon: testCandidate.lon,
    },
  ]);
  document.documentElement.dataset.mode = 'blacksky';
  // E5-US3-AC3. `run=1` arrives from a running rehearsal of the first pack.
  if (new URLSearchParams(window.location.search).get('run') === '1') {
    startRun('saved-pack', 'no-location-fix');
  }
  // BS_Enhancement-AC1 and AC2. `dial=` mounts the real screen over stores the
  // spec can read at a glance: one pack at Ferny Creek with two chosen places
  // and a note, and the fixture's state-wide list, whose nearest site (Belgrave,
  // 2.1 km) is NEARER than either chosen place. The names are written as the
  // CFA writes them, brackets and all. `pack` stores that pack, `no-pack` stores
  // none, `empty` stores neither a pack nor a list, and `pack-only` stores the
  // pack with its note but no place and no list, so in the last two a position
  // has nothing to point at. The spec supplies the position.
  const dialMode = new URLSearchParams(window.location.search).get('dial');
  const dialPlace = (id: string, name: string, lat: number): Destination => ({
    id: `saved-pack:${id}`,
    packId: 'saved-pack',
    kind: 'nsp-bushfire',
    name,
    geocode: 'exact',
    lat,
    lon: savedPack.lon,
    chosen: true,
    source: nspFixture.source,
  });
  const dialPacks = [{
    pack: savedPack,
    places: [
      dialPlace('nsp-north', 'Sassafras (Village Green (car park)) Neighbourhood Safer Place', -37.8566),
      dialPlace('nsp-south', 'Belgrave South (Community Hall) Neighbourhood Safer Place', -37.9115),
    ],
    notes: [{ id: 'dial-note', packId: 'saved-pack', text: 'Gas is off at the meter.', updatedAt: savedPack.createdAt }],
    placesVerified: true,
  }];
  blackSkyFlow = (
    <>
      {dialMode ? (
        <BlackSky
          loadPacks={async () =>
            dialMode === 'pack' ? dialPacks
              : dialMode === 'pack-only' ? [{ ...dialPacks[0], places: [] }]
                : []}
          loadSites={async () =>
            dialMode === 'empty' || dialMode === 'pack-only' ? undefined : (nspFixture as NspSnapshot)}
        />
      ) : (
        <BlackSky />
      )}
      <div hidden>
        <LocationProbe />
      </div>
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

// E5-US1-AC4. The rehearsal entry gate, at a fixed instant, over a pack seeded
// straight into IndexedDB so the two demonstrable states are exact rather than
// clock- or build-dependent. The gate reads the device through the real
// readRehearsalSource, so what is asserted is the real path.
const rehearseMode = new URLSearchParams(window.location.search).get('mode') ?? 'empty';
const rehearseNow = Date.UTC(2026, 8, 3, 2);
let rehearseFlow = confirmation;
// `keep=1` seeds only when the pack is not already there, so a reload preserves
// what the previous load wrote. Without it every load starts from a clean
// device, which is what the cold-start tests need and what would make a
// survives-a-reload test impossible to write.
const rehearseKeep = new URLSearchParams(window.location.search).get('keep') === '1';
if (window.location.pathname === '/rehearse' && !(rehearseKeep && (await db.packs.count()) > 0)) {
  await Promise.all(db.tables.map((table) => table.clear()));
  // 3 March 2026 in Melbourne, so the saved date on screen is the exact
  // day, full month, year form.
  const rehearseSavedAt = Date.UTC(2026, 2, 3);
  // A pack of absences: the layer is published and maps nothing at the
  // address, and the CFA list publishes no place for the area. Both are real
  // stored rows, and neither is something to rehearse.
  //
  // 'rehearsable' is the one mode whose layer records a designation PRESENT at
  // the address. The status is chosen HERE, before the manifest is built, so
  // the stored row still hashes to what the pack recorded: a row altered after
  // the manifest would be withheld, and the gate would report the pack
  // unreadable rather than rehearsable.
  const rehearseLayer: ExposureLayer = {
    id: 'rehearse-pack:BPA',
    packId: 'rehearse-pack',
    group: 'designation',
    code: 'BPA',
    status: rehearseMode === 'rehearsable' || rehearseMode === 'gap' ? 'present' : 'none-mapped-here',
    features: [],
    checkedAt: rehearseSavedAt,
    source: { ...packSource, retrievedAt: rehearseSavedAt },
  };
  const rehearseAbsence = absenceRow('rehearse-pack', 'Yarra Ranges', {
    ...cfaSource,
    retrievedAt: rehearseSavedAt,
  });
  // 'rehearsable' saves an official place as well, so the pack holds the whole
  // journey and a no-data run finds nothing missing. Every other mode holds the
  // absence row alone, so the same run finds a pack-content gap beside whatever
  // the condition itself takes away.
  //
  // The rows are decided HERE, before the manifest, and the manifest is built
  // from exactly these rows. A row added after the manifest would not hash to
  // what the pack recorded, and the read would withhold the whole group: the
  // gate would call the pack unreadable and no rehearsal would run at all.
  const rehearsePlaces: Destination[] =
    rehearseMode === 'rehearsable'
      ? [
          rehearseAbsence,
          {
            id: 'rehearse-pack:nsp',
            packId: 'rehearse-pack',
            kind: 'nsp-bushfire',
            name: 'Kalorama Reserve',
            addressText: 'Kalorama Memorial Reserve Road, Kalorama',
            source: { ...cfaSource, retrievedAt: rehearseSavedAt },
          },
        ]
      : [rehearseAbsence];
  await db.packs.put({
    ...savedPack,
    id: 'rehearse-pack',
    name: 'Kalorama',
    address: testCandidate.address,
    verifiedAt: rehearseSavedAt,
    manifest: {
      version: 1,
      groups: {
        layers: await manifestGroup([rehearseLayer]),
        destinations: await manifestGroup(rehearsePlaces),
        recovery: { count: 0, sha256: '' },
        tiles: { count: 0, bytes: 0 },
      },
    },
  });
  await db.layers.put(rehearseLayer);
  // 'empty' stores exactly the row the manifest hashed. 'unreadable' stores a
  // row altered after the save, so the group no longer matches its own hash
  // and the read withholds it — the real "could not be read" path, not a
  // simulated one.
  await db.destinations.bulkPut(
    rehearseMode === 'unreadable'
      ? [{ ...rehearseAbsence, reason: 'Altered on the device after the pack was saved.' }]
      : rehearsePlaces,
  );
  // E5-US7. ?notes=1: the pack carries one note of her own.
  if (new URLSearchParams(window.location.search).get('notes') === '1') {
    await db.notes.put({ id: 'rehearse-note', packId: 'rehearse-pack', text: 'Gas is off at the meter.', updatedAt: rehearseSavedAt });
  }
  // E5-US1-AC3. Leaving the rehearsal screen and coming back within the same
  // session must keep the run. In the running app that is a route change; here
  // it is an unmount and a remount of the same component, which is the same
  // thing from the run's point of view and needs no second application shell.
  // A reload is what a cold start looks like, and needs no control at all.
  // E5-US2-AC2/AC4. `earlier=` seeds a rehearsal that already happened, so the
  // next run has something to compare against. Its value chooses what that
  // earlier run knew:
  //   same    — same pack content and the same gaps, so nothing moved
  //   changed — a different packVerifiedAt, so the pack was built again between
  //   unknown — recorded before the pack's verified date was kept, so whether
  //             the pack changed cannot be said
  const seeded = new URLSearchParams(window.location.search).get('earlier');
  if (seeded) {
    const earlierPackVerifiedAt =
      seeded === 'changed' ? Date.UTC(2026, 1, 1) : rehearseSavedAt;
    await db.rehearsals.put({
      id: 'earlier-run',
      packId: 'rehearse-pack',
      condition: 'no-location-fix',
      startedAt: Date.UTC(2026, 2, 1),
      finishedAt: Date.UTC(2026, 2, 1),
      ...(seeded === 'unknown' ? {} : { packVerifiedAt: earlierPackVerifiedAt }),
      // The earlier run found the contingency only, so a pack-content gap in
      // the later run reads as one the earlier run did not find.
      gaps: [
        {
          gapType: 'live-direction-unavailable' as const,
          kind: 'condition-persistent' as const,
          hazard: 'bushfire' as const,
        },
      ],
    });
  }
  rehearseFlow = <RehearsalHarness />;
}
if (window.location.pathname === '/rehearse') rehearseFlow = <RehearsalHarness />;


// The remount control is HARNESS FURNITURE, not product UI. It is rendered
// after the screen under test and outside its .page container, so it can never
// sit above the rehearsal bar: in the product the bar is the topmost thing on a
// run, and a harness control above it would make "visible without scrolling"
// read as passing for the wrong reason. Its styling is deliberately unlike
// anything in the product, and it says what it is.
const harnessStyle = {
  margin: '2rem 0 0',
  padding: '0.5rem',
  borderTop: '1px dashed #888',
  font: '12px ui-monospace, SFMono-Regular, Menlo, monospace',
  color: '#888',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
} as const;

const harnessButtonStyle = {
  appearance: 'none',
  background: 'transparent',
  border: '1px dashed currentColor',
  borderRadius: 0,
  color: 'inherit',
  font: 'inherit',
  minHeight: 'auto',
  minWidth: 'auto',
  padding: '2px 6px',
  cursor: 'pointer',
} as const;

/** Harness furniture: where the in-memory router is, so a spec can see a control
 *  navigate — the journey screen's hold goes to /blacksky — without the harness
 *  growing routes of its own. */
function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="location">{pathname}</span>;
}

const REHEARSE_PATH = '/rehearse/rehearse-pack';

function RehearsalHarness() {
  const [mounted, setMounted] = useState(true);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // The app reaches this screen at its own path, and only BlackSky leaves it.
  // The harness has no routes, so a control that navigates elsewhere (Leave
  // goes to the pack page) is brought back here, as opening the screen again
  // in the app would; BlackSky is left alone so a spec can see the hold land.
  useEffect(() => {
    if (mounted && pathname !== REHEARSE_PATH && !pathname.startsWith('/blacksky')) {
      navigate(REHEARSE_PATH, { replace: true });
    }
  }, [mounted, pathname, navigate]);
  return (
    <>
      {/* The app's back bar carries the rehearsal bar, so it is part of the screen under test. */}
      {mounted ? (
        <>
          <BackBar />
          <RehearsalEntry packId="rehearse-pack" now={rehearseNow} />
        </>
      ) : null}
      <div style={harnessStyle} data-harness="true">
        <span>test harness</span>
        <LocationProbe />
        <button
          type="button"
          data-testid="remount"
          style={harnessButtonStyle}
          onClick={() => {
            // Mounting again is her return from BlackSky, which lands on the rehearsal path.
            if (!mounted) navigate(REHEARSE_PATH, { replace: true });
            setMounted((on) => !on);
          }}
        >
          {mounted ? 'unmount the screen' : 'mount it again'}
        </button>
      </div>
    </>
  );
}

// E5-US3-AC2. The bar's Rehearse before a pack is known: `packs=` seeds that
// many complete packs (0, 1 or 2), newest first by their saved date.
let chooseFlow = confirmation;
if (window.location.pathname === '/rehearse-choose') {
  await Promise.all(db.tables.map((table) => table.clear()));
  const count = Number(new URLSearchParams(window.location.search).get('packs') ?? '2');
  await db.packs.bulkPut(
    [
      savedPack,
      { ...savedPack, id: 'second-pack', name: 'Kalorama', address: testCandidate.address, verifiedAt: savedPack.verifiedAt + 1 },
    ].slice(0, count),
  );
  chooseFlow = (
    <>
      <Choose />
      <div style={harnessStyle} data-harness="true">
        <LocationProbe />
      </div>
    </>
  );
}

const offerShouldFail = new URLSearchParams(window.location.search).get('offer') === 'fail';
const areaFlow = (
  <Search
    search={async () => ({ candidates: [testCandidate], returnedCount: 1 })}
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
// The rehearsal harness starts on its own path, as the app does, so the back
// bar (which hides on the home path) is on screen and carries the rehearsal bar.
const initialEntries = window.location.pathname === '/rehearse' ? [REHEARSE_PATH] : undefined;

createRoot(root).render(
  <StrictMode>
    <MemoryRouter initialEntries={initialEntries}>
    {window.location.pathname === '/home' ? homeFlow
      : window.location.pathname === '/blacksky' ? blackSkyFlow
      : window.location.pathname === '/conflict' ? conflictFlow
      : window.location.pathname === '/area' ? areaFlow
        : window.location.pathname === '/size' ? sizeFlow
        : window.location.pathname === '/destinations' ? destinationsFlow
        : window.location.pathname === '/nearby' ? nearbyFlow
        : window.location.pathname === '/recover' ? recoverFlow
        : window.location.pathname === '/rehearse' ? rehearseFlow
        : window.location.pathname === '/rehearse-choose' ? chooseFlow
        : window.location.pathname === '/detail' || window.location.pathname === '/detail-launch'
          ? detailFlow
        : window.location.pathname === '/search' ? (
      <Search loadFiles={noFiles} onPendingPlace={(place) => { window.__confirmedPlace = place; }} />
    ) : confirmation}
    </MemoryRouter>
  </StrictMode>,
);