import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { carryHistoryToNewPack, db, deleteCompletePack, isDrill, listAllDrills, listDrills, ownedTables, saveDrill } from '../../src/data/db';
import type { Drill } from '../../src/core/types';
import { pack } from '../fixtures';

const drill = (over: Partial<Drill> = {}): Drill => ({
  id: 'd1', packId: 'p1', finishedAt: 1_756_100_000_000, reachedDoor: true, score: 40, packed: ['torch', 'radio'], ...over,
});

describe('E9 the drills store', () => {
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

  it('keeps the twist a drill was played under, and holds its bag to that twist', async () => {
    await saveDrill(drill({ twist: 'night' }));
    expect((await listDrills('p1'))[0].twist).toBe('night');
    // A drill from before twists has none, and is still a drill.
    expect(isDrill(drill())).toBe(true);
    await expect(saveDrill(drill({ id: 'd2', twist: 'not-a-twist' }))).rejects.toThrow(RangeError);
    // The day pack holds five; the boot twelve.
    const six = ['torch', 'radio', 'water', 'masks', 'blanket', 'medicines'];
    await expect(saveDrill(drill({ id: 'd3', twist: 'day-pack', packed: six }))).rejects.toThrow(RangeError);
    expect(isDrill(drill({ twist: 'room-in-the-boot', packed: [...six, 'clothes', 'charger', 'firstaid', 'papers', 'photos', 'pet'] }))).toBe(true);
    // A twist's own extra things may be in its bag.
    expect(isDrill(drill({ twist: 'boots-and-gloves', packed: ['boots', 'gloves'] }))).toBe(true);
  });

  it('lists the drills of every pack, for the highest under a twist', async () => {
    await saveDrill(drill());
    await saveDrill(drill({ id: 'd2', packId: 'p2', twist: 'night' }));
    await db.drills.put({ ...drill({ id: 'bad' }), score: 500 });
    expect((await listAllDrills()).map((row) => row.id).sort()).toEqual(['d1', 'd2']);
  });
});
