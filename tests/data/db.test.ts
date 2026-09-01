import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  db,
  deleteCompletePack,
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
    db.programs.clear(),
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

describe('deleteCompletePack', () => {
  // A pack whose manifest still references the shared recovery snapshot.
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
    const before = await db.packs.get('kept');

    await deleteCompletePack('gone');

    expect((await db.packs.toArray()).map((p) => p.id)).toEqual(['kept']);
    expect(await db.layers.where('packId').equals('gone').count()).toBe(0);
    expect(await db.destinations.where('packId').equals('gone').count()).toBe(0);
    expect(await db.tiles.where('packId').equals('gone').count()).toBe(0);
    expect(await db.packs.get('kept')).toEqual(before);
    expect(await db.layers.where('packId').equals('kept').count()).toBe(1);
  });

  it('refuses a building pack — only sweepBuilding removes those', async () => {
    await stage('half', 'building');
    await deleteCompletePack('half');
    expect(await db.packs.count()).toBe(1);
    expect(await db.layers.count()).toBe(1);
  });

  it('clears the shared programs when the last recovery-referencing pack goes', async () => {
    await db.packs.put(withRecovery('only'));
    await db.programs.put(program());

    await deleteCompletePack('only');

    expect(await db.programs.count()).toBe(0);
  });

  it('keeps the shared programs while another pack still references recovery', async () => {
    await db.packs.put(withRecovery('gone'));
    await db.packs.put(withRecovery('kept'));
    await db.programs.put(program());

    await deleteCompletePack('gone');

    expect(await db.programs.count()).toBe(1);
  });
});

describe('schema', () => {
  it('is version 2 with the five stores', () => {
    expect(db.verno).toBe(2);
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      'destinations',
      'layers',
      'packs',
      'programs',
      'tiles',
    ]);
  });

  it('keys tiles by the compound [packId+z+x+y]', async () => {
    await db.tiles.put(tile('done'));
    expect(await db.tiles.get(['done', 12, 1, 2])).toBeDefined();
  });
});
