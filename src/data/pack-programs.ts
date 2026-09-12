import { keptDiff, packProgramsFor } from '../core/recover';
import { exactTextBytes } from '../core/pack-offer';
import type { Pack, PackFile } from '../core/types';
import { db, listCompletePacks } from './db';
import { fileMeta, manifestGroup } from './integrity';
import { hasRenderedCopy, loadSourceFiles } from './source-files';

// Every complete pack mirrors the kept list: keeping a program adds its row and
// the copy of its page to each pack, releasing removes them, and the pack's
// manifest and stated size are rewritten with the rows in one transaction.

async function syncPack(pack: Pack, kept: readonly string[]): Promise<void> {
  const have = await db.packPrograms.where('packId').equals(pack.id).toArray();
  const diff = keptDiff(have.map((row) => row.programId), kept);
  const programs = await db.programs.toArray();
  const rows = [
    ...have.filter((row) => !diff.remove.includes(row.programId)),
    ...packProgramsFor(pack.id, programs, diff.add),
  ];
  const [layers, destinations, stored] = await Promise.all([
    db.layers.where('packId').equals(pack.id).toArray(),
    db.destinations.where('packId').equals(pack.id).toArray(),
    db.files.where('packId').equals(pack.id).toArray(),
  ]);

  // The page copies the pack is missing, one per page whatever shares it. A
  // copy that could not be read this visit is asked for again next visit.
  const keptUrls = new Set(rows.map((row) => row.officialUrl));
  const missing = [...keptUrls].filter((url) => hasRenderedCopy(url) && !stored.some((file) => file.url === url));
  if (diff.add.length === 0 && diff.remove.length === 0 && missing.length === 0) return;
  const added: PackFile[] = await loadSourceFiles(pack.id, missing).catch(() => []);
  const removedUrls = have
    .filter((row) => diff.remove.includes(row.programId))
    .map((row) => row.officialUrl)
    .filter((url) => !keptUrls.has(url));
  const files = [...stored.filter((file) => !removedUrls.includes(file.url)), ...added];

  // Hashed before the write: a hash awaited inside a Dexie transaction would
  // commit it early. The pack row is rewritten with its rows in one transaction.
  const { status, verifiedAt, builtWithTiles, sizeBytes, manifest, ...seed } = pack;
  void status; void verifiedAt; void builtWithTiles;
  const update = {
    manifest: {
      ...manifest,
      groups: {
        ...manifest.groups,
        recovery: await manifestGroup(rows),
        files: await manifestGroup(files.map(fileMeta)),
      },
    },
    sizeBytes: {
      ...sizeBytes,
      text: exactTextBytes({ pack: seed, layers, destinations, recovery: rows }),
      files: files.reduce((total, file) => total + file.bytes.byteLength, 0),
    },
  };

  await db.transaction('rw', [db.packs, db.packPrograms, db.files], async () => {
    // A pack deleted or superseded since it was read gets no orphan rows.
    if ((await db.packs.get(pack.id))?.status !== 'complete') return;
    await db.packPrograms.where('packId').equals(pack.id).filter((row) => diff.remove.includes(row.programId)).delete();
    await db.packPrograms.bulkPut(rows);
    await db.files.where('packId').equals(pack.id).filter((file) => removedUrls.includes(file.url)).delete();
    await db.files.bulkPut(added);
    await db.packs.update(pack.id, update);
  });
}

/** Bring every complete pack in line with the kept list. */
export async function syncKeptIntoPacks(kept: readonly string[]): Promise<void> {
  for (const pack of await listCompletePacks()) await syncPack(pack, kept);
}
