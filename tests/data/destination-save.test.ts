import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import { chosenDestinations, orderByDistance } from '../../src/core/destination';
import { destinationsForPack, toDestination } from '../../src/core/nsp';
import type { PackSeed, TextPackContent } from '../../src/core/types';
import { db, getCompletePackContent, listCompletePacks } from '../../src/data/db';
import {
  createPackOffer,
  discardBuildingPack,
  saveTextOnlyPack,
  stageTextOnlyPack,
} from '../../src/data/pack-build';
import { KALORAMA, nspSite, nspSnapshot, pack } from '../fixtures';

function seed(over: Partial<PackSeed> = {}): PackSeed {
  const { status, verifiedAt, builtWithTiles, sizeBytes, manifest, ...value } = pack();
  void status;
  void verifiedAt;
  void builtWithTiles;
  void sizeBytes;
  void manifest;
  return { ...value, ...over };
}

const snapshot = nspSnapshot({
  sites: [
    nspSite({ id: 's-near', name: 'Near Reserve', lat: KALORAMA.lat + 0.01, lon: KALORAMA.lon }),
    nspSite({ id: 's-mid', name: 'Mid Reserve', lat: KALORAMA.lat + 0.03, lon: KALORAMA.lon }),
    nspSite({ id: 's-far', name: 'Far Reserve', lat: KALORAMA.lat + 0.045, lon: KALORAMA.lon }),
  ],
});
const selection = { located: snapshot.sites, unlocated: [] };
const ordered = orderByDistance(
  snapshot.sites.map((site) => toDestination(site, 'pack-1', snapshot)),
  KALORAMA,
).ordered;

const contentWith = (ids: string[]): TextPackContent => ({
  pack: seed(),
  layers: [],
  destinations: destinationsForPack(
    selection,
    chosenDestinations(ordered, ids),
    'pack-1',
    snapshot,
    'Yarra Ranges',
  ),
  recovery: [],
});

const tiles = { bytes: 0, count: 0, available: false };

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe("E2-US2-AC1 saving the user's two picks", () => {
  it('persists exactly the two chosen places, marked chosen, each with its distance', async () => {
    const content = contentWith(['pack-1:s-far', 'pack-1:s-near']);
    const offer = await createPackOffer(content, tiles);

    await saveTextOnlyPack(content, offer, 999);

    expect((await listCompletePacks()).map(({ id }) => id)).toEqual(['pack-1']);
    const rows = await db.destinations.where('packId').equals('pack-1').toArray();
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id).sort()).toEqual(['pack-1:s-far', 'pack-1:s-near']);
    expect(rows.every((row) => row.chosen === true && row.kind === 'nsp-bushfire')).toBe(true);
    expect(rows.every((row) => typeof row.distanceM === 'number')).toBe(true);
    expect((await db.packs.get('pack-1'))?.manifest.groups.destinations.count).toBe(2);
  });

  it('the two rows survive a reopen unchanged', async () => {
    const content = contentWith(['pack-1:s-near', 'pack-1:s-mid']);
    const offer = await createPackOffer(content, tiles);
    await saveTextOnlyPack(content, offer, 999);

    const readBack = await getCompletePackContent('pack-1');
    expect(readBack?.destinations).toHaveLength(2);
    expect(readBack?.destinations.map((row) => row.id).sort()).toEqual([
      'pack-1:s-mid',
      'pack-1:s-near',
    ]);
  });

  it('never persists a third place', async () => {
    expect(() => contentWith(['pack-1:s-near', 'pack-1:s-mid', 'pack-1:s-far'])).toThrow(/at most 2/);
    expect(await db.destinations.count()).toBe(0);
  });

  it('an interrupted save leaves no pack and no rows', async () => {
    const content = contentWith(['pack-1:s-near', 'pack-1:s-mid']);
    const offer = await createPackOffer(content, tiles);
    await stageTextOnlyPack(content, offer);
    expect(await listCompletePacks()).toEqual([]);

    await discardBuildingPack('pack-1');

    expect(await db.packs.count()).toBe(0);
    expect(await db.destinations.count()).toBe(0);
  });
});
