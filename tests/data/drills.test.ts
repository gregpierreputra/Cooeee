import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { carryHistoryToNewPack, db, deleteCompletePack, isDrill, listDrills, ownedTables, saveDrill } from '../../src/data/db';
import type { Drill } from '../../src/core/types';
import { pack } from '../fixtures';

const drill = (over: Partial<Drill> = {}): Drill => ({
  id: 'd1', packId: 'p1', finishedAt: 1_756_100_000_000, reachedDoor: true, score: 40, packed: ['torch', 'radio'], ...over,
});

describe('E7 the drills store', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('saves a drill and lists it for its pack only', async () => {
    await saveDrill(drill());
    await saveDrill(drill({ id: 'd2', packId: 'p2' }));
    expect((await listDrills('p1')).map((row) => row.id)).toEqual(['d1']);
  });

  it('refuses and drops a row the game could not have produced', async () => {
    await expect(saveDrill(drill({ score: 101 }))).rejects.toThrow(RangeError);
    await expect(saveDrill(drill({ packed: ['not-a-thing'] }))).rejects.toThrow(RangeError);
    await db.drills.put({ ...drill({ id: 'bad' }), packed: new Array(11).fill('torch') });
    expect(await listDrills('p1')).toEqual([]);
    expect(isDrill(drill())).toBe(true);
  });

  it('goes with its pack on delete and moves with it on replace', async () => {
    await db.packs.put({ ...pack(), id: 'p1', status: 'complete' });
    await saveDrill(drill());
    await db.transaction('rw', [db.packs, ...ownedTables()], () => carryHistoryToNewPack('p1', 'p3'));
    expect((await listDrills('p3')).map((row) => row.id)).toEqual(['d1']);
    await db.packs.put({ ...pack(), id: 'p3', status: 'complete' });
    await deleteCompletePack('p3');
    expect(await listDrills('p3')).toEqual([]);
  });
});
