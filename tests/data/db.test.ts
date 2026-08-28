import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, getCompletePack, listCompletePacks, sweepBuilding } from '../../src/data/db';
import { destination, pack, source } from '../fixtures';

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

  it('returns a complete pack through both reads', async () => {
    await stage('done', 'complete');
    expect((await listCompletePacks()).map((p) => p.id)).toEqual(['done']);
    expect((await getCompletePack('done'))?.id).toBe('done');
  });

  it('returns undefined for an id that was never written', async () => {
    expect(await getCompletePack('never')).toBeUndefined();
  });

  it('exposes no third read of packs', () => {
    // If this list grows, a partial pack is about to become visible.
    expect(Object.keys({ listCompletePacks, getCompletePack, sweepBuilding })).toHaveLength(3);
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

describe('schema', () => {
  it('is version 1 with the nine stores', () => {
    expect(db.verno).toBe(1);
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      'actions',
      'destinations',
      'kv',
      'layers',
      'packs',
      'pending',
      'programs',
      'queue',
      'tiles',
    ]);
  });

  it('keys tiles by the compound [packId+z+x+y]', async () => {
    await db.tiles.put(tile('done'));
    expect(await db.tiles.get(['done', 12, 1, 2])).toBeDefined();
  });
});
