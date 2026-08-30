# Epic 1 Code Evidence Appendix

**Purpose:** focused source evidence requested in the senior tutor's initial review<br>
**Primary review-fix snapshot:** `45506cfc4dcda372526f84f31d92e9600d4795a9`<br>
**Service-worker evidence update:** `9ec8906ffc1708e301c6fb37ef4dbcafc09365d2`<br>
**Generated:** 30 August 2026

This appendix copies the requested files in full so the reviewer can inspect the risk-bearing code without receiving the whole repository. The Git commit above is authoritative if a pasted excerpt and repository history ever differ.

## Tier 1 — area decision

Repository path: `src/core/area-check.ts`

```ts
import * as copy from './copy';
import { formatSavedDate } from './provenance';
import type { BushfireAreaResult, LayerPublicationStatus, LayerStatus } from './types';

export { formatSavedDate } from './provenance';

/** A positive point hit controls immediately. For zero hits, the live
 * existence probe controls; the snapshot is an independent drift check. */
export function resolveBushfireAreaStatus(
  pointHits: number,
  publication: LayerPublicationStatus,
): LayerStatus {
  if (pointHits > 0) return 'present';
  if (publication === 'unknown') return 'unknown';
  return publication === 'published' ? 'none-mapped-here' : 'not-published';
}

export function extentSnapshotDisagrees(
  snapshotPublishedIn: readonly string[],
  lgaName: string,
  liveLayerExistsInLga: boolean,
): boolean {
  return snapshotPublishedIn.includes(lgaName) !== liveLayerExistsInLga;
}

export type AreaCheckView = {
  resultLine: string;
  publisherLine: string;
  priorityLine: string;
};

/** Keep the three honest domain states exhaustive for rendering. */
export function areaCheckView(result: BushfireAreaResult): AreaCheckView {
  const publisherLine = copy.DTP_SAVED_DATE(formatSavedDate(result.checkedAt));
  switch (result.status) {
    case 'present':
      return {
        resultLine: copy.INSIDE_BUSHFIRE_AREA,
        publisherLine,
        priorityLine: copy.OFFICIAL_INSTRUCTIONS_FIRST,
      };
    case 'none-mapped-here':
      return {
        resultLine: copy.NOTHING_MAPPED_AT_ADDRESS,
        publisherLine,
        priorityLine: copy.OFFICIAL_INSTRUCTIONS_FIRST,
      };
    case 'not-published':
      return {
        resultLine: copy.AREA_NOT_PUBLISHED,
        publisherLine,
        priorityLine: copy.OFFICIAL_INSTRUCTIONS_FIRST,
      };
  }
}
```

## Tier 1 — staging, verification and atomic exposure

Repository path: `src/data/pack-build.ts`

```ts
import { canonicalJson, exactTextBytes, offerMatchesStoredSize } from '../core/pack-offer';
import { hasCompleteSource, prepareProvenancedContent, type OmittedItem } from '../core/provenance';
import type {
  Pack,
  PackManifest,
  PackOffer,
  RecoveryProgram,
  TextPackContent,
} from '../core/types';
import { db } from './db';
import { manifestGroup } from './integrity';

export type TileOfferMetadata = {
  bytes: number;
  count: number;
  available: boolean;
};

function assertContent(content: TextPackContent): void {
  if (content.pack.sources.length === 0 || content.pack.sources.some((source) => !hasCompleteSource(source))) {
    throw new TypeError('pack must carry complete source provenance');
  }
  if (content.layers.some((row) => row.packId !== content.pack.id || !hasCompleteSource(row.source))) {
    throw new TypeError('every layer must belong to the pack and carry complete source provenance');
  }
  if (content.destinations.some((row) => row.packId !== content.pack.id || !hasCompleteSource(row.source))) {
    throw new TypeError('every destination must belong to the pack and carry complete source provenance');
  }
  if (content.recovery.some((row) => !hasCompleteSource(row.source))) {
    throw new TypeError('every recovery item must carry complete source provenance');
  }
}

async function textManifest(content: TextPackContent): Promise<PackOffer['textManifest']> {
  return {
    layers: await manifestGroup(content.layers),
    destinations: await manifestGroup(content.destinations),
    recovery: await manifestGroup(content.recovery),
  };
}

async function createPreparedPackOffer(
  content: TextPackContent,
  tiles: TileOfferMetadata,
  omittedItems: OmittedItem[],
): Promise<PackOffer> {
  assertContent(content);
  if (!Number.isInteger(tiles.bytes) || tiles.bytes < 0) {
    throw new RangeError('tile bytes must be a non-negative integer');
  }
  if (!Number.isInteger(tiles.count) || tiles.count < 0) {
    throw new RangeError('tile count must be a non-negative integer');
  }
  return {
    version: 1,
    textBytes: exactTextBytes(content),
    tileBytes: tiles.bytes,
    tileCount: tiles.count,
    tilesAvailable: tiles.available,
    omittedItems,
    textManifest: await textManifest(content),
  };
}

/** Produces AC9 metadata only. It performs no fetch and no device write. */
export async function createPackOffer(
  content: TextPackContent,
  tiles: TileOfferMetadata,
): Promise<PackOffer> {
  const prepared = prepareProvenancedContent(content);
  return createPreparedPackOffer(prepared.content, tiles, prepared.omittedItems);
}

function textOnlyManifest(offer: PackOffer): PackManifest {
  return {
    version: 1,
    groups: {
      ...offer.textManifest,
      tiles: { count: 0, bytes: 0 },
    },
  };
}

async function storedRecovery(rows: readonly RecoveryProgram[]): Promise<RecoveryProgram[]> {
  const stored = await db.programs.bulkGet(rows.map(({ id }) => id));
  if (stored.some((row) => row === undefined)) {
    throw new Error('a recovery item required by the pack is not present on the device');
  }
  return stored as RecoveryProgram[];
}

/** First AC9 write: one hidden building pack plus its owned text rows. */
export async function stageTextOnlyPack(
  content: TextPackContent,
  offer: PackOffer,
): Promise<void> {
  const prepared = prepareProvenancedContent(content);
  assertContent(prepared.content);
  const recovery = await storedRecovery(prepared.content.recovery);
  const rebuiltOffer = await createPreparedPackOffer({ ...prepared.content, recovery }, {
    bytes: offer.tileBytes,
    count: offer.tileCount,
    available: offer.tilesAvailable,
  }, prepared.omittedItems);
  if (canonicalJson(rebuiltOffer) !== canonicalJson(offer)) {
    throw new Error('pack offer no longer matches the proposed content');
  }

  const buildingPack: Pack = {
    ...content.pack,
    status: 'building',
    verifiedAt: 0,
    builtWithTiles: false,
    sizeBytes: { text: offer.textBytes, tiles: 0 },
    manifest: textOnlyManifest(offer),
  };

  await db.transaction('rw', db.packs, db.layers, db.destinations, async () => {
    if (await db.packs.get(buildingPack.id)) throw new Error('pack id already exists');
    await db.packs.add(buildingPack);
    await db.layers.bulkAdd(prepared.content.layers);
    await db.destinations.bulkAdd(prepared.content.destinations);
  });
}

/** Immediate transaction-safe cleanup. A complete pack is never removed here. */
export async function discardBuildingPack(packId: string): Promise<void> {
  await db.transaction('rw', db.packs, db.layers, db.destinations, db.tiles, async () => {
    const pack = await db.packs.get(packId);
    if (pack?.status !== 'building') return;
    await db.layers.where('packId').equals(packId).delete();
    await db.destinations.where('packId').equals(packId).delete();
    await db.tiles.where('packId').equals(packId).delete();
    await db.packs.delete(packId);
  });
}

/** Re-read and verify outside the final transaction, then atomically expose the
 * new pack and, when applicable, remove the superseded pack and owned rows. */
export async function verifyAndFinalizeTextOnlyPack(
  content: TextPackContent,
  offer: PackOffer,
  verifiedAt: number,
): Promise<void> {
  const staged = await db.packs.get(content.pack.id);
  if (staged?.status !== 'building') throw new Error('building pack is missing');
  const layers = await db.layers.where('packId').equals(staged.id).toArray();
  const destinations = await db.destinations.where('packId').equals(staged.id).toArray();
  const prepared = prepareProvenancedContent(content);
  const recovery = await storedRecovery(prepared.content.recovery);
  const verifiedOffer = await createPreparedPackOffer(
    {
      pack: prepared.content.pack,
      layers,
      destinations,
      recovery,
    },
    {
      bytes: offer.tileBytes,
      count: offer.tileCount,
      available: offer.tilesAvailable,
    },
    prepared.omittedItems,
  );
  if (canonicalJson(verifiedOffer) !== canonicalJson(offer)
    || !offerMatchesStoredSize(offer, staged.sizeBytes, false)
    || canonicalJson(staged.manifest) !== canonicalJson(textOnlyManifest(offer))) {
    throw new Error('staged pack failed manifest or size verification');
  }

  await db.transaction('rw', db.packs, db.layers, db.destinations, db.tiles, async () => {
    const current = await db.packs.get(staged.id);
    if (current?.status !== 'building') throw new Error('building pack changed before finalisation');
    const oldId = current.supersedes;
    if (oldId) {
      const old = await db.packs.get(oldId);
      if (old?.status !== 'complete') throw new Error('superseded complete pack is missing');
      await db.layers.where('packId').equals(oldId).delete();
      await db.destinations.where('packId').equals(oldId).delete();
      await db.tiles.where('packId').equals(oldId).delete();
      await db.packs.delete(oldId);
    }
    await db.packs.update(current.id, { status: 'complete', verifiedAt });
  });
}

export async function saveTextOnlyPack(
  content: TextPackContent,
  offer: PackOffer,
  verifiedAt: number,
): Promise<void> {
  try {
    await stageTextOnlyPack(content, offer);
    await verifyAndFinalizeTextOnlyPack(content, offer, verifiedAt);
  } catch (error) {
    await discardBuildingPack(content.pack.id);
    throw error;
  }
}
```

## Tier 1 — source interaction and focus

Repository path: `src/ui/PackDetail.tsx`

```tsx
import { useEffect, useRef, useState, type MouseEvent } from 'react';

import * as copy from '../core/copy';
import { decideOriginalSourceAccess, packDetailItems } from '../core/provenance';
import type { CompletePackContent, PackDetailItem } from '../core/types';
import { getCompletePackContent } from '../data/db';
import ProvenanceLine from './components/ProvenanceLine';
import StateCard from './components/StateCard';

export type PackDetailProps = {
  packId: string;
  loadContent?: (id: string) => Promise<CompletePackContent | undefined>;
  now?: number;
};

/** A network-blind pack view. Every value comes from the complete-pack store;
 * every source tap is intercepted before browser navigation and requires a
 * second explicit choice before leaving Cooeee. */
export default function PackDetail({
  packId,
  loadContent = getCompletePackContent,
  now = Date.now(),
}: PackDetailProps) {
  const [content, setContent] = useState<CompletePackContent | null | undefined>(null);
  const [offlineSource, setOfflineSource] = useState<PackDetailItem | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    loadContent(packId).then((value) => { if (live) setContent(value); });
    return () => { live = false; };
  }, [loadContent, packId]);

  useEffect(() => {
    if (offlineSource) closeRef.current?.focus();
  }, [offlineSource]);

  if (content === null) return null;
  if (content === undefined) {
    return <main className="page"><StateCard heading={copy.PACK_NOT_FOUND} /></main>;
  }

  const items = packDetailItems(content);
  const interceptSource = (event: MouseEvent<HTMLAnchorElement>, item: PackDetailItem) => {
    event.preventDefault();
    setOfflineSource(decideOriginalSourceAccess(item).item);
  };

  return (
    <main className="page pack-detail">
      <header>
        <h1>{copy.YOUR_PACK}</h1>
        <p>{content.pack.name}</p>
        <p className="muted">{content.pack.address}</p>
      </header>

      {!content.recoveryVerified ? (
        <StateCard heading={copy.RECOVERY_ITEMS_UNVERIFIED} />
      ) : null}

      {items.length === 0 ? (
        <StateCard heading={copy.NO_STORED_ITEMS} />
      ) : (
        <ul className="list pack-item-list">
          {items.map((item) => (
            <li key={item.id} className="card provenance-item">
              <h2>{item.name}</h2>
              <ProvenanceLine source={item.source} now={now} />
              <a
                href={item.source.url}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => interceptSource(event, item)}
              >
                {copy.OPEN_ORIGINAL_SOURCE}
              </a>
            </li>
          ))}
        </ul>
      )}

      {offlineSource ? (
        <div className="sheet-backdrop">
          <section
            className="card source-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="offline-source-heading"
          >
            <h2 id="offline-source-heading">{copy.SOURCE_IS_ON_WEB}</h2>
            <p>{copy.STORED_PROVENANCE_REMAINS}</p>
            <ProvenanceLine source={offlineSource.source} now={now} />
            <p>{copy.EXTERNAL_SOURCE_NOTICE}</p>
            <a href={offlineSource.source.url} target="_blank" rel="noreferrer">
              {copy.CONTINUE_TO_ORIGINAL_SOURCE}
            </a>
            <button ref={closeRef} type="button" onClick={() => setOfflineSource(null)}>
              {copy.CLOSE}
            </button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
```

## Tier 1 — provenance, age and source decision

Repository path: `src/core/provenance.ts`

```ts
import { MS_PER_DAY, OFFICIAL_DOMAINS, PACK_REFRESH_DAYS } from './constants';
import * as copy from './copy';
import type {
  CompletePackContent,
  LayerCode,
  PackDetailItem,
  Source,
  TextPackContent,
} from './types';

export type OmittedItem = { id: string; missing: 'publisher' | 'saved-date' };

export function missingDisplayProvenance(source: Source): OmittedItem['missing'] | null {
  if (typeof source.publisher !== 'string' || source.publisher.trim().length === 0) {
    return 'publisher';
  }
  if (!Number.isFinite(source.retrievedAt) || source.retrievedAt <= 0) return 'saved-date';
  return null;
}

export function hasCompleteSource(source: Source): boolean {
  return missingDisplayProvenance(source) === null
    && typeof source.url === 'string'
    && isAllowedSourceUrl(source.url)
    && typeof source.licence === 'string'
    && source.licence.trim().length > 0;
}

/** AC2 removes incomplete information items before any offer or write. Pack
 * identity sources are not optional items and remain a build-failing invariant. */
export function prepareProvenancedContent(content: TextPackContent): {
  content: TextPackContent;
  omittedItems: OmittedItem[];
} {
  const omittedItems: OmittedItem[] = [];
  const keep = <T extends { id: string; source: Source }>(row: T): boolean => {
    const missing = missingDisplayProvenance(row.source);
    if (!missing) return true;
    omittedItems.push({ id: row.id, missing });
    return false;
  };
  return {
    content: {
      ...content,
      layers: content.layers.filter(keep),
      destinations: content.destinations.filter(keep),
      recovery: content.recovery.filter(keep),
    },
    omittedItems,
  };
}

export function formatSavedDate(epochMs: number): string {
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Australia/Melbourne',
  }).format(epochMs);
}

export function savedAgeDays(now: number, savedAt: number): number {
  return Math.max(0, Math.floor((now - savedAt) / MS_PER_DAY));
}

export function provenanceView(now: number, source: Source): {
  publisherLine: string;
  ageLine: string;
  stale: boolean;
} {
  const days = savedAgeDays(now, source.retrievedAt);
  return {
    publisherLine: copy.PROVENANCE_LINE(source.publisher, formatSavedDate(source.retrievedAt)),
    ageLine: days === 0 ? copy.SAVED_TODAY : copy.ITEM_DAYS_AGO(days),
    stale: days > PACK_REFRESH_DAYS,
  };
}

export function isAllowedSourceUrl(urlText: string): boolean {
  try {
    const url = new URL(urlText);
    return url.protocol === 'https:' && OFFICIAL_DOMAINS.some(
      (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

const LAYER_NAMES: Record<LayerCode, string> = {
  BPA: copy.DESIGNATED_BUSHFIRE_PRONE_AREA,
  BMO: copy.BUSHFIRE_MANAGEMENT_OVERLAY,
  LSIO: copy.LAND_SUBJECT_TO_INUNDATION_OVERLAY,
  FO: copy.FLOODWAY_OVERLAY,
  SBO: copy.SPECIAL_BUILDING_OVERLAY,
};

export function packDetailItems(content: CompletePackContent): PackDetailItem[] {
  const items: PackDetailItem[] = [
    ...content.layers.map((row) => ({ id: row.id, name: LAYER_NAMES[row.code], source: row.source })),
    ...content.destinations.map((row) => ({
      id: row.id,
      name: row.name ?? copy.OFFICIAL_DESTINATION_INFORMATION,
      source: row.source,
    })),
    ...content.recovery.map((row) => ({ id: row.id, name: row.title, source: row.source })),
  ];
  if (content.pack.builtWithTiles) {
    const source = content.pack.sources.find(({ licence }) => licence === 'ODbL');
    if (source) items.push({ id: `${content.pack.id}:basemap`, name: copy.OFFLINE_BASEMAP, source });
  }
  return items;
}

export type OriginalSourceDecision = {
  kind: 'explain-before-open';
  item: PackDetailItem;
};

/** Opening a source is always a two-step, explicit choice. Connectivity is not
 * guessed from navigator.onLine because an interface can exist without a
 * working route to the source. */
export function decideOriginalSourceAccess(item: PackDetailItem): OriginalSourceDecision {
  return { kind: 'explain-before-open', item };
}
```

## Tier 1 — uncertainty and persisted record types

Repository path: `src/core/types.ts`

```ts
// Every record shape in the product. Pure types only — excluded from the coverage gate.
// Three fields carry an honesty guarantee rather than a value: Pack.status,
// ExposureLayer.status (three verified values; unknown is never persisted) and
// Destination.kind === 'absence'.

export type Source = {
  publisher: string; // 'Department of Transport and Planning'
  url: string; // the exact request or document URL
  licence: string; // 'CC BY 4.0' | 'ODbL' | 'CFA website list — permission to be confirmed'
  retrievedAt: number; // epoch ms
};

export type Pack = {
  id: string; // crypto.randomUUID()
  status: 'building' | 'complete'; // THE atomicity mechanism
  name: string; // editable at confirm; default = locality
  address: string; // confirmed ezi_address, echoed in full
  lat: number;
  lon: number;
  radiusKm: number; // PACK_RADIUS_KM
  lgaName: string;
  createdAt: number;
  verifiedAt: number; // freshness derives from THIS, not createdAt
  builtWithTiles: boolean;
  sizeBytes: { text: number; tiles: number };
  reminder: string; // the one short BlackSky reminder
  manifest: PackManifest;
  sources: Source[];
  supersedes?: string; // set by "update"; the old pack lives until acknowledged
};

export type PackManifest = {
  version: 1;
  groups: {
    layers: { count: number; sha256: string };
    destinations: { count: number; sha256: string };
    recovery: { count: number; sha256: string };
    tiles: { count: number; bytes: number }; // count 0 = the explicit text-only marker
  };
};

export type LayerCode = 'BPA' | 'BMO' | 'LSIO' | 'FO' | 'SBO';

/** Publication is not boolean: a failed or skipped probe is not evidence that
 * the layer is unpublished. */
export type LayerPublicationStatus = 'published' | 'unpublished' | 'unknown';

export type LayerStatus = 'present' | 'none-mapped-here' | 'not-published' | 'unknown';
export type VerifiedLayerStatus = Exclude<LayerStatus, 'unknown'>;

export type ExposureLayer = {
  id: string; // `${packId}:${code}`
  packId: string;
  group: 'designation' | 'overlay' | 'history'; // three groups, never merged
  code: LayerCode;
  status: VerifiedLayerStatus; // an unknown check is never persisted as evidence
  features: {
    zoneCode?: string;
    description?: string;
    planNumber?: string;
    gazettalDate?: string;
  }[];
  checkedAt: number;
  source: Source;
  // NOTE: there is no geometry field, and there must never be one.
};

export type Destination = {
  id: string; // `${packId}:${nspId}` | `${packId}:absence`
  packId: string;
  kind: 'nsp-bushfire' | 'absence'; // absence is a REAL row
  name?: string;
  addressText?: string;
  council?: string;
  listAsAt?: string; // the CFA list's own date, e.g. '2026-08-18'
  geocode?: 'exact' | 'street' | 'township' | 'none';
  lat?: number;
  lon?: number; // absent when geocode === 'none'
  distanceM?: number; // absent when no lat/lon
  distanceOrder?: number; // display order ONLY, zero-based
  chosen?: boolean; // at most two true per pack; equal status
  reason?: string; // absence rows: why, and the area it covers
  source: Source;
  // NOTE: there is NO role, rank, priority or ordering-of-worth field here, and
  // there must never be one. Equal status is a property of the schema.
};

export type NeedKey = 'stay' | 'money' | 'food' | 'property' | 'health' | 'documents';

export type RecoveryProgram = {
  id: string;
  org: string;
  title: string;
  covers: string; // one plain-language line
  needs: NeedKey[];
  officialUrl: string; // allow-listed domain, checked at build time
  telephone?: string;
  sms?: string;
  snapshotDate: string; // ISO date
  declaration?: { lgaName: string; agrn?: string; status: string; checkedAt: number };
  source: Source;
};

export type ActionItem = {
  id: string;
  text: string;
  programId?: string;
  createdAt: number;
  done: boolean;
  doneAt?: number;
};

export type TileRow = { packId: string; z: number; x: number; y: number; bytes: Blob };

export type QueuedJob = {
  id: string;
  kind: 'recovery-refresh';
  lgaName: string;
  queuedAt: number;
  attempts: number;
  lastError?: string;
}; // carries NOTHING about the user

export type Pending = {
  id: string;
  kind: 'recovery';
  payload: RecoveryProgram[];
  diff: { added: string[]; removed: string[]; changed: string[] };
  fetchedAt: number;
};

export type Kv = { key: string; value: unknown };

export type Fix = { lat: number; lon: number; accuracyM: number; at: number };

export type ConnState = 'online' | 'no-data' | 'offline';

/** A geographic point in the order this codebase uses everywhere: named fields,
 *  never a positional pair, because the axis-order trap is the defect that
 *  returns HTTP 200 with zero matches. */
export type LatLon = { lat: number; lon: number };

/** A complete pack together with the destination rows stored against it —
 *  including any absence row. Referenced by deriveState(). */
export type PackWithPlaces = { pack: Pack; places: Destination[] };

/** A single address candidate returned by the address service. It remains in
 * memory until the user explicitly confirms it. */
export type AddressCandidate = {
  address: string;
  localityName: string;
  lat: number;
  lon: number;
};

/** Parsed Vicmap record metadata used only to filter and collapse candidates.
 * It remains in memory and is never part of a pending or complete pack. */
export type AddressRecord = {
  candidate: AddressCandidate;
  propertyStatus: string;
  isPrimary: boolean;
};

/** The confirmed, still in-memory selection. It is not a saved place and must
 * not be written to IndexedDB before the pack commit conditions are met. */
export type PendingPlace = {
  name: string;
  address: string;
  lat: number;
  lon: number;
};

/** A transient official BPA check. It remains in memory until the complete
 * pack pipeline persists an ExposureLayer in a later acceptance criterion. */
export type BushfireAreaResult = {
  status: VerifiedLayerStatus;
  checkedAt: number;
  lgaName: string;
  source: Source;
  snapshotDisagreed: boolean;
};

/** The versioned, device-generated AC9 build response. Metadata only: it
 * authorises no payload request or device write by itself. */
export type PackOffer = {
  version: 1;
  textBytes: number;
  tileBytes: number;
  tileCount: number;
  tilesAvailable: boolean;
  omittedItems: { id: string; missing: 'publisher' | 'saved-date' }[];
  textManifest: Omit<PackManifest['groups'], 'tiles'>;
};

/** Pack identity and provenance before builder-owned lifecycle fields exist. */
export type PackSeed = Omit<
  Pack,
  'status' | 'verifiedAt' | 'builtWithTiles' | 'sizeBytes' | 'manifest'
>;

/** Complete text content supplied to the local manifest builder. Recovery
 * rows are pre-seeded global snapshot records and are verified, not rewritten. */
export type TextPackContent = {
  pack: PackSeed;
  layers: ExposureLayer[];
  destinations: Destination[];
  recovery: RecoveryProgram[];
};

/** Raw rows behind one complete pack detail view. Recovery is shown only when
 * its global snapshot still matches the pack's recorded manifest. */
export type CompletePackContent = {
  pack: Pack;
  layers: ExposureLayer[];
  destinations: Destination[];
  recovery: RecoveryProgram[];
  recoveryVerified: boolean;
};

/** A local item ready for the shared provenance renderer. This is a view model,
 * not an IndexedDB record. */
export type PackDetailItem = {
  id: string;
  name: string;
  source: Source;
};
```

## Tier 1 — Dexie schema, indexes and complete-only reads

Repository path: `src/data/db.ts`

```ts
import Dexie, { type Table } from 'dexie';
import type {
  ActionItem,
  CompletePackContent,
  Destination,
  ExposureLayer,
  Kv,
  Pack,
  Pending,
  QueuedJob,
  RecoveryProgram,
  TileRow,
} from '../core/types';
import { manifestGroup } from './integrity';

// ONE database. All user data lives here and nowhere else — no server holds any
// of it, because none of it is ever transmitted.
class CooeeeDb extends Dexie {
  packs!: Table<Pack, string>;
  layers!: Table<ExposureLayer, string>;
  destinations!: Table<Destination, string>;
  programs!: Table<RecoveryProgram, string>;
  actions!: Table<ActionItem, string>;
  tiles!: Table<TileRow, [string, number, number, number]>;
  queue!: Table<QueuedJob, string>;
  pending!: Table<Pending, string>;
  kv!: Table<Kv, string>;

  constructor() {
    super('cooeee');
    // A SHIPPED VERSION IS NEVER MUTATED. A schema change is db.version(2) with
    // its own .upgrade(); Dexie applies every version above the stored one, in
    // order, on open.
    this.version(1).stores({
      packs: 'id, status, address',
      layers: 'id, packId',
      destinations: 'id, packId',
      programs: 'id',
      actions: 'id, createdAt',
      tiles: '[packId+z+x+y], packId',
      queue: 'id',
      pending: 'id',
      kv: 'key',
    });
  }
}

/** The database handle. src/data/ only — ESLint blocks importing it from src/ui/,
 * because a raw table read from a component is how a half-built pack becomes
 * visible. UI loaders must enter through the complete-pack guards below. */
export const db = new CooeeeDb();

/** THE read API — complete packs only. */
export const listCompletePacks = (): Promise<Pack[]> =>
  db.packs.where('status').equals('complete').toArray();

/** THE read API — one complete pack, or undefined. A building pack is
 *  indistinguishable from a pack that does not exist, which is the point. */
export const getCompletePack = async (id: string): Promise<Pack | undefined> => {
  const p = await db.packs.get(id);
  return p?.status === 'complete' ? p : undefined;
};

/** Load only children of an already sanctioned complete pack. Recovery rows are
 * returned only when the current local snapshot exactly matches its manifest. */
export async function getCompletePackContent(id: string): Promise<CompletePackContent | undefined> {
  const pack = await getCompletePack(id);
  if (!pack) return undefined;
  const [layers, destinations] = await Promise.all([
    db.layers.where('packId').equals(id).toArray(),
    db.destinations.where('packId').equals(id).toArray(),
  ]);
  const expectedRecovery = pack.manifest.groups.recovery;
  if (expectedRecovery.count === 0) {
    return { pack, layers, destinations, recovery: [], recoveryVerified: true };
  }
  const programs = await db.programs.toArray();
  const actualRecovery = await manifestGroup(programs);
  const recoveryVerified = actualRecovery.count === expectedRecovery.count
    && actualRecovery.sha256 === expectedRecovery.sha256;
  return {
    pack,
    layers,
    destinations,
    recovery: recoveryVerified ? programs : [],
    recoveryVerified,
  };
}

/** Delete every status:'building' pack and its children. Runs in main.tsx before
 *  render and immediately on every build cancel, so an interrupted download
 *  leaves orphaned rows only until the next start — and never a complete pack. */
export async function sweepBuilding(): Promise<void> {
  await db.transaction('rw', db.packs, db.layers, db.destinations, db.tiles, async () => {
    const ids = await db.packs.where('status').equals('building').primaryKeys();
    if (ids.length === 0) return;
    await db.packs.bulkDelete(ids);
    await db.layers.where('packId').anyOf(ids).delete();
    await db.destinations.where('packId').anyOf(ids).delete();
    await db.tiles.where('packId').anyOf(ids).delete();
  });
}

// There is no third read of `packs`. If you find yourself adding one, stop —
// you are about to make a partial pack visible.
```

## H3 evidence — startup sweep before render

Repository path: `src/main.tsx`

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App, { SW_UPDATE_EVENT } from './app';
import { sweepBuilding } from './data/db';
import './ui/theme.css';

// registerType: 'prompt' — the new shell waits until the user chooses it.
const updateSW = registerSW({
  onNeedRefresh: () => window.dispatchEvent(new Event(SW_UPDATE_EVENT)),
});

const root = createRoot(document.getElementById('root')!);

// Every 'building' pack and its children go before anything renders, so an
// interrupted build can never be observed as a saved place.
sweepBuilding().finally(() => {
  root.render(
    <StrictMode>
      <App applyUpdate={() => updateSW(true)} />
    </StrictMode>,
  );
});
```

## Tier 2 — meaningful area decision tests

Repository path: `tests/core/area-check.test.ts`

```ts
import { describe, expect, it } from 'vitest';

import {
  areaCheckView,
  extentSnapshotDisagrees,
  formatSavedDate,
  resolveBushfireAreaStatus,
} from '../../src/core/area-check';
import * as copy from '../../src/core/copy';
import type { BushfireAreaResult } from '../../src/core/types';

const result = (status: BushfireAreaResult['status']): BushfireAreaResult => ({
  status,
  checkedAt: Date.UTC(2026, 7, 28, 2),
  lgaName: 'YARRA RANGES',
  source: {
    publisher: 'Department of Transport and Planning',
    url: 'https://opendata.maps.vic.gov.au/geoserver/wfs',
    licence: 'CC BY 4.0',
    retrievedAt: Date.UTC(2026, 7, 28, 2),
  },
  snapshotDisagreed: false,
});

describe('E1-US1-AC5–AC7 area decisions', () => {
  it('maps a positive point hit to present regardless of the existence input', () => {
    expect(resolveBushfireAreaStatus(1, 'unknown')).toBe('present');
  });

  it('maps zero hits with a live LGA hit to none-mapped-here', () => {
    expect(resolveBushfireAreaStatus(0, 'published')).toBe('none-mapped-here');
  });

  it('maps zero hits with no live LGA hit to not-published', () => {
    expect(resolveBushfireAreaStatus(0, 'unpublished')).toBe('not-published');
  });

  it('keeps a failed or skipped publication probe unknown', () => {
    expect(resolveBushfireAreaStatus(0, 'unknown')).toBe('unknown');
  });

  it.each([
    [['YARRA RANGES'], 'YARRA RANGES', true, false],
    [[], 'MELBOURNE', false, false],
    [['YARRA RANGES'], 'YARRA RANGES', false, true],
    [[], 'MELBOURNE', true, true],
  ] as const)('detects snapshot/live disagreement', (publishedIn, lga, live, expected) => {
    expect(extentSnapshotDisagrees(publishedIn, lga, live)).toBe(expected);
  });

  it('formats the saved date with no leading zero', () => {
    expect(formatSavedDate(Date.UTC(2026, 2, 2, 1))).toBe('2 March 2026');
  });

  it('renders all three statuses with publisher/date and priority', () => {
    expect(areaCheckView(result('present'))).toEqual({
      resultLine: copy.INSIDE_BUSHFIRE_AREA,
      publisherLine: 'Published by the Department of Transport and Planning, saved 28 August 2026.',
      priorityLine: copy.OFFICIAL_INSTRUCTIONS_FIRST,
    });
    expect(areaCheckView(result('none-mapped-here')).resultLine).toBe(
      copy.NOTHING_MAPPED_AT_ADDRESS,
    );
    expect(areaCheckView(result('not-published')).resultLine).toBe(copy.AREA_NOT_PUBLISHED);
  });
});

describe('E1-US1-AC5–AC7 exact copy', () => {
  it('keeps presence and absence meanings separate', () => {
    expect(copy.INSIDE_BUSHFIRE_AREA).toBe(
      'This address is inside a Designated Bushfire Prone Area.',
    );
    expect(copy.NOTHING_MAPPED_AT_ADDRESS).toBe(
      'No Designated Bushfire Prone Area is mapped at this address in the current planning scheme.',
    );
    expect(copy.AREA_NOT_PUBLISHED).toBe(
      'The Designated Bushfire Prone Area is not published for this area — Department of Transport and Planning.',
    );
  });

  it('keeps failed-check wording distinct from absence', () => {
    expect(copy.AREA_CHECK_COULD_NOT_RUN).toBe(
      'We could not check the bushfire area for this address right now.',
    );
    expect(copy.AREA_NOT_SAVED).toBe(
      'Nothing has been saved. Your address is still here — try again when you have a connection.',
    );
  });
});
```

## Tier 2 — build and replacement integration tests

Repository path: `tests/data/pack-build.test.ts`

```ts
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import type { PackSeed, TextPackContent } from '../../src/core/types';
import {
  createPackOffer,
  discardBuildingPack,
  saveTextOnlyPack,
  stageTextOnlyPack,
  verifyAndFinalizeTextOnlyPack,
} from '../../src/data/pack-build';
import { db, listCompletePacks } from '../../src/data/db';
import { destination, pack, program, source } from '../fixtures';

function seed(over: Partial<PackSeed> = {}): PackSeed {
  const complete = pack();
  const { status, verifiedAt, builtWithTiles, sizeBytes, manifest, ...value } = complete;
  void status;
  void verifiedAt;
  void builtWithTiles;
  void sizeBytes;
  void manifest;
  return { ...value, ...over };
}

const recovery = program();
const content = (over: Partial<TextPackContent> = {}): TextPackContent => ({
  pack: seed(),
  layers: [{
    id: 'pack-1:BPA',
    packId: 'pack-1',
    group: 'designation',
    code: 'BPA',
    status: 'present',
    features: [{ planNumber: 'LEGL./25-138', gazettalDate: '10/07/2025' }],
    checkedAt: 1,
    source: source({ publisher: 'Department of Transport and Planning' }),
  }],
  destinations: [destination()],
  recovery: [recovery],
  ...over,
});

const tileMetadata = { bytes: 13_002_342, count: 120, available: true };

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.programs.put(recovery);
});

describe('E1-US1-AC9 offer preparation', () => {
  it('computes metadata without writing any store', async () => {
    const offer = await createPackOffer(content(), tileMetadata);
    expect(offer).toMatchObject({
      version: 1,
      tileBytes: 13_002_342,
      tileCount: 120,
      tilesAvailable: true,
      textManifest: {
        layers: { count: 1 }, destinations: { count: 1 }, recovery: { count: 1 },
      },
    });
    expect(await db.packs.count()).toBe(0);
    expect(await db.layers.count()).toBe(0);
    expect(await db.destinations.count()).toBe(0);
    expect(await db.tiles.count()).toBe(0);
  });

  it.each([
    [{ bytes: -1, count: 0, available: true }, 'tile bytes'],
    [{ bytes: 0, count: -1, available: true }, 'tile count'],
  ])('rejects invalid tile metadata', async (tiles, message) => {
    await expect(createPackOffer(content(), tiles)).rejects.toThrow(message);
  });

  it('requires provenance on every proposed item', async () => {
    const bad = content({
      destinations: [destination({ source: source({ publisher: '' }) })],
    });
    const offer = await createPackOffer(bad, tileMetadata);
    expect(offer.omittedItems).toEqual([
      { id: 'pack-1:nsp-0001', missing: 'publisher' },
    ]);
    expect(offer.textManifest.destinations.count).toBe(0);
  });

  it('omits an item with no saved date from both the offer and stored rows', async () => {
    const proposed = content({
      destinations: [destination({ source: source({ retrievedAt: 0 }) })],
    });
    const offer = await createPackOffer(proposed, tileMetadata);

    await saveTextOnlyPack(proposed, offer, 999);

    expect(offer.omittedItems).toEqual([
      { id: 'pack-1:nsp-0001', missing: 'saved-date' },
    ]);
    expect(await db.destinations.count()).toBe(0);
    expect((await listCompletePacks()).map(({ id }) => id)).toEqual(['pack-1']);
  });

  it('still rejects a retained item whose non-display provenance is incomplete', async () => {
    const bad = content({ destinations: [destination({ source: source({ licence: '' }) })] });
    await expect(createPackOffer(bad, tileMetadata)).rejects.toThrow('destination');
  });
});

describe('E1-US1-AC9 text-only staging and finalisation', () => {
  it('writes nothing before consent, then stores an exact zero-tile complete pack', async () => {
    const proposed = content();
    const offer = await createPackOffer(proposed, tileMetadata);
    expect(await listCompletePacks()).toEqual([]);

    await saveTextOnlyPack(proposed, offer, 999);

    const saved = await listCompletePacks();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      id: 'pack-1', status: 'complete', verifiedAt: 999, builtWithTiles: false,
      sizeBytes: { text: offer.textBytes, tiles: 0 },
      manifest: { groups: { tiles: { count: 0, bytes: 0 } } },
    });
    expect(await db.tiles.count()).toBe(0);
  });

  it('stage then cancel immediately removes every owned row', async () => {
    const proposed = content();
    const offer = await createPackOffer(proposed, tileMetadata);
    await stageTextOnlyPack(proposed, offer);
    expect(await listCompletePacks()).toEqual([]);

    await discardBuildingPack(proposed.pack.id);

    expect(await db.packs.count()).toBe(0);
    expect(await db.layers.count()).toBe(0);
    expect(await db.destinations.count()).toBe(0);
    expect(await db.tiles.count()).toBe(0);
  });

  it('rejects tampering and can then clean the hidden build', async () => {
    const proposed = content();
    const offer = await createPackOffer(proposed, tileMetadata);
    await stageTextOnlyPack(proposed, offer);
    await db.layers.update('pack-1:BPA', { checkedAt: 2 });

    await expect(verifyAndFinalizeTextOnlyPack(proposed, offer, 999))
      .rejects.toThrow('verification');
    expect(await listCompletePacks()).toEqual([]);
    await discardBuildingPack('pack-1');
    expect(await db.packs.count()).toBe(0);
  });

  it('keeps the previous pack byte-identical when staging fails', async () => {
    const old = pack({ id: 'old-pack', address: 'OLD ADDRESS' });
    await db.packs.put(old);
    const before = structuredClone(await db.packs.get(old.id));
    const proposed = content({
      pack: seed({ id: 'new-pack', supersedes: old.id }),
      layers: [],
      destinations: [],
      recovery: [{ ...recovery, id: 'missing-program' }],
    });
    const offer = await createPackOffer(proposed, tileMetadata);

    await expect(saveTextOnlyPack(proposed, offer, 999)).rejects.toThrow('not present');
    expect(await db.packs.get(old.id)).toEqual(before);
    expect((await listCompletePacks()).map(({ id }) => id)).toEqual(['old-pack']);
  });

  it('atomically exposes the replacement and removes the old owned rows', async () => {
    const old = pack({ id: 'old-pack', address: 'OLD ADDRESS' });
    await db.packs.put(old);
    await db.layers.put({ ...content().layers[0], id: 'old-pack:BPA', packId: 'old-pack' });
    await db.destinations.put(destination({ id: 'old-pack:d', packId: 'old-pack' }));
    await db.tiles.put({ packId: 'old-pack', z: 12, x: 1, y: 2, bytes: new Blob(['old']) });

    const proposed = content({
      pack: seed({ id: 'new-pack', supersedes: old.id, address: 'NEW ADDRESS' }),
      layers: [{ ...content().layers[0], id: 'new-pack:BPA', packId: 'new-pack' }],
      destinations: [destination({ id: 'new-pack:d', packId: 'new-pack' })],
    });
    const offer = await createPackOffer(proposed, tileMetadata);
    await saveTextOnlyPack(proposed, offer, 999);

    expect((await listCompletePacks()).map(({ id }) => id)).toEqual(['new-pack']);
    expect(await db.layers.where('packId').equals('old-pack').count()).toBe(0);
    expect(await db.destinations.where('packId').equals('old-pack').count()).toBe(0);
    expect(await db.tiles.where('packId').equals('old-pack').count()).toBe(0);
  });
});
```

## Tier 2 — startup sweep and schema tests

Repository path: `tests/data/db.test.ts`

```ts
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  db,
  getCompletePack,
  getCompletePackContent,
  listCompletePacks,
  sweepBuilding,
} from '../../src/data/db';
import { manifestGroup } from '../../src/data/integrity';
import { destination, pack, program, source } from '../fixtures';

const layer = (packId: string) => ({
  id: `${packId}:BPA`,
  packId,
  group: 'designation' as const,
  code: 'BPA' as const,
  status: 'present' as const,
  features: [],
  checkedAt: 1,
  source: source(),
});

const tile = (packId: string) => ({ packId, z: 12, x: 1, y: 2, bytes: new Blob(['xx']) });

const stage = async (id: string, status: 'building' | 'complete') => {
  await db.packs.put(pack({ id, status }));
  await db.layers.put(layer(id));
  await db.destinations.put(destination({ id: `${id}:d`, packId: id }));
  await db.tiles.put(tile(id));
};

beforeEach(async () => {
  await Promise.all([
    db.packs.clear(),
    db.layers.clear(),
    db.destinations.clear(),
    db.tiles.clear(),
  ]);
});

describe('a pack is invisible until it is complete', () => {
  it('listCompletePacks does not return a building pack', async () => {
    await stage('half', 'building');
    expect(await listCompletePacks()).toEqual([]);
  });

  it('getCompletePack treats a building pack as one that does not exist', async () => {
    await stage('half', 'building');
    expect(await getCompletePack('half')).toBeUndefined();
  });

  it('complete detail never exposes children of a building pack', async () => {
    await db.packs.put(pack({ id: 'half', status: 'building' }));
    await db.destinations.put(destination({ id: 'half:place', packId: 'half' }));
    expect(await getCompletePackContent('half')).toBeUndefined();
  });

  it('loads complete owned rows and only a manifest-matching recovery snapshot', async () => {
    const recovery = [program()];
    const recoveryManifest = await manifestGroup(recovery);
    await db.packs.put(pack({
      manifest: {
        ...pack().manifest,
        groups: { ...pack().manifest.groups, recovery: recoveryManifest },
      },
    }));
    await db.destinations.put(destination());
    await db.programs.bulkPut(recovery);

    const detail = await getCompletePackContent('pack-1');
    expect(detail?.destinations).toEqual([destination()]);
    expect(detail?.recovery).toEqual(recovery);
    expect(detail?.recoveryVerified).toBe(true);
  });

  it('withholds recovery rows when the local snapshot does not match the pack manifest', async () => {
    await db.packs.put(pack({
      manifest: {
        ...pack().manifest,
        groups: {
          ...pack().manifest.groups,
          recovery: { count: 1, sha256: 'different' },
        },
      },
    }));
    await db.programs.put(program());

    expect(await getCompletePackContent('pack-1')).toMatchObject({
      recovery: [], recoveryVerified: false,
    });
  });

  it('returns a complete pack through both reads', async () => {
    await stage('done', 'complete');
    expect((await listCompletePacks()).map((p) => p.id)).toEqual(['done']);
    expect((await getCompletePack('done'))?.id).toBe('done');
  });

  it('returns undefined for an id that was never written', async () => {
    expect(await getCompletePack('never')).toBeUndefined();
  });

  it('the detail loader also treats an unwritten pack as unavailable', async () => {
    expect(await getCompletePackContent('never')).toBeUndefined();
  });
});

describe('sweepBuilding', () => {
  it('deletes a building pack and every child row it left behind', async () => {
    await stage('half', 'building');
    await sweepBuilding();

    expect(await db.packs.count()).toBe(0);
    expect(await db.layers.where('packId').equals('half').count()).toBe(0);
    expect(await db.destinations.where('packId').equals('half').count()).toBe(0);
    expect(await db.tiles.where('packId').equals('half').count()).toBe(0);
  });

  it('leaves a complete pack and its children byte-identical', async () => {
    await stage('done', 'complete');
    const before = await db.packs.get('done');

    await sweepBuilding();

    expect(await db.packs.get('done')).toEqual(before);
    expect(await db.layers.where('packId').equals('done').count()).toBe(1);
    expect(await db.destinations.where('packId').equals('done').count()).toBe(1);
    expect(await db.tiles.where('packId').equals('done').count()).toBe(1);
  });

  it('sweeps only the building pack when both exist side by side', async () => {
    await stage('done', 'complete');
    await stage('half', 'building');

    await sweepBuilding();

    expect((await db.packs.toArray()).map((p) => p.id)).toEqual(['done']);
    expect(await db.layers.count()).toBe(1);
  });

  it('is safe to call on an empty store, which is what happens on most app starts', async () => {
    await expect(sweepBuilding()).resolves.toBeUndefined();
    expect(await db.packs.count()).toBe(0);
  });

  it('is idempotent', async () => {
    await stage('half', 'building');
    await sweepBuilding();
    await sweepBuilding();
    expect(await db.packs.count()).toBe(0);
  });
});

describe('schema', () => {
  it('is version 1 with the nine stores', () => {
    expect(db.verno).toBe(1);
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      'actions',
      'destinations',
      'kv',
      'layers',
      'packs',
      'pending',
      'programs',
      'queue',
      'tiles',
    ]);
  });

  it('keys tiles by the compound [packId+z+x+y]', async () => {
    await db.tiles.put(tile('done'));
    expect(await db.tiles.get(['done', 12, 1, 2])).toBeDefined();
  });
});
```

## Tier 2 — service-worker regression specs

Repository path: `e2e/offline-cold-start.spec.ts`

```ts
import { expect, test } from '@playwright/test';
import { HOME_TITLE, NO_PACKS_HINT, NO_PACKS_YET } from '../src/core/copy';

// The offline claim is the product. It is asserted against the real production
// bundle with the network genuinely off, not simulated and not inspected.

const waitForController = async (page: import('@playwright/test').Page) => {
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return Boolean(reg?.active);
  });
  // registerType 'prompt' does not claim clients, so one more load hands control over.
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
};

test('the shell cold-starts with the radios off, and nothing reaches for the network', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: HOME_TITLE })).toBeVisible();
  await waitForController(page);

  const failed: string[] = [];
  page.on('requestfailed', (r) => failed.push(`${r.method()} ${r.url()}`));

  await context.setOffline(true);
  await page.reload();

  // The designed empty state, not a blank, not an error page, not a spinner.
  await expect(page.getByRole('heading', { name: HOME_TITLE })).toBeVisible();
  await expect(page.getByText(NO_PACKS_YET)).toBeVisible();
  await expect(page.getByText(NO_PACKS_HINT)).toBeVisible();

  // Every byte the offline page needed was already on the device.
  expect(failed).toEqual([]);

  await context.setOffline(false);
});

test('the empty state states absence and never reassures', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: HOME_TITLE })).toBeVisible();
  const body = (await page.locator('body').textContent()) ?? '';

  expect(body).toContain(NO_PACKS_YET);
  expect(body).not.toMatch(/\bsafe\b|\ball clear\b|\bno risk\b/i);
  await expect(page.locator('[role="progressbar"]')).toHaveCount(0);
});

test('ping.txt is served from the network, never from the precache', async ({ page, context }) => {
  await page.goto('/');
  await waitForController(page);

  expect(await page.evaluate(() => fetch('/ping.txt').then((r) => r.text()))).toBe('ok');

  // Excluded from the precache on purpose: a cached probe would report "online"
  // with the radios off, and every connectivity state downstream would be wrong.
  await context.setOffline(true);
  const offlineProbe = await page.evaluate(() =>
    fetch('/ping.txt')
      .then(() => 'reachable')
      .catch(() => 'unreachable'),
  );
  expect(offlineProbe).toBe('unreachable');

  await context.setOffline(false);
});
```

## Tier 2 — provenance and source acceptance specs

Repository path: `e2e/pack-provenance.spec.ts`

```ts
import { expect, test } from '@playwright/test';

const DETAIL_URL = 'http://127.0.0.1:4174/detail';
const SIZE_URL = 'http://127.0.0.1:4174/size';

test('US2 AC1 lists every available stored item with grouped publisher and full saved date', async ({ page }) => {
  await page.goto(DETAIL_URL);

  await expect(page.getByRole('heading', { name: 'Your pack' })).toBeVisible();
  const items = page.locator('.provenance-item');
  await expect(items).toHaveCount(3);
  await expect(items.locator('.provenance').getByText(
    /Published by .+ · Saved 27 August 2026/,
  )).toHaveCount(3);
  await expect(items.getByText('2 days ago', { exact: true })).toHaveCount(3);
  await expect(page.getByRole('link', { name: 'Open original source (web)' })).toHaveCount(3);
  await expect(page.locator('main')).not.toContainText(
    /Unknown publisher|Unknown|Source unavailable|n\/a/i,
  );
  expect(await page.evaluate(() => window.__storageCounts())).toMatchObject({
    layers: 1, destinations: 1, programs: 1,
  });
});

test('US2 AC1 provenance remains readable at 200 percent text size', async ({ page }) => {
  await page.goto(DETAIL_URL);
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });

  await expect(page.locator('.provenance-item')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('US2 AC2 leaves missing-provenance content out of both storage and the saved result', async ({ page }) => {
  await page.goto(`${SIZE_URL}?mode=omission`);
  await page.getByRole('button', { name: 'Text only' }).click();

  await expect(page.getByRole('heading', { name: 'One item was left out of your pack.' }))
    .toBeVisible();
  await expect(page.getByText(
    'It did not name who published it or when it was published, so it was not saved.',
    { exact: true },
  )).toBeVisible();
  await expect(page.getByText(
    'Cooeee only stores information it can show you the source for.',
    { exact: true },
  )).toBeVisible();
  expect(await page.evaluate(() => window.__readDestinations())).toEqual([]);
  await expect(page.getByRole('button', { name: /store|keep|save anyway/i })).toHaveCount(0);
});

test('US2 AC3 opens the same provenance offline with zero requests and no loading state', async ({ context, page }) => {
  const onlinePage = await context.newPage();
  await onlinePage.goto(DETAIL_URL);
  await expect(onlinePage.locator('.provenance-item')).toHaveCount(3);
  const onlineText = await onlinePage.locator('main').innerText();
  await onlinePage.close();

  await page.goto('http://127.0.0.1:4174/detail-launch');
  let requests = 0;
  await page.route('**', async (route) => {
    requests += 1;
    await route.continue();
  });
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Open test pack' }).click();

  await expect(page.locator('.provenance-item')).toHaveCount(3);
  expect(await page.locator('main').innerText()).toBe(onlineText);
  await expect(page.locator('main')).not.toContainText(/Loading|Reconnect|Refreshing|details are not available/i);
  expect(requests).toBe(0);
});

test('US2 AC4 labels day 31 without disabling or hiding pack functions', async ({ page }) => {
  await page.goto(`${DETAIL_URL}?mode=stale`);

  await expect(page.getByText('31 days ago', { exact: true })).toHaveCount(3);
  await expect(page.getByText('Not recently verified', { exact: true })).toHaveCount(3);
  await expect(page.getByText(
    'This pack still works. Refresh it when you are next online.',
    { exact: true },
  )).toHaveCount(3);
  await expect(page.getByRole('link', { name: 'Open original source (web)' })).toHaveCount(3);
  expect(await page.locator('.provenance-item').evaluateAll(
    (items) => items.every((item) => !item.classList.contains('disabled')),
  )).toBe(true);
});

test('US2 AC5 always explains before an original source can leave Cooeee', async ({ page }) => {
  await page.goto(DETAIL_URL);
  let requests = 0;
  await page.route('**', async (route) => {
    requests += 1;
    await route.continue();
  });
  await page.getByRole('link', { name: 'Open original source (web)' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('This source is on the web.');
  await expect(dialog).toContainText(
    'The publisher and the saved date below are stored on this device and stay readable.',
  );
  await expect(dialog).toContainText('Opening it may use your connection and leave Cooeee.');
  await expect(dialog).toContainText('Published by Department of Transport and Planning');
  await expect(dialog.getByRole('link', { name: 'Continue to original source (web)' }))
    .toHaveAttribute('href', /^https:\/\//);
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Your pack' })).toBeVisible();
  expect(requests).toBe(0);

  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.provenance-item')).toHaveCount(3);
});
```

## Delivery control — PR CI

Repository path: `.github/workflows/ci.yml`

```yaml
name: Cooeee verification

on:
  pull_request:
  push:
    branches: [main, 'epic/**']

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm install --global npm@10.8.2
      - run: npm ci
      - run: npm run verify
      - run: npm run build

  browser-regression:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm install --global npm@10.8.2
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run e2e
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```
