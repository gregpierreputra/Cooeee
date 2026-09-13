import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
afterEach(() => vi.unstubAllGlobals());

// A program page the build rendered, whatever order the register is in.
const page = sources.find((source) => source.name.startsWith('services-australia'))!;
const bytes = readFileSync(`public/data/sources/${page.name}`);

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
  });

  it('replaces a row and its page copy when the snapshot moved on', async () => {
    vi.stubGlobal('fetch', async () => new Response(bytes, { status: 200 }));
    await db.programs.put(program({ officialUrl: page.url, snapshotDate: '2026-09-11' }));
    // An older build: its own time on the source row, as the build script sets it.
    const older = program({ officialUrl: page.url, snapshotDate: '2026-08-01' });
    older.source = { ...older.source, retrievedAt: 1 };
    await db.packPrograms.put({ ...older, id: 'pack-1:prog-1', packId: 'pack-1', programId: 'prog-1' });
    await db.files.put({ id: 'pack-1:old.pdf', packId: 'pack-1', url: page.url, name: 'old.pdf', retrievedAt: 1, sizeBytes: 3, sha256: 'x', bytes: new Uint8Array([1, 2, 3]).buffer });

    await syncKeptIntoPacks(['prog-1']);
    const content = await getCompletePackContent('pack-1');
    expect(content?.recovery[0].snapshotDate).toBe('2026-09-11');
    expect(content?.files.map((file) => file.name)).toEqual([page.name]);
    expect(content?.recoveryVerified && content.contentVerified).toBe(true);
  });

  it('keeps the older copy when the current one cannot be read, and takes the other pages', async () => {
    const other = sources.find((source) => source.name.startsWith('cfa-'))!;
    vi.stubGlobal('fetch', async (url: string) => (url.endsWith(page.name)
      ? new Response('down', { status: 500 })
      : new Response(readFileSync(`public/data/sources/${other.name}`), { status: 200 })));
    await db.programs.bulkPut([program({ officialUrl: page.url }), program({ id: 'p-cfa', officialUrl: other.url })]);
    await db.packPrograms.put({ ...program({ officialUrl: page.url }), id: 'pack-1:prog-1', packId: 'pack-1', programId: 'prog-1' });
    await db.files.put({ id: 'pack-1:old.pdf', packId: 'pack-1', url: page.url, name: 'old.pdf', retrievedAt: 1, sizeBytes: 3, sha256: 'x', bytes: new Uint8Array([1, 2, 3]).buffer });

    await syncKeptIntoPacks(['prog-1', 'p-cfa']);
    expect((await db.files.toArray()).map((file) => file.name).sort()).toEqual(['old.pdf', other.name].sort());
  });

  it('leaves a pack untouched when nothing changes', async () => {
    const before = await db.packs.get('pack-1');
    await syncKeptIntoPacks([]);
    expect(await db.packs.get('pack-1')).toEqual(before);
  });
});
