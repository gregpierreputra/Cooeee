import { canonicalJson, exactTextBytes, offerMatchesStoredSize } from '../core/pack-offer';
import type {
  Pack,
  PackManifest,
  PackOffer,
  RecoveryProgram,
  Source,
  TextPackContent,
} from '../core/types';
import { db } from './db';

export type TileOfferMetadata = {
  bytes: number;
  count: number;
  available: boolean;
};

function validSource(source: Source): boolean {
  return source.publisher.trim().length > 0
    && source.url.trim().length > 0
    && source.licence.trim().length > 0
    && Number.isFinite(source.retrievedAt);
}

function assertContent(content: TextPackContent): void {
  if (content.pack.sources.length === 0 || content.pack.sources.some((source) => !validSource(source))) {
    throw new TypeError('pack must carry complete source provenance');
  }
  if (content.layers.some((row) => row.packId !== content.pack.id || !validSource(row.source))) {
    throw new TypeError('every layer must belong to the pack and carry complete source provenance');
  }
  if (content.destinations.some((row) => row.packId !== content.pack.id || !validSource(row.source))) {
    throw new TypeError('every destination must belong to the pack and carry complete source provenance');
  }
  if (content.recovery.some((row) => !validSource(row.source))) {
    throw new TypeError('every recovery item must carry complete source provenance');
  }
}

async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function textManifest(content: TextPackContent): Promise<PackOffer['textManifest']> {
  return {
    layers: { count: content.layers.length, sha256: await sha256(content.layers) },
    destinations: {
      count: content.destinations.length,
      sha256: await sha256(content.destinations),
    },
    recovery: { count: content.recovery.length, sha256: await sha256(content.recovery) },
  };
}

/** Produces AC9 metadata only. It performs no fetch and no device write. */
export async function createPackOffer(
  content: TextPackContent,
  tiles: TileOfferMetadata,
): Promise<PackOffer> {
  assertContent(content);
  if (!Number.isInteger(tiles.bytes) || tiles.bytes < 0) {
    throw new RangeError('tile bytes must be a non-negative integer');
  }
  if (!Number.isInteger(tiles.count) || tiles.count < 0) {
    throw new RangeError('tile count must be a non-negative integer');
  }
  return {
    version: 1,
    textBytes: exactTextBytes(content),
    tileBytes: tiles.bytes,
    tileCount: tiles.count,
    tilesAvailable: tiles.available,
    textManifest: await textManifest(content),
  };
}

function textOnlyManifest(offer: PackOffer): PackManifest {
  return {
    version: 1,
    groups: {
      ...offer.textManifest,
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
): Promise<void> {
  assertContent(content);
  const recovery = await storedRecovery(content.recovery);
  const rebuiltOffer = await createPackOffer({ ...content, recovery }, {
    bytes: offer.tileBytes,
    count: offer.tileCount,
    available: offer.tilesAvailable,
  });
  if (canonicalJson(rebuiltOffer) !== canonicalJson(offer)) {
    throw new Error('pack offer no longer matches the proposed content');
  }

  const buildingPack: Pack = {
    ...content.pack,
    status: 'building',
    verifiedAt: 0,
    builtWithTiles: false,
    sizeBytes: { text: offer.textBytes, tiles: 0 },
    manifest: textOnlyManifest(offer),
  };

  await db.transaction('rw', db.packs, db.layers, db.destinations, async () => {
    if (await db.packs.get(buildingPack.id)) throw new Error('pack id already exists');
    await db.packs.add(buildingPack);
    await db.layers.bulkAdd(content.layers);
    await db.destinations.bulkAdd(content.destinations);
  });
}

/** Immediate transaction-safe cleanup. A complete pack is never removed here. */
export async function discardBuildingPack(packId: string): Promise<void> {
  await db.transaction('rw', db.packs, db.layers, db.destinations, db.tiles, async () => {
    const pack = await db.packs.get(packId);
    if (pack?.status !== 'building') return;
    await db.layers.where('packId').equals(packId).delete();
    await db.destinations.where('packId').equals(packId).delete();
    await db.tiles.where('packId').equals(packId).delete();
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
  const recovery = await storedRecovery(content.recovery);
  const verifiedOffer = await createPackOffer(
    {
      pack: content.pack,
      layers,
      destinations,
      recovery,
    },
    {
      bytes: offer.tileBytes,
      count: offer.tileCount,
      available: offer.tilesAvailable,
    },
  );
  if (canonicalJson(verifiedOffer) !== canonicalJson(offer)
    || !offerMatchesStoredSize(offer, staged.sizeBytes, false)
    || canonicalJson(staged.manifest) !== canonicalJson(textOnlyManifest(offer))) {
    throw new Error('staged pack failed manifest or size verification');
  }

  await db.transaction('rw', db.packs, db.layers, db.destinations, db.tiles, async () => {
    const current = await db.packs.get(staged.id);
    if (current?.status !== 'building') throw new Error('building pack changed before finalisation');
    const oldId = current.supersedes;
    if (oldId) {
      const old = await db.packs.get(oldId);
      if (old?.status !== 'complete') throw new Error('superseded complete pack is missing');
      await db.layers.where('packId').equals(oldId).delete();
      await db.destinations.where('packId').equals(oldId).delete();
      await db.tiles.where('packId').equals(oldId).delete();
      await db.packs.delete(oldId);
    }
    await db.packs.update(current.id, { status: 'complete', verifiedAt });
  });
}

export async function saveTextOnlyPack(
  content: TextPackContent,
  offer: PackOffer,
  verifiedAt: number,
): Promise<void> {
  try {
    await stageTextOnlyPack(content, offer);
    await verifyAndFinalizeTextOnlyPack(content, offer, verifiedAt);
  } catch (error) {
    await discardBuildingPack(content.pack.id);
    throw error;
  }
}
