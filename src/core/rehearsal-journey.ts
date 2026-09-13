// E5-US1-AC5 — the journey screen: which official places it names.
//
// The rehearsal is the journey itself: a walk, on foot, in calm conditions, to
// one of the official places saved with this pack, with BlackSky open. The
// screen names those places the way the rest of the app names them — by the
// destinations list's name, with the shared publisher-and-saved-date line — so
// she never meets her own pack worded differently inside a rehearsal.
//
// It names them as places to practise knowing the way to. Nothing here, and
// nothing on the screen, treats one as where she plans to go on the day.

import { placeName } from './destination';
import { publisherLine } from './provenance';
import { hazardPlaces } from './rehearsal-checks';
import { rehearsableHazards } from './rehearsal-entry';
import type { CompletePackContent } from './types';

export type JourneyPlace = { id: string; name: string; publisherLine: string };

/** The official places saved with this pack, for every hazard it rehearses, in
 *  the order the destinations list showed them. Empty when the pack holds none;
 *  the screen then says so in the result's own sentence. */
export function journeyPlaces(content: CompletePackContent): JourneyPlace[] {
  return rehearsableHazards(content)
    .flatMap((hazard) => hazardPlaces(content, hazard))
    .sort((a, b) => (a.distanceOrder ?? 0) - (b.distanceOrder ?? 0))
    .map((place) => ({
      id: place.id,
      name: placeName(place),
      publisherLine: publisherLine(place.source),
    }));
}
