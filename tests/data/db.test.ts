import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  db,
  deleteCompletePack,
  getCompletePack,
  getCompletePackContent,
  listCompletePacks,
  listCompletePacksWithPlaces,
  putNote,
  readRehearsalSource,
  listRehearsalsForPack,
  saveFinishedRehearsal,
  carryHistoryToNewPack,
  sweepBuilding,
} from '../../src/data/db';
import { fileMeta, manifestGroup, sha256Hex } from '../../src/data/integrity';
import { destination, pack, packProgram, program, source } from '../fixtures';

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
    db.files.clear(),
    db.notes.clear(),
    db.programs.clear(),
    db.packPrograms.clear(),
    db.rehearsals.clear(),
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

  it('loads complete owned rows and only manifest-matching program rows', async () => {
    const recovery = [packProgram()];
    const recoveryManifest = await manifestGroup(recovery);
    await db.packs.put(pack({
      manifest: {
        ...pack().manifest,
        groups: {
          ...pack().manifest.groups,
          destinations: await manifestGroup([destination()]),
          recovery: recoveryManifest,
        },
      },
    }));
    await db.destinations.put(destination());
    await db.packPrograms.bulkPut(recovery);

    const detail = await getCompletePackContent('pack-1');
    expect(detail?.destinations).toEqual([destination()]);
    expect(detail?.recovery).toEqual(recovery);
    expect(detail?.recoveryVerified).toBe(true);
  });

  it('withholds program rows that do not match the pack manifest', async () => {
    await db.packs.put(pack({
      manifest: {
        ...pack().manifest,
        groups: {
          ...pack().manifest.groups,
          recovery: { count: 1, sha256: 'different' },
        },
      },
    }));
    await db.packPrograms.put(packProgram());

    expect(await getCompletePackContent('pack-1')).toMatchObject({
      recovery: [], files: [], notes: [], recoveryVerified: false,
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

describe('deleteCompletePack', () => {
  // A pack whose manifest records program rows.
  const withRecovery = (id: string, status: 'building' | 'complete' = 'complete') =>
    pack({
      id,
      status,
      manifest: {
        ...pack().manifest,
        groups: { ...pack().manifest.groups, recovery: { count: 1, sha256: 'r' } },
      },
    });

  it('deletes the pack and every row it owns, leaving another pack untouched', async () => {
    await stage('gone', 'complete');
    await stage('kept', 'complete');
    // The two tables added later, one row each, so the cascade is seen to reach them.
    const file = { url: 'https://example.test/page', name: 'page.pdf', retrievedAt: 0, sizeBytes: 4, sha256: 'f', bytes: new ArrayBuffer(4) };
    await db.files.bulkPut([{ ...file, id: 'gone:f', packId: 'gone' }, { ...file, id: 'kept:f', packId: 'kept' }]);
    await db.notes.bulkPut([{ id: 'gone:n', packId: 'gone', text: 'x', updatedAt: 1 }, { id: 'kept:n', packId: 'kept', text: 'x', updatedAt: 1 }]);
    const before = await db.packs.get('kept');

    await deleteCompletePack('gone');

    expect((await db.packs.toArray()).map((p) => p.id)).toEqual(['kept']);
    expect(await db.layers.where('packId').equals('gone').count()).toBe(0);
    expect(await db.destinations.where('packId').equals('gone').count()).toBe(0);
    expect(await db.tiles.where('packId').equals('gone').count()).toBe(0);
    expect(await db.files.where('packId').equals('gone').count()).toBe(0);
    expect(await db.notes.where('packId').equals('gone').count()).toBe(0);
    expect(await db.packs.get('kept')).toEqual(before);
    expect(await db.layers.where('packId').equals('kept').count()).toBe(1);
    expect(await db.files.where('packId').equals('kept').count()).toBe(1);
    expect(await db.notes.where('packId').equals('kept').count()).toBe(1);
  });

  it('refuses a building pack — only sweepBuilding removes those', async () => {
    await stage('half', 'building');
    await deleteCompletePack('half');
    expect(await db.packs.count()).toBe(1);
    expect(await db.layers.count()).toBe(1);
  });

  it('leaves the recovery programs in place when the last pack goes', async () => {
    await db.packs.put(withRecovery('only'));
    await db.programs.put(program());

    await deleteCompletePack('only');

    expect(await db.programs.count()).toBe(1);
  });
});

describe('putNote', () => {
  const note = { id: 'n1', packId: 'done', text: ' Meet at the gate. ', updatedAt: 5 };

  it('stores a trimmed note against a complete pack', async () => {
    await stage('done', 'complete');
    await putNote(note);
    expect(await db.notes.get('n1')).toEqual({ ...note, text: 'Meet at the gate.' });
  });

  it('refuses a note for a building pack, an empty note and an over-long note', async () => {
    await stage('half', 'building');
    await expect(putNote({ ...note, packId: 'half' })).rejects.toThrow('complete');
    await stage('done', 'complete');
    await expect(putNote({ ...note, text: '   ' })).rejects.toThrow('empty');
    await expect(putNote({ ...note, text: 'x'.repeat(2001) })).rejects.toThrow('too long');
    expect(await db.notes.count()).toBe(0);
  });
});

describe('schema', () => {
  it('is version 8: the pack stores, the Nearby-places stores, the snapshot, files, notes, pack programs and rehearsals', () => {
    expect(db.verno).toBe(8);
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      'destinations',
      'dynamicSnapshot',
      'files',
      'layers',
      'notes',
      'packPrograms',
      'packs',
      'postcodes',
      'programs',
      'rehearsals',
      'snapshots',
      'staticFacilities',
      'syncMeta',
      'tiles',
    ]);
  });

  it('keys tiles by the compound [packId+z+x+y]', async () => {
    await db.tiles.put(tile('done'));
    expect(await db.tiles.get(['done', 12, 1, 2])).toBeDefined();
  });
});

describe('read-time verification of every manifest group', () => {
  const withManifest = async (groups: Partial<ReturnType<typeof pack>['manifest']['groups']>) =>
    db.packs.put(pack({ manifest: { ...pack().manifest, groups: { ...pack().manifest.groups, ...groups } } }));

  it('withholds destinations that no longer match the manifest, on both reads', async () => {
    await withManifest({ destinations: await manifestGroup([destination()]) });
    await db.destinations.put(destination({ name: 'Changed' })); // altered after the save

    expect(await getCompletePackContent('pack-1')).toMatchObject({ destinations: [], contentVerified: false });
    expect(await listCompletePacksWithPlaces()).toMatchObject([{ places: [], placesVerified: false }]);
  });

  it('withholds a stored file whose bytes changed but whose size and stated hash did not', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.7 test').buffer;
    const file = {
      id: 'pack-1:page.pdf', packId: 'pack-1', url: 'https://www.cfa.vic.gov.au/page', name: 'page.pdf',
      retrievedAt: 5, sizeBytes: bytes.byteLength, sha256: await sha256Hex(bytes), bytes,
    };
    await withManifest({ files: await manifestGroup([fileMeta(file)]) });
    await db.files.put({ ...file, bytes: new TextEncoder().encode('%PDF-1.7 tost').buffer }); // same length

    expect(await getCompletePackContent('pack-1')).toMatchObject({ files: [], contentVerified: false });
  });

  it('keeps every group when the stored rows match the manifest', async () => {
    await withManifest({ destinations: await manifestGroup([destination()]) });
    await db.destinations.put(destination());

    expect(await getCompletePackContent('pack-1')).toMatchObject({
      destinations: [destination()], contentVerified: true, recoveryVerified: true,
    });
    expect(await listCompletePacksWithPlaces()).toMatchObject([{ places: [destination()], placesVerified: true }]);
  });
});

// E5-US1-AC4 — the one read behind the rehearsal entry gate. It exists because
// the complete-pack read API deliberately cannot tell a pack that was never
// finished from no pack at all, and the gate has to.
describe('the rehearsal entry gate reads the device', () => {
  /** Every table the gate could conceivably reach, as it stands right now. */
  const snapshotStores = async () => ({
    packs: await db.packs.toArray(),
    layers: await db.layers.toArray(),
    destinations: await db.destinations.toArray(),
    files: await db.files.toArray(),
    notes: await db.notes.toArray(),
    programs: await db.programs.toArray(),
  });

  it('counts an unfinished build without returning any of its rows', async () => {
    await stage('half', 'building');

    const read = await readRehearsalSource('half');
    expect(read).toEqual({ completeCount: 0, unfinishedCount: 1, content: null });
  });

  it('reports no pack at all as a different reading from an unfinished build', async () => {
    expect(await readRehearsalSource('nothing')).toEqual({
      completeCount: 0,
      unfinishedCount: 0,
      content: null,
    });
  });

  it('counts the complete packs that are stored, so an empty device is never claimed', async () => {
    await db.packs.put(pack({ id: 'other' }));

    expect(await readRehearsalSource('missing')).toMatchObject({
      completeCount: 1,
      unfinishedCount: 0,
      content: null,
    });
  });

  it('returns a complete pack with its rows', async () => {
    await db.packs.put(pack());
    await db.layers.put(layer('pack-1'));

    const read = await readRehearsalSource('pack-1');
    expect(read).toMatchObject({ completeCount: 1, unfinishedCount: 0 });
    expect(read.content).toMatchObject({ pack: { id: 'pack-1' } });
  });

  it('reports a store that cannot be read rather than throwing at the screen', async () => {
    const broken = new Error('the store could not be opened');
    const original = db.packs.where;
    db.packs.where = (() => {
      throw broken;
    }) as typeof db.packs.where;
    try {
      expect(await readRehearsalSource('pack-1')).toEqual({
        completeCount: 0,
        unfinishedCount: 0,
        content: 'unreadable',
      });
    } finally {
      db.packs.where = original;
    }
  });

  // The criterion: no rehearsal record is created in any state. There is no
  // rehearsal store yet, so what is asserted is that nothing at all changed on
  // the device in any of the four readings, and in the fifth.
  it('writes nothing, in any state the gate can reach', async () => {
    await db.packs.put(pack());
    await db.layers.put(layer('pack-1'));
    await stage('half', 'building');
    const before = await snapshotStores();

    for (const id of ['pack-1', 'half', 'never-existed']) {
      await readRehearsalSource(id);
    }

    expect(await snapshotStores()).toEqual(before);
  });
});

// E5-US2-AC1 — recording a finished rehearsal.
describe('a rehearsal is recorded only once it has finished', () => {
  const finished = (over: Partial<Parameters<typeof saveFinishedRehearsal>[0]> = {}) => ({
    id: 'run-1',
    packId: 'pack-1',
    condition: 'no-data' as const,
    startedAt: 1_756_100_000_000,
    finishedAt: 1_756_100_060_000,
    gaps: [
      { gapType: 'places-missing' as const, kind: 'pack-content' as const, hazard: 'bushfire' as const },
    ],
    ...over,
  });

  it('writes the run and the gaps it found in one row', async () => {
    await saveFinishedRehearsal(finished());

    const stored = await listRehearsalsForPack('pack-1');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ condition: 'no-data', finishedAt: 1_756_100_060_000 });
    expect(stored[0].gaps).toEqual([
      { gapType: 'places-missing', kind: 'pack-content', hazard: 'bushfire' },
    ]);
  });

  // The guard exists because a row written before a run finishes is a row a
  // cold start can find, and E5-US1-AC3 requires that an interrupted rehearsal
  // is never recorded as completed.
  it('refuses a rehearsal that has not finished', async () => {
    await expect(saveFinishedRehearsal(finished({ finishedAt: 0 }))).rejects.toThrow(RangeError);
    await expect(
      saveFinishedRehearsal(finished({ finishedAt: 1_756_100_000_000 - 1 })),
    ).rejects.toThrow(RangeError);
    expect(await listRehearsalsForPack('pack-1')).toEqual([]);
  });

  // The record is keyed by the id of the run that produced it, so a screen that
  // remounts rewrites the same row rather than recording the run twice.
  it('records one row per run, however many times it is written', async () => {
    await saveFinishedRehearsal(finished());
    await saveFinishedRehearsal(finished());
    await saveFinishedRehearsal(finished({ id: 'run-2' }));

    expect(await listRehearsalsForPack('pack-1')).toHaveLength(2);
  });

  it('returns each pack its own rehearsals, oldest first', async () => {
    await saveFinishedRehearsal(finished({ id: 'a', finishedAt: 1_756_100_200_000 }));
    await saveFinishedRehearsal(finished({ id: 'b', finishedAt: 1_756_100_100_000 }));
    await saveFinishedRehearsal(finished({ id: 'c', packId: 'other-pack' }));

    expect((await listRehearsalsForPack('pack-1')).map((row) => row.id)).toEqual(['b', 'a']);
    expect((await listRehearsalsForPack('other-pack')).map((row) => row.id)).toEqual(['c']);
  });

  // A record of what was missing from a pack that no longer exists is a loose
  // end, not information.
  it('goes when the pack it is about goes', async () => {
    await db.packs.put(pack());
    await saveFinishedRehearsal(finished());

    await deleteCompletePack('pack-1');

    expect(await listRehearsalsForPack('pack-1')).toEqual([]);
  });
});

// The reader's history of a PLACE survives that place's pack being refreshed.
// The action a rehearsal most often asks for is to build the pack again, so a
// rebuild that deleted the rehearsals would destroy the record of having done
// what the product asked.
describe('replacing a pack carries its rehearsals to the pack that replaces it', () => {
  const rehearsalFor = (packId: string, id: string) => ({
    id,
    packId,
    condition: 'no-data' as const,
    startedAt: 1,
    finishedAt: 2,
    gaps: [
      { gapType: 'places-missing' as const, kind: 'pack-content' as const, hazard: 'bushfire' as const },
    ],
  });

  it('moves them, rather than deleting them with the old pack', async () => {
    await db.packs.put(pack({ id: 'old' }));
    await saveFinishedRehearsal(rehearsalFor('old', 'run-1'));
    await saveFinishedRehearsal(rehearsalFor('old', 'run-2'));

    await carryHistoryToNewPack('old', 'new');

    expect(await listRehearsalsForPack('old')).toEqual([]);
    expect((await listRehearsalsForPack('new')).map((row) => row.id)).toEqual(['run-1', 'run-2']);
  });

  it('leaves the history of another pack where it is', async () => {
    await saveFinishedRehearsal(rehearsalFor('old', 'run-1'));
    await saveFinishedRehearsal(rehearsalFor('untouched', 'run-3'));

    await carryHistoryToNewPack('old', 'new');

    expect((await listRehearsalsForPack('untouched')).map((row) => row.id)).toEqual(['run-3']);
  });

  it('does nothing when the old pack had no history', async () => {
    await expect(carryHistoryToNewPack('old', 'new')).resolves.toBeUndefined();
    expect(await listRehearsalsForPack('new')).toEqual([]);
  });

  // Deleting a pack outright is a different act from replacing one, and still
  // takes the history with it.
  it('is not what happens when a pack is deleted outright', async () => {
    await db.packs.put(pack());
    await saveFinishedRehearsal(rehearsalFor('pack-1', 'run-1'));

    await deleteCompletePack('pack-1');

    expect(await listRehearsalsForPack('pack-1')).toEqual([]);
  });
});
