import { useSyncExternalStore } from 'react';
import type { RehearsalCondition } from '../../core/rehearsal-condition';
import { addFix, NO_TRACK, type RehearsalRun, type Track } from '../../core/rehearsal-run';
import type { RehearsalEnding, UnfinishedRehearsal } from '../../core/types';

/** E5-US1-AC3, as amended by E5-US1-AC5 — where a running rehearsal is held.
 *
 *  A rehearsal runs from "I'm going now" to the ending she gives it. The RUN is
 *  held here, in memory at module scope, so leaving the screen — into BlackSky,
 *  or anywhere — and coming back within the same session finds it still running:
 *  component state would die on unmount. The same latch pattern is used for the
 *  service-worker update flag in app.tsx and for the tour in components/Tour.tsx.
 *
 *  A condition chosen and not yet gone on is NOT held here. It is setup, held by
 *  the entry screen alone, so a curious tap leaves nothing behind.
 *
 *  This value dies with the document, so a closed and reopened app has no run:
 *  no bar, no resumed screen, no partial result. What survives is the REHEARSAL,
 *  kept on the device from the moment she went (Journey.tsx). A cold start finds
 *  that and asks her how it ended; it never decides the ending for her. */
let current: RehearsalRun | null = null;

/** The walk counted beside the run, also at module scope, so it keeps counting
 *  while she is in BlackSky. Only the metres and the last position are held,
 *  in memory; no position is ever written anywhere. `counting` is false in the
 *  No location fix condition, with no location in the browser, or once she
 *  refuses it. */
let track: Track = NO_TRACK;
let counting = false;
let watch: number | null = null;

function stopCounting(): void {
  if (watch !== null) navigator.geolocation.clearWatch(watch);
  watch = null;
}

function startCounting(condition: RehearsalCondition): void {
  stopCounting();
  track = NO_TRACK;
  counting = condition !== 'no-location-fix' && 'geolocation' in navigator;
  if (!counting) return;
  watch = navigator.geolocation.watchPosition(
    (position) => {
      track = addFix(track, {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracyM: position.coords.accuracy,
      });
    },
    (error) => {
      if (error.code !== error.PERMISSION_DENIED) return;
      counting = false;
      stopCounting();
    },
    { enableHighAccuracy: true, maximumAge: 0 },
  );
}

/** The metres walked so far, or null when the distance is not being counted. */
export const walkedSoFar = (): number | null => (counting ? track.distanceM : null);

const listeners = new Set<() => void>();

const announce = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The run in progress, or null. Read directly by code that is not a component. */
export const currentRun = (): RehearsalRun | null => current;

/** "I'm going now": begin the run. This moment is its start. Replaces any run
 *  already in progress rather than stacking one on it: a rehearsal is against
 *  one pack under one condition, always. */
export function startRun(
  packId: string,
  condition: RehearsalCondition,
  id: string = crypto.randomUUID(),
  startedAt: number = Date.now(),
): RehearsalRun {
  const run = { id, packId, condition, startedAt };
  current = run;
  startCounting(condition);
  announce();
  return run;
}

/** She ends the running rehearsal with one of its two endings, now. Once given,
 *  an ending and its moment do not change: a second tap cannot move either. */
export function endWith(ending: RehearsalEnding, endedAt: number = Date.now()): void {
  if (current === null || current.ending !== undefined) return;
  // The distance is kept only with "I have arrived", and only once a position
  // has been counted: no location means no figure, never a zero.
  const walked = ending === 'walked' && counting && track.last !== null;
  current = walked ? { ...current, ending, endedAt, distanceM: track.distanceM } : { ...current, ending, endedAt };
  stopCounting();
  announce();
}

/** Take up a kept unfinished rehearsal with the ending she gave it, at its
 *  result. The result records it finished, with that ending, over the kept row.
 *  The ending is hers: this is only ever called with her answer. */
export function resumeWithEnding(
  unfinished: UnfinishedRehearsal,
  ending: RehearsalEnding,
  endedAt: number = Date.now(),
): void {
  // It replaces any rehearsal still running, so that one stops reading the position.
  stopCounting();
  counting = false;
  current = {
    id: unfinished.id,
    packId: unfinished.packId,
    condition: unfinished.condition,
    startedAt: unfinished.startedAt,
    ending,
    endedAt,
  };
  announce();
}

/** End the run. The bar goes with it, everywhere, at once. */
export function endRun(): void {
  stopCounting();
  current = null;
  announce();
}

/** The run in progress, as a component sees it. Re-renders every screen of the
 *  run when the run starts or ends, so the bar can never be left behind on a
 *  screen after the rehearsal it belonged to has finished. */
export const useRehearsalRun = (): RehearsalRun | null =>
  useSyncExternalStore(subscribe, currentRun, () => null);
