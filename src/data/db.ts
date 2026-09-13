import Dexie, { type Table } from 'dexie';
import { NOTE_MAX_CHARS } from '../core/constants';
import { isRehearsalEnding, isUnfinished } from '../core/rehearsal-ending';
import type { RehearsalInput } from '../core/rehearsal-entry';
import type {
  ActionCompletion,
  BundleFacility,
  BundlePostcode,
  CompletePackContent,
  Destination,
  ExposureLayer,
  NspSnapshot,
  Pack,
  PackFile,
  PackNote,
  PackWithPlaces,
  PackProgram,
  RecoveryProgram,
  Rehearsal,
  SnapshotActivation,
  StoredRehearsal,
  StoredSnapshot,
  SyncMetaRow,
  TileRow,
  UnfinishedRehearsal,
} from '../core/types';
import { fileMeta, groupMatches, sha256Hex } from './integrity';

// ONE database. All user data lives here and nowhere else — no server holds any
// of it, because none of it is ever transmitted.
class CooeeeDb extends Dexie {
  packs!: Table<Pack, string>;
  layers!: Table<ExposureLayer, string>;
  destinations!: Table<Destination, string>;
  programs!: Table<RecoveryProgram, string>;
  packPrograms!: Table<PackProgram, string>;
  tiles!: Table<TileRow, [string, number, number, number]>;
  // The files saved with a pack: the PDF copies of its source pages and the
  // map of its area.
  files!: Table<PackFile, string>;
  // The user's own notes for a pack.
  notes!: Table<PackNote, string>;
  // Nearby places (spec §7.2): downloaded reference data, not user data.
  staticFacilities!: Table<BundleFacility, number>;
  postcodes!: Table<BundlePostcode, string>;
  dynamicSnapshot!: Table<SnapshotActivation, number>;
  syncMeta!: Table<SyncMetaRow, string>;
  // Rehearsals: finished ones, and started ones still waiting for an ending.
  rehearsals!: Table<StoredRehearsal, string>;
  // The reader's own record of the actions they have taken, per pack.
  actionCompletions!: Table<ActionCompletion, string>;
  // The CFA site list, for BlackSky's nearest-places pointer.
  snapshots!: Table<StoredSnapshot, string>;

  constructor() {
    super('cooeee');

    // A SHIPPED VERSION IS NEVER MUTATED. A schema change is a new db.version(n);
    // Dexie applies every version above the stored one, in order, on open.
    this.version(1).stores({
      packs: 'id, status, address',
      layers: 'id, packId',
      destinations: 'id, packId',
      programs: 'id',
      actions: 'id, createdAt',
      tiles: '[packId+z+x+y], packId',
      queue: 'id',
      pending: 'id',
      kv: 'key',
    });
    // Version 2 drops the four stores nothing ever wrote to, and the unused
    // address index on packs.
    this.version(2).stores({
      packs: 'id, status',
      actions: null,
      queue: null,
      pending: null,
      kv: null,
    });
    // Version 3 adds the four Nearby-places stores: the downloaded static
    // facilities and postcodes, the short-lived dynamic snapshot and the sync
    // bookkeeping. Nothing existing changes shape.
    this.version(3).stores({
      staticFacilities: 'facility_id',
      postcodes: 'postcode',
      dynamicSnapshot: 'activation_id',
      syncMeta: 'key',
    });
    // Version 4 adds the one-row store holding the CFA site list, so BlackSky
    // can point at the nearest official places without a network path.
    this.version(4).stores({ snapshots: 'name' });
    // Version 5 adds the store for the PDF copies of a pack's source pages.
    this.version(5).stores({ files: 'id, packId' });
    // Version 6 adds the store for the user's own notes on a pack.
    this.version(6).stores({ notes: 'id, packId' });
    // Version 7 adds the store for the programs a pack carries, one row per
    // kept program, owned and hashed like every other pack group.
    this.version(7).stores({ packPrograms: 'id, packId' });

    // Version 8 adds the rehearsals store, indexed by pack and by finish time,
    // which is what a later run needs to compare itself with the one before it.
    // Since E5-US1-AC5 the store also holds a rehearsal that has started and has
    // no ending yet, kept WITHOUT finishedAt and so absent from that index: see
    // listRehearsalsForPack below. That adds no index, so it needs no version,
    // and the line below is exactly as shipped.
    // EPIC 4 took version 7 for packPrograms before this branch landed, and a
    // shipped version is never mutated, so the rehearsal stores begin at 8.
    this.version(8).stores({ rehearsals: 'id, packId, finishedAt' });

    // Version 9 adds the reader's own record of the actions they have taken.
    // Keyed by pack and action rather than by rehearsal, so a completion
    // outlives the run that raised the gap.
    this.version(9).stores({ actionCompletions: 'id, packId' });
  }
}

/** The database handle. 
 * src/data/ only — ESLint blocks importing it from src/ui/,
 * because a raw table read from a component is how a half-built pack becomes visible. 
 * UI loaders must enter through the complete-pack guards below. */
export const db = new CooeeeDb();

/** The tables holding rows a pack owns, for every cascade. */
export const ownedTables = () => [
  db.layers,
  db.destinations,
  db.tiles,
  db.files,
  db.notes,
  // Pack CONTENT: the programs this pack carries are rebuilt when the pack is
  // rebuilt, so they cascade like every other group.
  db.packPrograms,
  // A rehearsal is about one pack. Deleting the pack takes its rehearsals with
  // it: a record of what was missing from a pack that no longer exists is not
  // information, it is a loose end. The same goes for the actions the reader
  // marked against that pack. REPLACING a pack is not deleting it, and takes
  // the other path — see historyTables() below.
  ...historyTables(),
];

/** The id of one completion. One per action per pack: marking the same action
 *  twice is the same record, not a second one. */
export const actionCompletionId = (packId: string, actionId: string): string =>
  `${packId}:${actionId}`;

/** The tables holding what the READER has built up about a pack over time,
 *  rather than what the pack itself contains: the rehearsals they have run and
 *  the actions they have marked done.
 *
 *  These are owned by a pack, so deleting a pack deletes them. But a pack that
 *  is REPLACED is not a pack that is gone: the reader kept the same place and
 *  refreshed what is stored for it, and their record of rehearsing that place
 *  belongs to the place rather than to the row that happened to hold it. So the
 *  replacement path moves these rather than deleting them (see
 *  carryHistoryToNewPack). An outright delete still takes them. */
export const historyTables = () => [db.rehearsals, db.actionCompletions];

/** Move one pack's rehearsals to another. The row's key is its own id, which
 *  says nothing about the pack, so only the field changes. */
const carryRehearsals = (oldId: string, newId: string): Promise<number> =>
  db.rehearsals.where('packId').equals(oldId).modify({ packId: newId });

/** Move one pack's action completions to another.
 *
 *  A completion's KEY embeds the pack it belongs to, so this is a delete and a
 *  re-put rather than a field change: leaving the old key in place would strand
 *  the row. It would still be listed for the new pack, so the reader would see
 *  their tick — but marking the same action again would write a SECOND row
 *  under the correct key, and unmarking would delete that one and leave the
 *  stranded row behind, so the tick would come back. */
async function carryCompletions(oldId: string, newId: string): Promise<void> {
  const rows = await db.actionCompletions.where('packId').equals(oldId).toArray();
  if (rows.length === 0) return;
  await db.actionCompletions.bulkDelete(rows.map((row) => row.id));
  await db.actionCompletions.bulkPut(
    rows.map((row) => ({
      ...row,
      id: actionCompletionId(newId, row.actionId),
      packId: newId,
    })),
  );
}

/** Move the reader's history from a pack being replaced onto the pack that
 *  replaces it. Callers run this inside their own transaction, which must list
 *  historyTables().
 *
 *  Without this, refreshing a pack would delete every rehearsal of it AND every
 *  action the reader had marked done against it — and the action a rehearsal
 *  most often asks for is to build the pack again, so doing what the product
 *  asked would destroy the record of having done it. */
export async function carryHistoryToNewPack(oldId: string, newId: string): Promise<void> {
  await carryRehearsals(oldId, newId);
  await carryCompletions(oldId, newId);
}

/** Remove every row the given packs own. Callers run this inside their own
 *  transaction, which must list ownedTables(). */
export async function deleteOwnedRows(packIds: string[]): Promise<void> {
  await Promise.all(ownedTables().map((table) => table.where('packId').anyOf(packIds).delete()));
}

/** THE read API — complete packs only. */
export const listCompletePacks = (): Promise<Pack[]> =>
  db.packs.where('status').equals('complete').toArray();

/** E5-US1-AC4 — everything the rehearsal entry gate needs, in one read.
 *
 *  The gate has to tell a pack that was never finished apart from no pack at
 *  all, and the complete-pack read API deliberately cannot: a building pack is
 *  invisible through it. So the two statuses are COUNTED here. Counts only, so
 *  no row of a half-built pack leaves this file, which is the rule the whole
 *  file is written to. A store that cannot be opened is reported as such
 *  rather than thrown, because "could not be read" is one of the four states
 *  the gate states and not an error the screen has to invent.
 *
 *  This function reads. It writes nothing, and nothing it calls writes. */
export async function readRehearsalSource(packId: string): Promise<Omit<RehearsalInput, 'now'>> {
  try {
    const [completeCount, unfinishedCount, content] = await Promise.all([
      db.packs.where('status').equals('complete').count(),
      db.packs.where('status').equals('building').count(),
      getCompletePackContent(packId),
    ]);
    return { completeCount, unfinishedCount, content: content ?? null };
  } catch {
    return { completeCount: 0, unfinishedCount: 0, content: 'unreadable' };
  }
}

/** E5-US1-AC5 — keep a rehearsal the moment it starts.
 *
 *  Written when the condition is chosen, as an UnfinishedRehearsal: no
 *  finishedAt, no gaps, no ending. A fifteen-minute walk with the phone locked
 *  and the app evicted then survives a cold start, which finds this row and asks
 *  her how it ended. Nothing here decides that for her.
 *
 *  `add`, not `put`: a start never overwrites a row, so it can never turn a
 *  finished rehearsal back into an unfinished one. */
export async function saveStartedRehearsal(started: UnfinishedRehearsal): Promise<void> {
  const claimsAnEnd = ['finishedAt', 'gaps', 'ending', 'elapsedMs'].some((field) => field in started);
  if (claimsAnEnd || !isUnfinished(started) || !(started.startedAt > 0)) {
    throw new RangeError('a started rehearsal is kept with no finish, no gaps and no ending');
  }
  await db.rehearsals.add(started);
}

/** The rehearsal on this pack still waiting for her to say how it ended, or
 *  null. If there were ever two, the one started first is asked about first. */
export async function findUnfinishedRehearsal(packId: string): Promise<UnfinishedRehearsal | null> {
  const rows = await db.rehearsals.where('packId').equals(packId).toArray();
  const unfinished = rows.filter(isUnfinished).sort((a, b) => a.startedAt - b.startedAt);
  return unfinished[0] ?? null;
}

/** E5-US2-AC1 — record ONE FINISHED rehearsal, with the gaps it found.
 *
 *  Written when the run has finished, over the row its start kept: the id is
 *  the run's own, so the unfinished row becomes the finished one in one put, and
 *  a screen that remounts rewrites the same row rather than recording the same
 *  rehearsal twice. The gaps go in with the row, so a rehearsal and what it found
 *  are never half-written with respect to each other.
 *
 *  An ending, where there is one, is one of the two she can give. None is added
 *  here: the app never supplies an ending on her behalf.
 *
 *  Action completions are NOT written here. They belong to the pack, not to a
 *  run, and they live in their own store. */
export async function saveFinishedRehearsal(rehearsal: Rehearsal): Promise<void> {
  if (!(rehearsal.finishedAt > 0) || rehearsal.finishedAt < rehearsal.startedAt) {
    throw new RangeError('a rehearsal is recorded only once it has finished');
  }
  if (rehearsal.ending !== undefined && !isRehearsalEnding(rehearsal.ending)) {
    throw new RangeError('a rehearsal ends only as walked or as a dry run');
  }
  // A time is kept only with a walked rehearsal, and only as what it is: the
  // time between that rehearsal's own start and end.
  if (
    rehearsal.elapsedMs !== undefined &&
    (rehearsal.ending !== 'walked' || rehearsal.elapsedMs !== rehearsal.finishedAt - rehearsal.startedAt)
  ) {
    throw new RangeError('a time is kept only on a walked rehearsal, as the time between its start and end');
  }
  await db.rehearsals.put(rehearsal);
}

/** Every FINISHED rehearsal for one pack, oldest first.
 *
 *  Read through the finishedAt index, and the index is the guarantee, not a
 *  filter: IndexedDB leaves a record out of an index when the record has no
 *  value at that index's key path. An unfinished rehearsal is kept with no
 *  finishedAt, so it is not in this index at all and cannot come back from this
 *  read. This is the only read behind comparableEarlier (E5-US2-AC2), so a
 *  journey that never happened can never be compared against. The cast states
 *  that guarantee as a type; tests/data/db.test.ts proves it. */
export const listRehearsalsForPack = (packId: string): Promise<Rehearsal[]> =>
  db.rehearsals
    .orderBy('finishedAt')
    .filter((row) => row.packId === packId)
    .toArray() as Promise<Rehearsal[]>;

/** Record that the reader has taken one of the actions a rehearsal gave them.
 *
 *  Idempotent: marking an action already marked rewrites the same row. */
export async function markActionDone(
  packId: string,
  actionId: string,
  doneAt: number,
): Promise<void> {
  if (!(doneAt > 0)) throw new RangeError('a completion is recorded with the date it was made');
  await db.actionCompletions.put({
    id: actionCompletionId(packId, actionId),
    packId,
    actionId,
    doneAt,
  });
}

/** Remove the reader's own completion, because they say it is not true.
 *
 *  THIS IS NOT THE PRODUCT UN-TICKING. "Never silently un-tick" is a rule about
 *  the PRODUCT: it may not decide a completion has gone stale and take it away,
 *  and nothing here or anywhere else expires one. A reader correcting a record
 *  they made themselves is a different act, and the two must not be read as the
 *  same rule — removing this function would not enforce the first one, it would
 *  only leave a mistaken tick with no way back.
 *
 *  The row is deleted rather than dated: no history of ticks is kept. */
export const undoActionDone = (packId: string, actionId: string): Promise<void> =>
  db.actionCompletions.delete(actionCompletionId(packId, actionId));

/** Every action the reader has marked against one pack. */
export const listActionCompletions = (packId: string): Promise<ActionCompletion[]> =>
  db.actionCompletions.where('packId').equals(packId).toArray();

/** The CFA site list for BlackSky: written whole, read whole. */
export const putNspSnapshot = (snapshot: NspSnapshot): Promise<string> =>
  db.snapshots.put({ ...snapshot, name: 'nsp' });

export const getNspSnapshot = (): Promise<NspSnapshot | undefined> => db.snapshots.get('nsp');

/** The recovery programs are the app's own precached snapshot, not pack
 *  content: replaced whole at every app start, so an older snapshot's rows
 *  never linger beside the current ones. Recover reads the table as it is. */
export const putPrograms = (rows: RecoveryProgram[]): Promise<void> =>
  db.transaction('rw', db.programs, async () => {
    await db.programs.clear();
    await db.programs.bulkPut(rows);
  });

export const listPrograms = (): Promise<RecoveryProgram[]> => db.programs.toArray();

/** The ids of every program some complete pack carries, for the Home nudge. */
export async function listSavedProgramIds(): Promise<string[]> {
  const packIds = (await listCompletePacks()).map((pack) => pack.id);
  const rows = await db.packPrograms.where('packId').anyOf(packIds).toArray();
  return [...new Set(rows.map((row) => row.programId))];
}

/** A pack's notes, oldest first. Only the complete-pack reads below call this. */
const listNotes = (packId: string): Promise<PackNote[]> =>
  db.notes.where('packId').equals(packId).sortBy('updatedAt');

/** The one rule for note text, applied wherever a note is written: trimmed,
 *  never empty, never past NOTE_MAX_CHARS. */
export function checkedNoteText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > NOTE_MAX_CHARS) {
    throw new RangeError('note text is empty or too long');
  }
  return trimmed;
}

/** Write one note, new or changed. Only a complete pack takes a note here — a
 *  building pack gets its first note inside its own staging transaction. */
export async function putNote(note: PackNote): Promise<void> {
  const text = checkedNoteText(note.text);
  await db.transaction('rw', db.packs, db.notes, async () => {
    if ((await db.packs.get(note.packId))?.status !== 'complete') {
      throw new Error('notes belong to a complete pack');
    }
    await db.notes.put({ ...note, text });
  });
}

export const deleteNote = (id: string): Promise<void> => db.notes.delete(id);

/** THE read API — one complete pack, or undefined. 
 * A building pack is indistinguishable from a pack that does not exist, which is the point. */
export const getCompletePack = async (id: string): Promise<Pack | undefined> => {
  const p = await db.packs.get(id);
  return p?.status === 'complete' ? p : undefined;
};

/** Every complete pack with its destination rows, for BlackSky. Routes through
 *  listCompletePacks, so a building pack stays exactly as invisible here as it
 *  is everywhere else. The places are re-hashed against the pack manifest and
 *  withheld when they no longer match. */
export async function listCompletePacksWithPlaces(): Promise<PackWithPlaces[]> {
  const packs = await listCompletePacks();
  return Promise.all(
    packs.map(async (pack) => {
      const places = await db.destinations.where('packId').equals(pack.id).toArray();
      const placesVerified = await groupMatches(pack.manifest.groups.destinations, places);
      return { pack, places: placesVerified ? places : [], notes: await listNotes(pack.id), placesVerified };
    }),
  );
}

/** Load only children of an already sanctioned complete pack. Every group the
 *  manifest names is re-hashed here, the same way it was hashed when written;
 *  a group that no longer matches is withheld and reported, never shown. */
export async function getCompletePackContent(id: string): Promise<CompletePackContent | undefined> {
  const pack = await getCompletePack(id);
  if (!pack) return undefined;
  const groups = pack.manifest.groups;
  const [layers, destinations, files, notes, programs] = await Promise.all([
    db.layers.where('packId').equals(id).toArray(),
    db.destinations.where('packId').equals(id).toArray(),
    db.files.where('packId').equals(id).toArray(),
    listNotes(id),
    db.packPrograms.where('packId').equals(id).toArray(),
  ]);

  const layersVerified = await groupMatches(groups.layers, layers);
  const destinationsVerified = await groupMatches(groups.destinations, destinations);
  const recoveryVerified = await groupMatches(groups.recovery, programs);
  // The manifest hashes each file's stated size and hash, not its bytes, so the
  // bytes are also checked against that hash: a same-length byte change is caught.
  // A manifest with no files group belongs to a pack that owns no file rows.
  const fileRows = files.map((file) => fileMeta({ ...file, sizeBytes: file.bytes.byteLength }));
  const fileHashes = await Promise.all(files.map((file) => sha256Hex(file.bytes)));
  const filesVerified = await groupMatches(groups.files ?? { count: 0, sha256: '' }, fileRows)
    && fileHashes.every((hash, i) => hash === files[i].sha256);

  return {
    pack,
    layers: layersVerified ? layers : [],
    destinations: destinationsVerified ? destinations : [],
    recovery: recoveryVerified ? programs : [],
    files: filesVerified ? files : [],
    notes,
    recoveryVerified,
    contentVerified: layersVerified && destinationsVerified && filesVerified,
  };
}

/** Delete every status:'building' pack and its children. Runs in main.tsx before
 *  render and immediately on every build cancel, so an interrupted download
 *  leaves orphaned rows only until the next start — and never a complete pack. */
export async function sweepBuilding(): Promise<void> {
  await db.transaction('rw', [db.packs, ...ownedTables()], async () => {
    const ids = await db.packs.where('status').equals('building').primaryKeys();
    if (ids.length === 0) return;
    await db.packs.bulkDelete(ids);
    await deleteOwnedRows(ids);
  });
}

/** Permanently delete ONE complete pack and every row it owns. The recovery
 *  programs are not owned by any pack: they are the app's own precached
 *  snapshot, read by Recover with or without a pack, so a delete leaves them. */
export async function deleteCompletePack(id: string): Promise<void> {
  await db.transaction('rw', [db.packs, ...ownedTables()], async () => {
    const target = await db.packs.get(id);
    if (target?.status !== 'complete') return;
    await deleteOwnedRows([id]);
    await db.packs.delete(id);
  });
}

// Every read of `packs` that leaves this file goes through the complete-only
// functions above. A new raw read here is how a partial pack becomes visible.
// (The status checks inside sweepBuilding and deleteCompletePack are write-path
// guards, not read APIs.)
