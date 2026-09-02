import Dexie, { type Table } from 'dexie';
import type {
  BundleFacility,
  BundlePostcode,
  CompletePackContent,
  Destination,
  ExposureLayer,
  NspSnapshot,
  Pack,
  PackWithPlaces,
  RecoveryProgram,
  SnapshotActivation,
  StoredSnapshot,
  SyncMetaRow,
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
  tiles!: Table<TileRow, [string, number, number, number]>;
  // Nearby places (spec §7.2): downloaded reference data, not user data.
  staticFacilities!: Table<BundleFacility, number>;
  postcodes!: Table<BundlePostcode, string>;
  dynamicSnapshot!: Table<SnapshotActivation, number>;
  syncMeta!: Table<SyncMetaRow, string>;
  // The CFA site list, for BlackSky's nearest-places pointer.
  snapshots!: Table<StoredSnapshot, string>;

  constructor() {
    super('cooeee');

    // A SHIPPED VERSION IS NEVER MUTATED. A schema change is a new db.version(n);
    // Dexie applies every version above the stored one, in order, on open.
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
    // Version 2 drops the four stores nothing ever wrote to, and the unused
    // address index on packs.
    this.version(2).stores({
      packs: 'id, status',
      actions: null,
      queue: null,
      pending: null,
      kv: null,
    });
    // Version 3 adds the four Nearby-places stores: the downloaded static
    // facilities and postcodes, the short-lived dynamic snapshot and the sync
    // bookkeeping. Nothing existing changes shape.
    this.version(3).stores({
      staticFacilities: 'facility_id',
      postcodes: 'postcode',
      dynamicSnapshot: 'activation_id',
      syncMeta: 'key',
    });
    // Version 4 adds the one-row store holding the CFA site list, so BlackSky
    // can point at the nearest official places without a network path.
    this.version(4).stores({ snapshots: 'name' });
  }
}

/** The database handle. 
 * src/data/ only — ESLint blocks importing it from src/ui/,
 * because a raw table read from a component is how a half-built pack becomes visible. 
 * UI loaders must enter through the complete-pack guards below. */
export const db = new CooeeeDb();

/** THE read API — complete packs only. */
export const listCompletePacks = (): Promise<Pack[]> =>
  db.packs.where('status').equals('complete').toArray();

/** The CFA site list for BlackSky: written whole, read whole. */
export const putNspSnapshot = (snapshot: NspSnapshot): Promise<string> =>
  db.snapshots.put({ ...snapshot, name: 'nsp' });

export const getNspSnapshot = (): Promise<NspSnapshot | undefined> => db.snapshots.get('nsp');

/** THE read API — one complete pack, or undefined. 
 * A building pack is indistinguishable from a pack that does not exist, which is the point. */
export const getCompletePack = async (id: string): Promise<Pack | undefined> => {
  const p = await db.packs.get(id);
  return p?.status === 'complete' ? p : undefined;
};

/** Every complete pack with its destination rows, for BlackSky. 
 * Routes through listCompletePacks, so a building pack stays exactly as invisible here as it is everywhere else. 
 **/
export async function listCompletePacksWithPlaces(): Promise<PackWithPlaces[]> {
  const packs = await listCompletePacks();
  return Promise.all(
    packs.map(async (pack) => ({
      pack,
      places: await db.destinations.where('packId').equals(pack.id).toArray(),
    })),
  );
}

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

/** Permanently delete ONE complete pack and every row it owns. The shared
 *  recovery-programs snapshot is cleared only when no remaining pack still
 *  references recovery — it is one snapshot shared by every pack manifest,
 *  so it may only go when the last referencing pack goes. */
export async function deleteCompletePack(id: string): Promise<void> {
  await db.transaction(
    'rw',
    db.packs,
    db.layers,
    db.destinations,
    db.tiles,
    db.programs,
    async () => {
      const target = await db.packs.get(id);
      if (target?.status !== 'complete') return;
      await db.layers.where('packId').equals(id).delete();
      await db.destinations.where('packId').equals(id).delete();
      await db.tiles.where('packId').equals(id).delete();
      await db.packs.delete(id);
      const stillReferenced = await db.packs
        .filter((p) => p.manifest.groups.recovery.count > 0)
        .count();
      if (stillReferenced === 0) await db.programs.clear();
    },
  );
}

// Every read of `packs` that leaves this file goes through the complete-only
// functions above. A new raw read here is how a partial pack becomes visible.
// (The status checks inside sweepBuilding and deleteCompletePack are write-path
// guards, not read APIs.)
