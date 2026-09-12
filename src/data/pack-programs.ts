import { keptDiff, packProgramsFor } from '../core/recover';
import { exactTextBytes } from '../core/pack-offer';
import type { Pack, PackFile, PackProgram } from '../core/types';
import { db, listCompletePacks } from './db';
import { fileMeta, manifestGroup } from './integrity';
import { loadSourceFiles } from './source-files';
import sources from './sources.json';

// Every complete pack mirrors the kept list: keeping a program adds its row and
// the copy of its page to each pack, releasing removes them, and the pack's
// manifest and stated size are rewritten with the rows in one transaction.

const rendered = (url: string) => sources.some((source) => source.url === url);

/** The page copies for the programs joining a pack. One page that cannot be
 *  read leaves only that program without a copy, as at pack build. */
async function pageCopies(packId: string, rows: PackProgram[]): Promise<PackFile[]> {
  const files = await Promise.all(
    rows
      .filter((row) => rendered(row.officialUrl))
      .map((row) => loadSourceFiles(packId, [row.officialUrl]).catch(() => [])),
  );
  return files.flat();
}

async function syncPack(pack: Pack, kept: readonly string[]): Promise<void> {
  const have = await db.packPrograms.where('packId').equals(pack.id).toArray();
  const diff = keptDiff(have.map((row) => row.programId), kept);
  if (diff.add.length === 0 && diff.remove.length === 0) return;

  const programs = await db.programs.toArray();
  const added = packProgramsFor(pack.id, programs, diff.add);
  const rows = [...have.filter((row) => !diff.remove.includes(row.programId)), ...added];
  const keptUrls = new Set(rows.map((row) => row.officialUrl));
  const removedUrls = have
    .filter((row) => diff.remove.includes(row.programId))
    .map((row) => row.officialUrl)
    .filter((url) => !keptUrls.has(url));
  const [layers, destinations, stored] = await Promise.all([
    db.layers.where('packId').equals(pack.id).toArray(),
    db.destinations.where('packId').equals(pack.id).toArray(),
    db.files.where('packId').equals(pack.id).toArray(),
  ]);
  const addedFiles = await pageCopies(pack.id, added);
  const files = [...stored.filter((file) => !removedUrls.includes(file.url)), ...addedFiles];

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
    await db.packPrograms.where('packId').equals(pack.id).filter((row) => diff.remove.includes(row.programId)).delete();
    await db.packPrograms.bulkAdd(added);
    await db.files.where('packId').equals(pack.id).filter((file) => removedUrls.includes(file.url)).delete();
    await db.files.bulkAdd(addedFiles);
    await db.packs.update(pack.id, update);
  });
}

/** Bring every complete pack in line with the kept list. */
export async function syncKeptIntoPacks(kept: readonly string[]): Promise<void> {
  for (const pack of await listCompletePacks()) await syncPack(pack, kept);
}
