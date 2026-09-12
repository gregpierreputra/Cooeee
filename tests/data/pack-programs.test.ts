import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import { db, getCompletePackContent } from '../../src/data/db';
import { syncKeptIntoPacks } from '../../src/data/pack-programs';
import { pack, program } from '../fixtures';

// The program's page has no rendered copy in the register, so no request is made.
beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.packs.put(pack());
  await db.programs.put(program());
});

describe('syncKeptIntoPacks', () => {
  it('adds a kept program to a saved pack and re-hashes the manifest, then removes it when released', async () => {
    await syncKeptIntoPacks(['prog-1']);
    let content = await getCompletePackContent('pack-1');
    expect(content?.recovery.map((row) => row.programId)).toEqual(['prog-1']);
    expect(content?.recoveryVerified).toBe(true);
    expect((await db.packs.get('pack-1'))?.manifest.groups.recovery.count).toBe(1);

    await syncKeptIntoPacks([]);
    content = await getCompletePackContent('pack-1');
    expect(content?.recovery).toEqual([]);
    expect(content?.recoveryVerified).toBe(true);
  });

  it('leaves a pack untouched when nothing changes', async () => {
    const before = await db.packs.get('pack-1');
    await syncKeptIntoPacks([]);
    expect(await db.packs.get('pack-1')).toEqual(before);
  });
});
