import Dexie, { type Table } from 'dexie';
import type {
  ActionItem,
  Destination,
  ExposureLayer,
  Kv,
  Pack,
  Pending,
  QueuedJob,
  RecoveryProgram,
  TileRow,
} from '../core/types';

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
 *  because a raw table read from a component is how a half-built pack becomes
 *  visible. The UI gets the two read functions below and nothing else. */
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
