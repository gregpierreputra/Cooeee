import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import type { PackSeed, TextPackContent } from '../../src/core/types';
import {
  createPackOffer,
  discardBuildingPack,
  saveTextOnlyPack,
  stageTextOnlyPack,
  verifyAndFinalizeTextOnlyPack,
} from '../../src/data/pack-build';
import { db, getCompletePackContent, listCompletePacks } from '../../src/data/db';
import { destination, pack, program, source } from '../fixtures';

function seed(over: Partial<PackSeed> = {}): PackSeed {
  const complete = pack();
  const { status, verifiedAt, builtWithTiles, sizeBytes, manifest, ...value } = complete;
  void status;
  void verifiedAt;
  void builtWithTiles;
  void sizeBytes;
  void manifest;
  return { ...value, ...over };
}

const recovery = program();
const content = (over: Partial<TextPackContent> = {}): TextPackContent => ({
  pack: seed(),
  layers: [{
    id: 'pack-1:BPA',
    packId: 'pack-1',
    group: 'designation',
    code: 'BPA',
    status: 'present',
    features: [{ planNumber: 'LEGL./25-138', gazettalDate: '10/07/2025' }],
    checkedAt: 1,
    source: source({ publisher: 'Department of Transport and Planning' }),
  }],
  destinations: [destination()],
  recovery: [recovery],
  ...over,
});


beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.programs.put(recovery);
});

describe('E1-US1-AC9 offer preparation', () => {
  it('computes metadata without writing any store', async () => {
    const offer = await createPackOffer(content());
    expect(offer).toMatchObject({
      version: 1,
      textManifest: {
        layers: { count: 1 }, destinations: { count: 1 }, recovery: { count: 1 },
      },
    });
    expect(await db.packs.count()).toBe(0);
    expect(await db.layers.count()).toBe(0);
    expect(await db.destinations.count()).toBe(0);
    expect(await db.tiles.count()).toBe(0);
  });

  it('requires provenance on every proposed item', async () => {
    const bad = content({
      destinations: [destination({ source: source({ publisher: '' }) })],
    });
    const offer = await createPackOffer(bad);
    expect(offer.omittedItems).toEqual([
      { id: 'pack-1:nsp-0001', missing: 'publisher' },
    ]);
    expect(offer.textManifest.destinations.count).toBe(0);
  });

  it('omits an item with no saved date from both the offer and stored rows', async () => {
    const proposed = content({
      destinations: [destination({ source: source({ retrievedAt: 0 }) })],
    });
    const offer = await createPackOffer(proposed);

    await saveTextOnlyPack(proposed, offer, 999);

    expect(offer.omittedItems).toEqual([
      { id: 'pack-1:nsp-0001', missing: 'saved-date' },
    ]);
    expect(await db.destinations.count()).toBe(0);
    expect((await listCompletePacks()).map(({ id }) => id)).toEqual(['pack-1']);
  });

  it('still rejects a retained item whose non-display provenance is incomplete', async () => {
    const bad = content({ destinations: [destination({ source: source({ licence: '' }) })] });
    await expect(createPackOffer(bad)).rejects.toThrow('destination');
  });
});

describe('E1-US1-AC9 text-only staging and finalisation', () => {
  it('writes nothing before consent, then stores an exact zero-tile complete pack', async () => {
    const proposed = content();
    const offer = await createPackOffer(proposed);
    expect(await listCompletePacks()).toEqual([]);

    await saveTextOnlyPack(proposed, offer, 999);

    const saved = await listCompletePacks();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      id: 'pack-1', status: 'complete', verifiedAt: 999, builtWithTiles: false,
      sizeBytes: { text: offer.textBytes, tiles: 0 },
      manifest: { groups: { tiles: { count: 0, bytes: 0 } } },
    });
    expect(await db.tiles.count()).toBe(0);
  });

  it('stores the PDF copies of the source pages, counted in the size and the manifest', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.7 test').buffer;
    const file = {
      id: 'pack-1:page.pdf', packId: 'pack-1', url: 'https://www.cfa.vic.gov.au/page',
      name: 'page.pdf', retrievedAt: 5, sizeBytes: bytes.byteLength, sha256: 'test-only', bytes,
    };
    const proposed = content();
    const offer = await createPackOffer(proposed, [file]);
    expect(offer.fileBytes).toBe(bytes.byteLength);
    await saveTextOnlyPack(proposed, offer, 999, [file]);

    const stored = (await getCompletePackContent('pack-1'))!;
    expect(stored.pack.sizeBytes).toEqual({ text: offer.textBytes, files: bytes.byteLength, tiles: 0 });
    expect(stored.pack.manifest.groups.files?.count).toBe(1);
    expect(stored.files.map(({ name, bytes: b }) => [name, b.byteLength])).toEqual([['page.pdf', bytes.byteLength]]);
  });

  it('stage then cancel immediately removes every owned row', async () => {
    const proposed = content();
    const offer = await createPackOffer(proposed);
    await stageTextOnlyPack(proposed, offer);
    expect(await listCompletePacks()).toEqual([]);

    await discardBuildingPack(proposed.pack.id);

    expect(await db.packs.count()).toBe(0);
    expect(await db.layers.count()).toBe(0);
    expect(await db.destinations.count()).toBe(0);
    expect(await db.tiles.count()).toBe(0);
  });

  it('rejects tampering and can then clean the hidden build', async () => {
    const proposed = content();
    const offer = await createPackOffer(proposed);
    await stageTextOnlyPack(proposed, offer);
    await db.layers.update('pack-1:BPA', { checkedAt: 2 });

    await expect(verifyAndFinalizeTextOnlyPack(proposed, offer, 999))
      .rejects.toThrow('verification');
    expect(await listCompletePacks()).toEqual([]);
    await discardBuildingPack('pack-1');
    expect(await db.packs.count()).toBe(0);
  });

  it('keeps the previous pack byte-identical when staging fails', async () => {
    const old = pack({ id: 'old-pack', address: 'OLD ADDRESS' });
    await db.packs.put(old);
    const before = structuredClone(await db.packs.get(old.id));
    const proposed = content({
      pack: seed({ id: 'new-pack', supersedes: old.id }),
      layers: [],
      destinations: [],
      recovery: [{ ...recovery, id: 'missing-program' }],
    });
    const offer = await createPackOffer(proposed);

    await expect(saveTextOnlyPack(proposed, offer, 999)).rejects.toThrow('not present');
    expect(await db.packs.get(old.id)).toEqual(before);
    expect((await listCompletePacks()).map(({ id }) => id)).toEqual(['old-pack']);
  });

  it('atomically exposes the replacement and removes the old owned rows', async () => {
    const old = pack({ id: 'old-pack', address: 'OLD ADDRESS' });
    await db.packs.put(old);
    await db.layers.put({ ...content().layers[0], id: 'old-pack:BPA', packId: 'old-pack' });
    await db.destinations.put(destination({ id: 'old-pack:d', packId: 'old-pack' }));
    await db.tiles.put({ packId: 'old-pack', z: 12, x: 1, y: 2, bytes: new Blob(['old']) });

    const proposed = content({
      pack: seed({ id: 'new-pack', supersedes: old.id, address: 'NEW ADDRESS' }),
      layers: [{ ...content().layers[0], id: 'new-pack:BPA', packId: 'new-pack' }],
      destinations: [destination({ id: 'new-pack:d', packId: 'new-pack' })],
    });
    const offer = await createPackOffer(proposed);
    await saveTextOnlyPack(proposed, offer, 999);

    expect((await listCompletePacks()).map(({ id }) => id)).toEqual(['new-pack']);
    expect(await db.layers.where('packId').equals('old-pack').count()).toBe(0);
    expect(await db.destinations.where('packId').equals('old-pack').count()).toBe(0);
    expect(await db.tiles.where('packId').equals('old-pack').count()).toBe(0);
  });
});
