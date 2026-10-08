// E5-US1-AC2 / E5-US1-AC3 — what a running rehearsal is, and what marks it.
//
// A rehearsal must never be mistaken for the real thing, so every screen of a
// run carries a bar saying it is a rehearsal and what is being rehearsed
// without (decision D-C, 10 September). Both facts are carried as WORDS: a
// colour, a tint or an icon would say nothing to a reader who cannot see it,
// and nothing at all in greyscale.
//
// A run is held in memory for as long as the page is open. Since E5-US1-AC5 the
// rehearsal it belongs to is ALSO kept on the device from the moment it starts,
// as an unfinished rehearsal (rehearsal-ending.ts), so a cold start finds it and
// asks how it ended. What is never kept is where the run was on screen: a cold
// start resumes no screen and shows no partial result.

import { FIX_PUBLISH_M } from './constants';
import { distanceM } from './geo';
import { conditionLabel, type RehearsalCondition } from './rehearsal-condition';
import * as copy from './copy';
import type { Fix, LatLon, RehearsalEnding } from './types';

/** A rehearsal in progress: the pack it runs against, the one condition it runs
 *  under, and the identity it is recorded under.
 *
 *  There is no field for where she is, and there must not be one: a position that
 *  outlived the page would be a record of her movements. The distance walked is
 *  counted beside the run (run-state.ts) and kept only as one number, with her
 *  ending. */
export type RehearsalRun = {
  /** The id the rehearsal is kept under, from its start to its finish. The row
   *  its start writes and the row its finish writes are the same row. */
  id: string;
  packId: string;
  condition: RehearsalCondition;
  /** When the user chose the condition. */
  startedAt: number;
  /** The ending the reader gave, once she has given one. Present only on a run
   *  resumed from an unfinished rehearsal by her answer, and recorded with the
   *  finished rehearsal. Never filled in by the app. */
  ending?: RehearsalEnding;
  /** The moment she gave that ending. What is recorded as the rehearsal's end,
   *  so a result screen that remounts cannot move it. */
  endedAt?: number;
  /** The metres counted up to that moment, where location was counted. */
  distanceM?: number;
};

/** The walk so far: metres counted, and the last position counted, held in
 *  memory only. */
export type Track = { distanceM: number; last: LatLon | null };

export const NO_TRACK: Track = { distanceM: 0, last: null };

/** A position no better than this is too vague to add to the distance. */
export const TRACK_ACCURACY_MAX_M = 50;

/** Add one position to the walk. A vague position is skipped, and so is a move
 *  inside the position's own error, never less than FIX_PUBLISH_M: that is the
 *  phone's jitter while standing. A real walk passes it and is counted whole. */
export function addFix(track: Track, fix: Pick<Fix, 'lat' | 'lon' | 'accuracyM'>): Track {
  if (fix.accuracyM > TRACK_ACCURACY_MAX_M) return track;
  const here = { lat: fix.lat, lon: fix.lon };
  if (track.last === null) return { distanceM: track.distanceM, last: here };
  const moved = distanceM(track.last, here);
  return moved < Math.max(FIX_PUBLISH_M, fix.accuracyM) ? track : { distanceM: track.distanceM + moved, last: here };
}

/** The time since the start as a clock: "4:05", or "1:02:09" past an hour. */
export function elapsedClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const two = (n: number) => String(n).padStart(2, '0');
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours > 0 ? `${hours}:${two(minutes)}:${two(total % 60)}` : `${minutes}:${two(total % 60)}`;
}

/** What the bar states, as two separate strings.
 *
 *  Two rather than one sentence so neither half can be dropped in favour of a
 *  colour or an icon, and so a screen reader meets the marker and the condition
 *  as distinct pieces rather than one run-on line. */
export type BarParts = { marker: string; condition: string };

export const barParts = (run: RehearsalRun): BarParts => ({
  marker: copy.REHEARSAL_LABEL,
  condition: conditionLabel(run.condition),
});

/** Whether this run is the one belonging to the given pack.
 *
 *  A run is against one pack. Opening the rehearsal entry for a DIFFERENT pack
 *  while a run is in progress is not a resumption of it: that pack has no run,
 *  and the gate starts from the beginning for it. */
export const isRunFor = (run: RehearsalRun | null, packId: string): boolean =>
  run !== null && run.packId === packId;
