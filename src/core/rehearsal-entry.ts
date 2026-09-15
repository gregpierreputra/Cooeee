// E5-US1-AC4 — the entry gate to a rehearsal.
//
// A rehearsal runs from a saved pack, so before one can start there is a
// question to answer about the pack: is it finished, can it be read, and does
// it hold anything to rehearse. Four of the five answers stop the rehearsal,
// and each is its own stated state rather than one failure with a variable in
// it. Nothing here writes: the criterion is that no rehearsal record is
// created in any of the four, so the gate is pure and the screen renders what
// it returns.

import { formatSavedDate } from './provenance';
import type { CompletePackContent, Destination, ExposureLayer, LayerCode } from './types';

/** The hazards a rehearsal can run for. Iteration 2 carries two and no third:
 *  bushfire from the designation layers, heat from the cool places the heat
 *  work adds as destination rows.
 *
 *  The flood overlays (LSIO, FO, SBO) are DELIBERATELY absent. They stay in the
 *  pack, and the pack page keeps showing them as context for the address, but
 *  they are not rehearsable in this iteration. Flood is a team decision, not a
 *  line in a lookup table, so adding it here would be adding it everywhere. */
export type RehearsalHazard = 'bushfire' | 'heat';

/** Which hazard a stored designation layer speaks for. A code that is absent
 *  from this map is context, not a hazard to rehearse. */
const LAYER_HAZARD: Partial<Record<LayerCode, RehearsalHazard>> = {
  BPA: 'bushfire',
  BMO: 'bushfire',
};

/** Which hazard a stored place speaks for. 'absence' is a real row recording
 *  that the official list holds nothing for this area, so it names no hazard.
 *  The heat work adds 'cool-heat': 'heat' here and changes nothing else. */
const DESTINATION_HAZARD: Record<string, RehearsalHazard> = {
  'nsp-bushfire': 'bushfire',
};

/** Which part of a pack could not be read back. Named parts, never "something
 *  went wrong": the user is told what is missing. */
export type UnreadablePart = 'stored-items' | 'saved-places' | 'the-whole-pack';

export type RehearsalGate =
  /** The pack is finished, readable and holds hazard content. Everything past
   *  this point belongs to a later acceptance criterion. */
  | { state: 'ready'; packId: string; packName: string; hazards: RehearsalHazard[] }
  /** otherCompletePacks is how many complete packs the device holds that are
   *  not the one asked for. It is 0 in the plain case, and the screen says a
   *  different sentence when it is not, because "no pack is stored on this
   *  device" is not true of a device holding another pack. */
  | { state: 'no-pack'; otherCompletePacks: number }
  | { state: 'incomplete'; unfinishedCount: number }
  | { state: 'nothing-to-rehearse'; packId: string; packName: string; savedOn: string }
  /** packName and packId are null only when the store itself could not be read,
   *  because then there is no pack row to take a name from and no pack the
   *  screen can honestly offer to go back to. */
  | { state: 'unreadable'; packId: string | null; packName: string | null; parts: UnreadablePart[] };

export type RehearsalInput = {
  now: number;
  /** Complete packs on the device. */
  completeCount: number;
  /** Packs whose build never finished: status 'building' rows. */
  unfinishedCount: number;
  /** The pack being opened: its content, the marker for a read that failed, or
   *  null when the store held nothing to open. */
  content: CompletePackContent | 'unreadable' | null;
};

const layerHazard = (row: ExposureLayer): RehearsalHazard | undefined =>
  // A layer that recorded an absence or an unpublished dataset is an honest
  // row and is not something to rehearse against.
  row.status === 'present' ? LAYER_HAZARD[row.code] : undefined;

const destinationHazard = (row: Destination): RehearsalHazard | undefined =>
  DESTINATION_HAZARD[row.kind];

/** The hazards this pack holds enough content to rehearse, in a stable order.
 *
 *  This is deliberately NOT read from the manifest group counts. A count is a
 *  count of rows, and a row is written whether or not it found anything: three
 *  layers recording 'none-mapped-here' and one destination recording an
 *  absence give a pack with counts of 3 and 1 that still holds nothing to
 *  rehearse. Only the stored status and kind can answer the question. */
export function rehearsableHazards(content: CompletePackContent): RehearsalHazard[] {
  const found = new Set<RehearsalHazard>();
  content.layers.forEach((row) => {
    const hazard = layerHazard(row);
    if (hazard) found.add(hazard);
  });
  content.destinations.forEach((row) => {
    const hazard = destinationHazard(row);
    if (hazard) found.add(hazard);
  });
  const order: RehearsalHazard[] = ['bushfire', 'heat'];
  return order.filter((hazard) => found.has(hazard));
}

/** The parts of a pack that were withheld because they no longer match what
 *  the pack recorded. getCompletePackContent() re-hashes each group and hands
 *  back an empty group rather than rows it cannot vouch for; this names those
 *  groups so the screen can say which. */
function unreadableParts(content: CompletePackContent): UnreadablePart[] {
  const groups = content.pack.manifest.groups;
  const parts: UnreadablePart[] = [];
  // A group the manifest counted rows in that comes back with none was
  // withheld. A group the manifest counted nothing in is simply empty, which
  // is a different state and is decided further down.
  if (groups.layers.count > 0 && content.layers.length === 0) parts.push('stored-items');
  if (groups.destinations.count > 0 && content.destinations.length === 0) {
    parts.push('saved-places');
  }
  // contentVerified also covers the saved copies of the source pages. Those
  // are reading material for the pack page and hold no hazard content, so a
  // copy that no longer matches is a fault of the pack page and not a reason
  // the rehearsal cannot run. The pack page states it in its own words
  // (src/ui/PackDetail.tsx, PACK_ITEMS_UNVERIFIED), so the user is told.
  // ponytail: a files-only mismatch is reported on the pack page and not here,
  // so someone entering the gate straight from a link never sees it; upgrade
  // path: carry a fourth named part once the gate has a screen that can state
  // a fault it is not blocking on.
  return parts;
}

/** Which of the five states the user is in.
 *
 *  The order matters, and one step of it is a shared rule rather than a
 *  convenience. Rule 0.1, Honest wording, requires the product to
 *  "Distinguish present, nothing mapped here, not published here, failed
 *  check, stale data and absent data". A failed check and absent data are two
 *  of those six, and they are not the same reading: a pack whose places were
 *  withheld by the hash check has not been shown to hold nothing, so calling
 *  it empty would be a claim about data that is on the device and was never
 *  read. An unreadable part is therefore reported before the pack is ever
 *  described as empty. */
export function rehearsalGate(input: RehearsalInput): RehearsalGate {
  const { content } = input;

  // The store itself could not be read: nothing about the pack is known, not
  // even whether it is finished.
  if (content === 'unreadable') {
    return { state: 'unreadable', packId: null, packName: null, parts: ['the-whole-pack'] };
  }

  // Nothing to open. A pack that was started and never finished is a different
  // statement from no pack at all, and stays a different statement here.
  if (content === null) {
    return input.unfinishedCount > 0
      ? { state: 'incomplete', unfinishedCount: input.unfinishedCount }
      : { state: 'no-pack', otherCompletePacks: input.completeCount };
  }

  const { id: packId, name: packName } = content.pack;

  // Rule 0.1: a failed check is reported before the emptiness test below.
  const parts = unreadableParts(content);
  if (parts.length > 0) return { state: 'unreadable', packId, packName, parts };

  const hazards = rehearsableHazards(content);
  if (hazards.length === 0) {
    return {
      state: 'nothing-to-rehearse',
      packId,
      packName,
      savedOn: formatSavedDate(content.pack.verifiedAt),
    };
  }

  return { state: 'ready', packId, packName, hazards };
}
