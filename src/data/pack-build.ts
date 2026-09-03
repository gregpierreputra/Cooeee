import { canonicalJson, exactTextBytes, offerMatchesStoredSize } from '../core/pack-offer';
import { hasCompleteSource, prepareProvenancedContent, type OmittedItem } from '../core/provenance';
import type {
  Pack,
  PackFile,
  PackFileMeta,
  PackManifest,
  PackNote,
  PackOffer,
  RecoveryProgram,
  TextPackContent,
} from '../core/types';
import { checkedNoteText, db, deleteOwnedRows, ownedTables } from './db';
import { manifestGroup } from './integrity';

function assertContent(content: TextPackContent): void {
  if (content.pack.sources.length === 0 || content.pack.sources.some((source) => !hasCompleteSource(source))) {
    throw new TypeError('pack must carry complete source provenance');
  }
  if (content.layers.some((row) => row.packId !== content.pack.id || !hasCompleteSource(row.source))) {
    throw new TypeError('every layer must belong to the pack and carry complete source provenance');
  }
  if (content.destinations.some((row) => row.packId !== content.pack.id || !hasCompleteSource(row.source))) {
    throw new TypeError('every destination must belong to the pack and carry complete source provenance');
  }
  if (content.recovery.some((row) => !hasCompleteSource(row.source))) {
    throw new TypeError('every recovery item must carry complete source provenance');
  }
}

async function textManifest(content: TextPackContent): Promise<PackOffer['textManifest']> {
  return {
    layers: await manifestGroup(content.layers),
    destinations: await manifestGroup(content.destinations),
    recovery: await manifestGroup(content.recovery),
  };
}

/** What the offer states about a file: everything but the bytes themselves. */
const fileMeta = ({ bytes, ...meta }: PackFile): PackFileMeta => {
  void bytes;
  return meta;
};

async function createPreparedPackOffer(
  content: TextPackContent,
  omittedItems: OmittedItem[],
  files: PackFile[],
): Promise<PackOffer> {
  assertContent(content);
  return {
    version: 1,
    textBytes: exactTextBytes(content),
    files: files.map(fileMeta),
    fileBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0),
    omittedItems,
    textManifest: await textManifest(content),
  };
}

/** Produces AC9 metadata only. It performs no fetch and no device write. */
export async function createPackOffer(
  content: TextPackContent,
  files: PackFile[] = [],
): Promise<PackOffer> {
  const prepared = prepareProvenancedContent(content);
  return createPreparedPackOffer(prepared.content, prepared.omittedItems, files);
}

async function textOnlyManifest(offer: PackOffer): Promise<PackManifest> {
  return {
    version: 1,
    groups: {
      ...offer.textManifest,
      files: await manifestGroup(offer.files),
      tiles: { count: 0, bytes: 0 },
    },
  };
}

async function storedRecovery(rows: readonly RecoveryProgram[]): Promise<RecoveryProgram[]> {
  const stored = await db.programs.bulkGet(rows.map(({ id }) => id));
  if (stored.some((row) => row === undefined)) {
    throw new Error('a recovery item required by the pack is not present on the device');
  }
  return stored as RecoveryProgram[];
}

/** First AC9 write: one hidden building pack plus its owned text rows. */
export async function stageTextOnlyPack(
  content: TextPackContent,
  offer: PackOffer,
  files: PackFile[] = [],
  note?: PackNote,
): Promise<void> {
  const prepared = prepareProvenancedContent(content);
  assertContent(prepared.content);
  const recovery = await storedRecovery(prepared.content.recovery);
  const rebuiltOffer = await createPreparedPackOffer(
    { ...prepared.content, recovery },
    prepared.omittedItems,
    files,
  );
  if (canonicalJson(rebuiltOffer) !== canonicalJson(offer)) {
    throw new Error('pack offer no longer matches the proposed content');
  }

  const buildingPack: Pack = {
    ...prepared.content.pack,
    status: 'building',
    verifiedAt: 0,
    builtWithTiles: false,
    sizeBytes: { text: offer.textBytes, files: offer.fileBytes, tiles: 0 },
    manifest: await textOnlyManifest(offer),
  };

  await db.transaction('rw', [db.packs, db.layers, db.destinations, db.files, db.notes], async () => {
    if (await db.packs.get(buildingPack.id)) throw new Error('pack id already exists');
    await db.packs.add(buildingPack);
    await db.layers.bulkAdd(prepared.content.layers);
    await db.destinations.bulkAdd(prepared.content.destinations);
    await db.files.bulkAdd(files);
    if (note) await db.notes.add(note);
  });
}

/** Immediate transaction-safe cleanup. A complete pack is never removed here. */
export async function discardBuildingPack(packId: string): Promise<void> {
  await db.transaction('rw', [db.packs, ...ownedTables()], async () => {
    const pack = await db.packs.get(packId);
    if (pack?.status !== 'building') return;
    await deleteOwnedRows([packId]);
    await db.packs.delete(packId);
  });
}

/** Re-read and verify outside the final transaction, then atomically expose the
 * new pack and, when applicable, remove the superseded pack and owned rows. */
export async function verifyAndFinalizeTextOnlyPack(
  content: TextPackContent,
  offer: PackOffer,
  verifiedAt: number,
): Promise<void> {
  const staged = await db.packs.get(content.pack.id);
  if (staged?.status !== 'building') throw new Error('building pack is missing');
  const layers = await db.layers.where('packId').equals(staged.id).toArray();
  const destinations = await db.destinations.where('packId').equals(staged.id).toArray();
  // Each stored file is re-measured; its hash is the one recorded at fetch time.
  const files = (await db.files.where('packId').equals(staged.id).toArray())
    .map((file) => ({ ...file, sizeBytes: file.bytes.byteLength }));
  const prepared = prepareProvenancedContent(content);
  const recovery = await storedRecovery(prepared.content.recovery);
  const verifiedOffer = await createPreparedPackOffer(
    {
      pack: prepared.content.pack,
      layers,
      destinations,
      recovery,
    },
    prepared.omittedItems,
    files,
  );
  if (canonicalJson(verifiedOffer) !== canonicalJson(offer)
    || !offerMatchesStoredSize(offer, staged.sizeBytes)
    || canonicalJson(staged.manifest) !== canonicalJson(await textOnlyManifest(offer))) {
    throw new Error('staged pack failed manifest or size verification');
  }

  await db.transaction('rw', [db.packs, ...ownedTables()], async () => {
    const current = await db.packs.get(staged.id);
    if (current?.status !== 'building') throw new Error('building pack changed before finalisation');
    const oldId = current.supersedes;
    if (oldId) {
      const old = await db.packs.get(oldId);
      if (old?.status !== 'complete') throw new Error('superseded complete pack is missing');
      await deleteOwnedRows([oldId]);
      await db.packs.delete(oldId);
    }
    await db.packs.update(current.id, { status: 'complete', verifiedAt });
  });
}

export async function saveTextOnlyPack(
  content: TextPackContent,
  offer: PackOffer,
  verifiedAt: number,
  files: PackFile[] = [],
  noteText?: string,
): Promise<void> {
  // The first note is written with the pack itself, so it is exactly as
  // atomic — and as invisible until the pack is complete — as the rest.
  const note = noteText === undefined ? undefined : {
    id: crypto.randomUUID(),
    packId: content.pack.id,
    text: checkedNoteText(noteText),
    updatedAt: verifiedAt,
  };
  try {
    await stageTextOnlyPack(content, offer, files, note);
    await verifyAndFinalizeTextOnlyPack(content, offer, verifiedAt);
  } catch (error) {
    await discardBuildingPack(content.pack.id);
    throw error;
  }
}
