// Every record shape in the product. Pure types only — excluded from the coverage gate.
// Three fields carry an honesty guarantee rather than a value: Pack.status,
// ExposureLayer.status (three values, not two) and Destination.kind === 'absence'.

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

export type LayerStatus = 'present' | 'none-mapped-here' | 'not-published';

export type ExposureLayer = {
  id: string; // `${packId}:${code}`
  packId: string;
  group: 'designation' | 'overlay' | 'history'; // three groups, never merged
  code: LayerCode;
  status: LayerStatus; // three values, not two
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
  status: Extract<LayerStatus, 'present' | 'none-mapped-here' | 'not-published'>;
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
