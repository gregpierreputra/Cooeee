import { describe, expect, it } from 'vitest';
import * as copy from '../../src/core/copy';
import {
  comparableEarlier,
  packChangeBetween,
  rehearsalProgress,
} from '../../src/core/rehearsal-progress';
import type { ActionCompletion, DetectedGap, Rehearsal } from '../../src/core/types';

const MARCH_3 = Date.UTC(2026, 2, 3);
const MARCH_10 = Date.UTC(2026, 2, 10);
const APRIL_1 = Date.UTC(2026, 3, 1);

const placesGap: DetectedGap = {
  gapType: 'places-missing',
  kind: 'pack-content',
  hazard: 'bushfire',
};
const directionGap: DetectedGap = {
  gapType: 'live-direction-unavailable',
  kind: 'condition-persistent',
  hazard: 'bushfire',
};

const rehearsal = (over: Partial<Rehearsal> = {}): Rehearsal => ({
  id: 'run-1',
  packId: 'pack-1',
  condition: 'no-data',
  startedAt: MARCH_3 - 1000,
  finishedAt: MARCH_3,
  packVerifiedAt: MARCH_3,
  gaps: [placesGap],
  ...over,
});

const completion = (over: Partial<ActionCompletion> = {}): ActionCompletion => ({
  id: 'pack-1:build-pack-again-for-places',
  packId: 'pack-1',
  actionId: 'build-pack-again-for-places',
  doneAt: MARCH_10,
  ...over,
});

// TC-5.2.2-A and TC-5.2.2-B
describe('which earlier rehearsal is compared against', () => {
  it('is the most recent earlier run of the same pack and the same condition', () => {
    const latest = rehearsal({ id: 'latest', finishedAt: APRIL_1 });
    const older = rehearsal({ id: 'older', finishedAt: MARCH_3 });
    const newer = rehearsal({ id: 'newer', finishedAt: MARCH_10 });

    expect(comparableEarlier([older, newer, latest], latest)?.id).toBe('newer');
  });

  // A no-data run and a no-location-fix run look for different things, so the
  // difference between them is not progress: it is two different questions.
  it('is never a run under a different condition', () => {
    const latest = rehearsal({ id: 'latest', finishedAt: APRIL_1 });
    const otherCondition = rehearsal({
      id: 'other',
      condition: 'no-location-fix',
      finishedAt: MARCH_10,
    });

    expect(comparableEarlier([otherCondition, latest], latest)).toBeNull();
  });

  it('is never a run of a different pack', () => {
    const latest = rehearsal({ id: 'latest', finishedAt: APRIL_1 });
    const otherPack = rehearsal({ id: 'other', packId: 'pack-2', finishedAt: MARCH_10 });

    expect(comparableEarlier([otherPack, latest], latest)).toBeNull();
  });

  it('is never the run itself', () => {
    const latest = rehearsal({ id: 'latest' });
    expect(comparableEarlier([latest], latest)).toBeNull();
  });

  it('is never a run that finished after this one', () => {
    const latest = rehearsal({ id: 'latest', finishedAt: MARCH_3 });
    const later = rehearsal({ id: 'later', finishedAt: APRIL_1 });
    expect(comparableEarlier([later, latest], latest)).toBeNull();
  });

  it('is null when there is nothing stored at all', () => {
    expect(comparableEarlier([], rehearsal())).toBeNull();
  });

  // Whichever order the store hands them back in.
  it('is the most recent whether or not the list arrives in order', () => {
    const latest = rehearsal({ id: 'latest', finishedAt: APRIL_1 });
    const older = rehearsal({ id: 'older', finishedAt: MARCH_3 });
    const newer = rehearsal({ id: 'newer', finishedAt: MARCH_10 });

    expect(comparableEarlier([newer, older, latest], latest)?.id).toBe('newer');
    expect(comparableEarlier([older, newer, latest], latest)?.id).toBe('newer');
  });
});

// TC-5.2.2-D
describe('a first rehearsal of this pack this way', () => {
  it('is its own state, with nothing to compare', () => {
    expect(rehearsalProgress(rehearsal(), null, [])).toEqual({ state: 'first' });
  });

  it('says what is not there yet, and never frames the run as incomplete', () => {
    const words = `${copy.FIRST_REHEARSAL_HEADING} ${copy.FIRST_REHEARSAL_DETAIL}`;
    expect(words).not.toMatch(
      /\bincomplete\b|\bpartial\b|\bbaseline\b|\bscore\b|\bstarting point\b|\bso far\b/i,
    );
    expect(copy.FIRST_REHEARSAL_DETAIL).toContain('in full');
  });
});

// TC-5.2.2-E and TC-5.2.2-F
describe('whether the pack changed between the two runs', () => {
  it('is changed, with the date, when the pack was built again', () => {
    const earlier = rehearsal({ id: 'earlier', packVerifiedAt: MARCH_3 });
    const latest = rehearsal({ id: 'latest', finishedAt: APRIL_1, packVerifiedAt: MARCH_10 });

    expect(packChangeBetween(earlier, latest)).toEqual({
      state: 'changed',
      changedOn: '10 March 2026',
    });
  });

  it('is unchanged when both ran against the same pack content', () => {
    const earlier = rehearsal({ id: 'earlier', packVerifiedAt: MARCH_3 });
    const latest = rehearsal({ id: 'latest', finishedAt: APRIL_1, packVerifiedAt: MARCH_3 });

    expect(packChangeBetween(earlier, latest)).toEqual({ state: 'unchanged' });
  });

  // "We cannot tell" and "nothing changed" are different statements, and
  // substituting the second for the first is what shared rule 0.1 forbids.
  // Reachable rather than contrived: rehearsals recorded before the field
  // existed do not carry it.
  it('is indeterminate, never unchanged, when either run did not record it', () => {
    const withField = rehearsal({ id: 'a', packVerifiedAt: MARCH_3 });
    const without = rehearsal({ id: 'b', packVerifiedAt: undefined });

    expect(packChangeBetween(without, withField)).toEqual({ state: 'indeterminate' });
    expect(packChangeBetween(withField, without)).toEqual({ state: 'indeterminate' });
    expect(packChangeBetween(without, without)).toEqual({ state: 'indeterminate' });
  });

  it('says so in words that are not a softer way of saying nothing changed', () => {
    expect(copy.PACK_CHANGE_UNKNOWN).toContain('cannot be said either way');
    expect(copy.PACK_CHANGE_UNKNOWN).not.toMatch(/\bunchanged\b|\bthe same\b|\bno change\b/i);
  });

  // Nothing about a changed pack is attributed to the reader's own effort.
  it('keeps a change in the pack apart from a change in what the reader did', () => {
    expect(copy.PACK_CHANGED_ON('10 March 2026')).toContain(
      'What changed between them is not only what you did.',
    );
    expect(copy.PACK_CHANGED_ON('10 March 2026')).not.toMatch(
      /\byour fault\b|\byou failed\b|\bbecause you\b/i,
    );
  });
});

describe('what has moved since the last comparable rehearsal', () => {
  it('names the earlier rehearsal by its date', () => {
    const earlier = rehearsal({ id: 'earlier', finishedAt: MARCH_3 });
    const latest = rehearsal({ id: 'latest', finishedAt: APRIL_1 });

    const progress = rehearsalProgress(latest, earlier, []);
    if (progress.state !== 'compared') throw new Error('expected a comparison');
    expect(progress.earlierOn).toBe('Compared with your rehearsal of 3 March 2026');
  });

  // The coupling: a pack's checked content never changes once committed, so a
  // gap can only be new across a pack that was rebuilt — which is the same case
  // AC4 annotates.
  it('reports a gap as new only when the earlier run did not find it', () => {
    const earlier = rehearsal({ id: 'earlier', gaps: [placesGap], packVerifiedAt: MARCH_3 });
    const latest = rehearsal({
      id: 'latest',
      finishedAt: APRIL_1,
      packVerifiedAt: MARCH_10,
      gaps: [placesGap, directionGap],
    });

    const progress = rehearsalProgress(latest, earlier, []);
    if (progress.state !== 'compared') throw new Error('expected a comparison');
    expect(progress.newlyDetected.map((row) => row.gapType)).toEqual(['live-direction-unavailable']);
    // And it is annotated as a comparison across a changed pack.
    expect(progress.packChange).toMatchObject({ state: 'changed' });
  });

  it('finds nothing new when the same pack found the same gaps', () => {
    const earlier = rehearsal({ id: 'earlier', gaps: [placesGap] });
    const latest = rehearsal({ id: 'latest', finishedAt: APRIL_1, gaps: [placesGap] });

    const progress = rehearsalProgress(latest, earlier, []);
    if (progress.state !== 'compared') throw new Error('expected a comparison');
    expect(progress.newlyDetected).toEqual([]);
    expect(progress.packChange).toEqual({ state: 'unchanged' });
  });

  it('lists an action done since the earlier run, and not one done before it', () => {
    const earlier = rehearsal({ id: 'earlier', finishedAt: MARCH_3 });
    const latest = rehearsal({ id: 'latest', finishedAt: APRIL_1 });

    const since = rehearsalProgress(latest, earlier, [completion({ doneAt: MARCH_10 })]);
    if (since.state !== 'compared') throw new Error('expected a comparison');
    expect(since.completedSince.map((row) => row.gapType)).toEqual(['places-missing']);
    expect(since.stillOpen).toEqual([]);

    const before = rehearsalProgress(latest, earlier, [completion({ doneAt: MARCH_3 - 1 })]);
    if (before.state !== 'compared') throw new Error('expected a comparison');
    expect(before.completedSince).toEqual([]);
    // Done, so not still open — just not news.
    expect(before.stillOpen).toEqual([]);
  });

  it('lists a gap with no completion as still to do', () => {
    const earlier = rehearsal({ id: 'earlier', finishedAt: MARCH_3 });
    const latest = rehearsal({ id: 'latest', finishedAt: APRIL_1 });

    const progress = rehearsalProgress(latest, earlier, []);
    if (progress.state !== 'compared') throw new Error('expected a comparison');
    expect(progress.stillOpen.map((row) => row.gapType)).toEqual(['places-missing']);
  });

  // A rehearsal that found nothing still has a comparison: what moved is that
  // there is nothing to move.
  it('compares a run that found no gaps, with three empty lists and no zero', () => {
    const earlier = rehearsal({ id: 'earlier', finishedAt: MARCH_3, gaps: [] });
    const latest = rehearsal({ id: 'latest', finishedAt: APRIL_1, gaps: [] });

    const progress = rehearsalProgress(latest, earlier, [completion()]);
    if (progress.state !== 'compared') throw new Error('expected a comparison');
    expect(progress.newlyDetected).toEqual([]);
    expect(progress.stillOpen).toEqual([]);
    expect(progress.completedSince).toEqual([]);
    expect(progress.earlierOn).toContain('3 March 2026');
  });

  it('ignores a completion belonging to another pack', () => {
    const earlier = rehearsal({ id: 'earlier', finishedAt: MARCH_3 });
    const latest = rehearsal({ id: 'latest', finishedAt: APRIL_1 });

    const progress = rehearsalProgress(latest, earlier, [
      completion({ packId: 'pack-2', id: 'pack-2:build-pack-again-for-places' }),
    ]);
    if (progress.state !== 'compared') throw new Error('expected a comparison');
    expect(progress.completedSince).toEqual([]);
    expect(progress.stillOpen.map((row) => row.gapType)).toEqual(['places-missing']);
  });
});

// TC-5.2.2-C. The one thing this screen must never do.
describe('progress is never a score', () => {
  const everyState = [
    rehearsalProgress(rehearsal(), null, []),
    rehearsalProgress(
      rehearsal({ id: 'latest', finishedAt: APRIL_1, gaps: [placesGap, directionGap] }),
      rehearsal({ id: 'earlier', finishedAt: MARCH_3, gaps: [placesGap] }),
      [completion()],
    ),
  ];

  it('carries no number in its shape', () => {
    everyState.forEach((progress) => {
      Object.values(progress).forEach((value) => expect(typeof value).not.toBe('number'));
      ['total', 'count', 'score', 'grade', 'percentage', 'done', 'remaining', 'readiness'].forEach(
        (field) => expect(progress).not.toHaveProperty(field),
      );
    });
  });

  it('carries no number, score or verdict in its words', () => {
    const words = [
      copy.PROGRESS_HEADING,
      copy.EARLIER_REHEARSAL_ON('3 March 2026'),
      copy.GROUP_NEWLY_DETECTED,
      copy.GROUP_STILL_OPEN,
      copy.GROUP_DONE_SINCE,
      copy.FIRST_REHEARSAL_HEADING,
      copy.FIRST_REHEARSAL_DETAIL,
      copy.PACK_CHANGE_UNKNOWN,
    ].join(' ');

    expect(words).not.toMatch(/\bscore\b|\bgrade\b|\btotal\b|\bpercent\b|\bpass\b|\bfail\b|\d+%/i);
    expect(words).not.toMatch(/\bprepared\b|\bunprepared\b|\bready\b|\bimproved\b|\bbetter than\b/i);
  });

  it('says nothing about the reader being more prepared than before', () => {
    const words = [
      copy.PROGRESS_HEADING,
      copy.GROUP_DONE_SINCE,
      copy.PACK_CHANGED_ON('3 March 2026'),
    ].join(' ');
    expect(words).not.toMatch(/\bmore prepared\b|\bwell done\b|\bprogress\b|\bon track\b/i);
  });
});
