import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import { absenceRow } from '../../src/core/destination';
import { packDetailAbsence, packDetailItems } from '../../src/core/provenance';
import type { PackSeed, TextPackContent } from '../../src/core/types';
import { db, getCompletePackContent, listCompletePacks } from '../../src/data/db';
import {
  createPackOffer,
  discardBuildingPack,
  saveTextOnlyPack,
  stageTextOnlyPack,
} from '../../src/data/pack-build';
import { pack, program, source } from '../fixtures';

const recovery = program();

function seed(over: Partial<PackSeed> = {}): PackSeed {
  const { status, verifiedAt, builtWithTiles, sizeBytes, manifest, ...value } = pack();
  void status;
  void verifiedAt;
  void builtWithTiles;
  void sizeBytes;
  void manifest;
  return { ...value, ...over };
}

/** The last-resort step found nothing published for the pack's area, so the
 *  pack carries one row: the absence marker (E2-US1-AC3). */
const nonePublished = (): TextPackContent => ({
  pack: seed(),
  layers: [],
  destinations: [absenceRow('pack-1', 'Yarra Ranges', source())],
  recovery: [recovery],
});


beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.programs.put(recovery);
});

describe('E2-US1-AC3 a pack with no published places still saves', () => {
  it('stores the absence marker and a complete pack — no place rows', async () => {
    const content = nonePublished();
    const offer = await createPackOffer(content);

    await saveTextOnlyPack(content, offer, 999);

    expect((await listCompletePacks()).map(({ id }) => id)).toEqual(['pack-1']);
    const rows = await db.destinations.where('packId').equals('pack-1').toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'pack-1:absence', kind: 'absence' });
    expect(rows.filter((row) => row.kind === 'nsp-bushfire')).toEqual([]);

    const saved = await db.packs.get('pack-1');
    expect(saved?.manifest.groups.destinations.count).toBe(1);
  });

  it('reads back as its reason, never as an information item', async () => {
    const content = nonePublished();
    const offer = await createPackOffer(content);
    await saveTextOnlyPack(content, offer, 999);

    const readBack = await getCompletePackContent('pack-1');
    expect(readBack).toBeDefined();
    expect(packDetailAbsence(readBack!)).toBe(
      'No official place of last resort is published for this area — Yarra Ranges.',
    );
    expect(packDetailItems(readBack!).some((item) => item.id === 'pack-1:absence')).toBe(false);
  });

  it('an interrupted save leaves no pack and no absence row', async () => {
    const content = nonePublished();
    const offer = await createPackOffer(content);
    await stageTextOnlyPack(content, offer);
    expect(await listCompletePacks()).toEqual([]);

    await discardBuildingPack('pack-1');

    expect(await db.packs.count()).toBe(0);
    expect(await db.destinations.count()).toBe(0);
  });
});
