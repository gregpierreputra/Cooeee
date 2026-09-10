// E5-US2-AC1 — what a rehearsal checks, and what counts as a gap.
//
// Decision D-F, 10 September: a rehearsal walks the FIXED journey EPIC 1 to 3
// already delivers, against the chosen condition. It does not explore, it does
// not sample, and it does not vary between runs: the same pack under the same
// condition finds the same gaps, which is what makes one run comparable with
// the last.
//
// A gap is a capability the user cannot rely on under that condition. It is NOT
// automatically a product defect, and it says nothing about the person. Nothing
// in this file counts, totals, scores or grades: there is no number to return,
// and there must never be one.

import { rehearsableHazards, type RehearsalHazard } from './rehearsal-entry';
import { missingDisplayProvenance } from './provenance';
import { GAP_KIND } from './rehearsal-actions';
import type { CompletePackContent, DetectedGap, RehearsalGapType } from './types';
import type { RehearsalCondition } from './rehearsal-condition';

/** The designation layers that answer "is this address in a designated area".
 *  The flood overlays are context and are deliberately not part of a rehearsal,
 *  the same decision taken in rehearsal-entry.ts. */
const DESIGNATION_CODES = ['BPA', 'BMO'] as const;

/** Which stored place belongs to which hazard's journey. The heat work adds
 *  'cool-heat': 'heat' here and nothing else changes. An absence row is a real
 *  row recording that the official list holds nothing, so it is not a place the
 *  journey can use. */
const PLACE_HAZARD: Record<string, RehearsalHazard> = {
  'nsp-bushfire': 'bushfire',
};

const gap = (gapType: RehearsalGapType, hazard: RehearsalHazard): DetectedGap => ({
  gapType,
  hazard,
  kind: GAP_KIND[gapType],
});

/** The saved-information checks. These run under BOTH conditions: the criterion
 *  requires saved information to remain available whichever capability the
 *  rehearsal takes away, so losing the location fix does not excuse a pack that
 *  is missing what it needs. */
function packContentGaps(content: CompletePackContent, hazard: RehearsalHazard): DetectedGap[] {
  const gaps: DetectedGap[] = [];

  // The official designation for the address. Bushfire only: heat carries no
  // designation layer, so its journey does not check for one.
  if (hazard === 'bushfire') {
    const designated = content.layers.some(
      (row) => row.status === 'present' && (DESIGNATION_CODES as readonly string[]).includes(row.code),
    );
    if (!designated) gaps.push(gap('designation-missing', hazard));
  }

  // The official places saved for this hazard.
  const places = content.destinations.filter((row) => PLACE_HAZARD[row.kind] === hazard);
  if (places.length === 0) gaps.push(gap('places-missing', hazard));

  // Every stored item has to name its publisher and its saved date, offline,
  // or the reader cannot judge what they are reading (shared rule 0.4). An item
  // without both is not shown, so its absence is a gap in the pack.
  const itemsForHazard = [
    ...content.layers.filter(
      () => hazard === 'bushfire',
    ),
    ...places,
  ];
  const provenanceMissing = itemsForHazard.some(
    (row) => missingDisplayProvenance(row.source) !== null,
  );
  if (provenanceMissing) gaps.push(gap('provenance-missing', hazard));

  return gaps;
}

/** Every gap this run found, in a fixed order: the pack-content checks for each
 *  hazard the pack rehearses, then the condition's own contingency.
 *
 *  PRECONDITION, and it matters: this is only ever called for a pack the entry
 *  gate has passed, which means a pack holding at least one rehearsable hazard.
 *  A pack holding none yields no hazards to walk and therefore no gaps, and an
 *  empty gap list renders as "nothing was missing" — which of an empty pack
 *  would be the exact opposite of the truth. The gate is what stops that pack
 *  ever reaching a run (it is told it holds nothing to rehearse), so the safety
 *  of this function depends on the gate in front of it. Do not call it without
 *  one.
 *
 *  Pure, and given the same inputs returns the same gaps. It reads what is
 *  already stored and makes no request: a rehearsal of "no mobile data" that
 *  reached the network would be refuting itself. */
export function detectGaps(
  condition: RehearsalCondition,
  content: CompletePackContent,
): DetectedGap[] {
  const hazards = rehearsableHazards(content);
  const gaps = hazards.flatMap((hazard) => packContentGaps(content, hazard));

  // Under no location fix, live direction and distance are expected to be
  // unavailable. That is not a fault to be fixed but a limitation to plan
  // around, so it is raised as a contingency, once per hazard: the places a
  // reader would be finding their way to are the places saved for that hazard,
  // and one pack holds more than one hazard's worth of them.
  if (condition === 'no-location-fix') {
    gaps.push(...hazards.map((hazard) => gap('live-direction-unavailable', hazard)));
  }

  return gaps;
}
