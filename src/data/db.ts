import Dexie, { type Table } from 'dexie';
import type {
  ActionItem,
  CompletePackContent,
  Destination,
  ExposureLayer,
  Kv,
  Pack,
  PackWithPlaces,
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

/** The database handle. 
 * src/data/ only — ESLint blocks importing it from src/ui/,
 * because a raw table read from a component is how a half-built pack becomes visible. 
 * UI loaders must enter through the complete-pack guards below. */
export const db = new CooeeeDb();

/** THE read API — complete packs only. */
export const listCompletePacks = (): Promise<Pack[]> =>
  db.packs.where('status').equals('complete').toArray();

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
      const remaining = await db.packs.toArray();
      if (!remaining.some((p) => p.manifest.groups.recovery.count > 0)) {
        await db.programs.clear();
      }
    },
  );
}

// There is no third read of `packs`. If you find yourself adding one, stop —
// you are about to make a partial pack visible. (The status check inside
// deleteCompletePack is a write-path guard, not a read API.)
