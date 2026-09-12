import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readFileSync } from 'node:fs';
import { db, getCompletePackContent } from '../../src/data/db';
import { syncKeptIntoPacks } from '../../src/data/pack-programs';
import sources from '../../src/data/sources.json';
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

  it('stores the page copy of a kept program, re-hashes the files group, and shares one page between two programs', async () => {
    const page = sources[2]; // a program page the build rendered
    const bytes = readFileSync(`public/data/sources/${page.name}`);
    vi.stubGlobal('fetch', async () => new Response(bytes, { status: 200 }));
    await db.programs.bulkPut([
      program({ id: 'p-a', officialUrl: page.url }),
      program({ id: 'p-b', officialUrl: page.url }),
    ]);

    await syncKeptIntoPacks(['p-a', 'p-b']);
    let content = await getCompletePackContent('pack-1');
    expect(content?.recovery).toHaveLength(2);
    expect(content?.files.map((file) => file.name)).toEqual([page.name]);
    expect(content?.contentVerified).toBe(true);
    expect((await db.packs.get('pack-1'))?.sizeBytes.files).toBe(bytes.byteLength);

    await syncKeptIntoPacks(['p-b']);
    content = await getCompletePackContent('pack-1');
    expect(content?.files).toHaveLength(1); // the other program still uses the page
    await syncKeptIntoPacks([]);
    content = await getCompletePackContent('pack-1');
    expect(content?.files).toEqual([]);
    expect(content?.contentVerified).toBe(true);
    vi.unstubAllGlobals();
  });

  it('leaves a pack untouched when nothing changes', async () => {
    const before = await db.packs.get('pack-1');
    await syncKeptIntoPacks([]);
    expect(await db.packs.get('pack-1')).toEqual(before);
  });
});
