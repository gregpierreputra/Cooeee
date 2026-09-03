// Every record shape in the product. 
// Pure types only - excluded from the coverage gate.
// Three fields carry an honesty guarantee rather than a value: 
// Pack.status, ExposureLayer.status (three verified values; unknown is never persisted) and
// Destination.kind === 'absence'.

// --- Pack ---
export type Source = {
  publisher: string;      // 'Department of Transport and Planning'
  url: string;            // the exact request or document URL
  licence: string;        // 'CC BY 4.0' | 'ODbL' | 'CFA website list — permission to be confirmed'
  retrievedAt: number;    // epoch ms
};

/** The hazard a pack is prepared for. Iteration 1 builds bushfire packs only; an
 * absent value means bushfire. Neighbourhood Safer Places are a bushfire concept
 * and are never offered for flood or heat. */
export type HazardType = 'bushfire' | 'flood' | 'heat';

export type PackManifest = {
  version: 1;
  groups: {
    layers: { 
      count: number; 
      sha256: string };

    destinations: { 
      count: number; 
      sha256: string };
      
    recovery: { 
      count: number; 
      sha256: string };

    // constant { count: 0, bytes: 0 } for Iteration 1, which is the
    // lifecycle contract's explicit no-tiles marker rather than a placeholder.
    // Upgrade path: the basemap capability fills it from the range reader.
    
    tiles: { 
      count: number; 
      bytes: number }; // count 0 = the explicit text-only marker

    // The PDF copies of the source pages. Absent on packs built before the
    // copies existed; such a pack simply holds no files.
    files?: {
      count: number;
      sha256: string };
  };
};

export type Pack = {
  id: string;                       // crypto.randomUUID() - unique user ID
  status: 'building' | 'complete';  // THE atomicity mechanism
  name: string;                     // editable at confirm; default = locality
  address: string;                  // confirmed ezi_address, echoed in full
  lat: number;                      // latitude coordinate
  lon: number;                      // longitude coordinate
  radiusKm: number;                 // PACK_RADIUS_KM
  lgaName: string;
  createdAt: number;
  verifiedAt: number;               // freshness will be derived from this, not createdAt

  // Basemap is out of scope for now, so every pack is written with builtWithTiles false and 
  // sizeBytes.tiles 0. 
  // The fields stay because they are already the honest description of a pack with no tiles, and because removing them would rewrite every stored pack row
  // at startup, outside the user's choice. 
  // Upgrade path: the basemap capability populates them; no migration is needed when it lands.

  builtWithTiles: boolean;
  
  sizeBytes: { 
    text: number; 
    tiles: number;
    files?: number };  // the PDF copies; absent on packs built before them

  reminder: string;                 // the one short BlackSky reminder
  manifest: PackManifest;
  sources: Source[];
  supersedes?: string;              // optional attribute, set by "update" the old pack lives until acknowledged
  hazardType?: HazardType;          // absent = 'bushfire' (Iteration 1 builds bushfire only)
};

/** A PDF copy of one official source page, saved inside the pack so the page
 * itself opens with no signal. `bytes` is an ArrayBuffer: it structured-clones
 * into IndexedDB in every engine, and becomes a Blob only when opened. */
export type PackFile = {
  id: string;             // `${packId}:${name}`
  packId: string;
  url: string;            // the page this is a copy of — the url a Source names
  name: string;           // the file name the copy is offered under
  retrievedAt: number;    // when the page was rendered to PDF
  sizeBytes: number;
  sha256: string;
  bytes: ArrayBuffer;
};

/** The file without its bytes: what the offer states and the manifest hashes. */
export type PackFileMeta = Omit<PackFile, 'bytes'>;

/** A note the user wrote for their pack: their own words, kept beside the
 * official content and editable at any time, online or off. Never part of the
 * manifest or the stated size — nothing in it came from a source. */
export type PackNote = {
  id: string;
  packId: string;
  text: string;
  updatedAt: number;
};

export type LayerCode = 'BPA' | 'BMO' | 'LSIO' | 'FO' | 'SBO';

// Publications
/** Publication is not boolean: a failed or skipped probe is not evidence that
 * the layer is unpublished. */
export type LayerPublicationStatus = 'published' | 'unpublished' | 'unknown';

// Layers
export type LayerStatus = 'present' | 'none-mapped-here' | 'not-published' | 'unknown';
export type VerifiedLayerStatus = Exclude<LayerStatus, 'unknown'>;

export type ExposureLayer = {
  id: string;                                     // `${packId}:${code}`
  packId: string;
  group: 'designation' | 'overlay' | 'history';   // three groups, never merged
  code: LayerCode;
  status: VerifiedLayerStatus;                    // an unknown check is never persisted as evidence
  features: {
    zoneCode?: string;
    description?: string;
    planNumber?: string;
    gazettalDate?: string;
  }[];
  checkedAt: number;
  source: Source;
  // NOTE: no geometry field, and there must never be one.
};

export type Destination = {
  id: string;                                           // `${packId}:${nspId}` | `${packId}:absence`
  packId: string;
  kind: 'nsp-bushfire' | 'absence';                     // absence is a REAL row
  name?: string;                                        // optional
  addressText?: string;                                 // optional
  council?: string;                                     // optional
  listAsAt?: string;                                    // the CFA list's own date, e.g. '2026-08-18'
  designatedAt?: string;                                // the CFA's designation date for the site, when recorded
  geocode?: 'exact' | 'street' | 'township' | 'none';   // optional, can be one of the different values
  lat?: number;                                         // optional, absent when geocode === 'none'
  lon?: number;                                         // optional, absent when geocode === 'none'
  distanceM?: number;                                   // optional, absent when no lat/lon
  distanceOrder?: number;                               // display order ONLY, zero-based
  chosen?: boolean;                                     // at most two true per pack; equal status
  reason?: string;                                      // absence rows: why, and the area it covers
  source: Source;
  
  // NOTE: there is NO role, rank, priority or ordering-of-worth field here, and
  // there must never be one. 
  // Equal status is a property of the schema.
};

// --- Recovery ---
// NeedKey string for a given recovery program
type NeedKey = 'stay' | 'money' | 'food' | 'property' | 'health' | 'documents'; 

export type RecoveryProgram = {
  id: string;
  org: string;
  title: string;
  covers: string;         // one plain-language line
  needs: NeedKey[];
  officialUrl: string;    // allow-listed domain, checked at build time
  telephone?: string;
  sms?: string;
  snapshotDate: string;   // ISO date
  declaration?: { 
    lgaName: string; 
    agrn?: string; 
    status: string; 
    checkedAt: number };
  source: Source;
};

// ID alongside x, y, z alongside with the blobs for info bytes
export type TileRow = { 
  packId: string;
  z: number;
  x: number; 
  y: number; 
  bytes: Blob 
};

export type Fix = { 
  lat: number; 
  lon: number; 
  accuracyM: number; 
  at: number };

/** A geographic point in the order this codebase uses everywhere: named fields,
 *  never a positional pair, because the axis-order trap is the defect that
 *  returns HTTP 200 with zero matches. */
export type LatLon = { 
  lat: number; 
  lon: number };

/** A complete pack together with the destination rows stored against it —
 *  including any absence row. Referenced by deriveState(). */
export type PackWithPlaces = {
  pack: Pack;
  places: Destination[];           // empty when placesVerified is false
  notes: PackNote[];
  placesVerified: boolean;         // the rows still match the pack manifest
};

/** A single address candidate returned by the address service. 
 * It remains in memory until the user explicitly confirms it. */
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

/** The confirmed, still in-memory selection. 
 * It is not a saved place and must not be written to IndexedDB before the pack commit conditions are met. */
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
  // The gazetted plan the point hit matched. Present only when status is
  // 'present' — an absence has no plan to name, so the fields stay absent
  // rather than carrying a placeholder.
  planNumber?: string;
  gazettalDate?: string;
};

/** The versioned, device-generated AC9 build response. Metadata only: it
 * authorises no payload request or device write by itself. */
export type PackOffer = {
  version: 1;
  textBytes: number;
  files: PackFileMeta[];
  fileBytes: number;
  omittedItems: { 
    id: string; 
    missing: 'publisher' | 'saved-date' 
  }[];
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
  files: PackFile[];
  notes: PackNote[];
  recoveryVerified: boolean;       // the shared recovery snapshot matches this pack's manifest
  contentVerified: boolean;        // layers, destinations and files all match the manifest
};

/** A local item ready for the shared provenance renderer. This is a view model,
 * not an IndexedDB record. */
export type PackDetailItem = {
  id: string;
  name: string;
  source: Source;
  // The stored citation for this item, when it has one — present only where the
  // saved row itself names what was matched.
  citation?: string;
  // The readable page to continue to, when it is not the DTP dataset page.
  pageUrl?: string;
};

/** One row of the CFA Neighbourhood Safer Places state-wide list, as produced by
 * scripts/build-nsp.mjs. The raw snapshot shape — not an IndexedDB record.
 * `lat`/`lon` are present for every geocode except 'none'. */
export type NspSite = {
  id: string; // stable across rebuilds: 'nsp-' + the CFA's own nsp_id
  municipality: string; // the responsible council, shown on every entry
  township: string;
  name: string; // the place name, shown on every entry
  subLocation: string; // may be empty
  street: string;
  geocode: 'exact' | 'street' | 'township' | 'none';
  lat?: number; // absent only when geocode === 'none'
  lon?: number;
  designatedAt?: string; // ISO date the CFA designated the site, when the list records one
};

/** The precached CFA NSP snapshot file. One state-wide `listAsAt` date beside
 * each site's own designation date; no stated licence
 * (see prompt-bank/datasets/licence-and-attribution.txt). */
export type NspSnapshot = {
  listAsAt: string; // ISO date — the list's own date, shown as the list's date
  retrievedAt: number; // epoch ms
  source: Source;
  sites: NspSite[];
};

/** The NSP snapshot as stored in IndexedDB for BlackSky, which may not fetch:
 * one row, replaced whole whenever the precached file is read. */
export type StoredSnapshot = NspSnapshot & { name: 'nsp' };

// --- Nearby places ---
// The wire shapes of the API server's two sync endpoints (server/api.ts). The
// client stores them in IndexedDB exactly as received: snake_case IS the
// contract, so there is no mapping layer to drift from it.
export type FacilityType = 'NSP' | 'CFR' | 'ERC' | 'RELIEF' | 'RECOVERY' | 'ASSEMBLY';
export type StaticType = Extract<FacilityType, 'NSP' | 'CFR'>;
export type DynamicType = Exclude<FacilityType, StaticType>;

export type SourceStatus = 'healthy' | 'degraded' | 'down' | 'unknown';
export type SourceHealth = { status: SourceStatus; last_success_at: string | null };
export type DataHealth = Record<string, SourceHealth>;

export type BundleFacility = {
  facility_id: number;
  type: StaticType;
  name: string;
  address: string | null;
  lat: number;
  lon: number;
  lga_name: string | null;
  designation_status: 'designated' | 'needs_review'; // needs_review = missing from the latest upstream run
  last_verified_at: string; // ISO-8601
};
export type BundlePostcode = { postcode: string; centroid_lat: number; centroid_lon: number };
export type StaticBundle = {
  version: string | null;
  generated_at: string;
  facilities: BundleFacility[];
  postcodes: BundlePostcode[];
  data_health: DataHealth;
};

export type SnapshotActivation = {
  activation_id: number;
  type: DynamicType;
  name: string;
  address: string | null;
  lat: number;
  lon: number;
  source_updated_at: string;
};
export type DynamicSnapshot = {
  generated_at: string;
  source_status: SourceStatus;
  source_last_success_at: string | null;
  activations: SnapshotActivation[];
};

/** One key/value row of the client's sync bookkeeping (spec §7.2 sync_meta). */
export type SyncMetaRow = { key: string; value: string };
