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
  it('is version 7: the pack stores, the Nearby-places stores, the snapshot, files, notes and pack programs', () => {
    expect(db.verno).toBe(7);
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
