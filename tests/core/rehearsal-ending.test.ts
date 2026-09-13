import { describe, expect, it } from 'vitest';
import * as copy from '../../src/core/copy';
import {
  REHEARSAL_ENDINGS,
  endingLine,
  endingOf,
  endingRows,
  isRehearsalEnding,
  isUnfinished,
  unfinishedFrom,
  unfinishedView,
} from '../../src/core/rehearsal-ending';
import { comparableEarlier } from '../../src/core/rehearsal-progress';
import type { Rehearsal, UnfinishedRehearsal } from '../../src/core/types';

// Midday on 3 September 2026 in Melbourne.
const STARTED = Date.UTC(2026, 8, 3, 2);
const run = { id: 'run-1', packId: 'pack-1', condition: 'no-location-fix' as const, startedAt: STARTED };
const finished = (over: Partial<Rehearsal> = {}): Rehearsal => ({
  ...run,
  finishedAt: STARTED + 900_000,
  gaps: [],
  ...over,
});

describe('the two endings', () => {
  it('are exactly two, in a fixed order, and neither is chosen for her', () => {
    expect(REHEARSAL_ENDINGS).toEqual(['walked', 'dry-run']);
    expect(endingRows()).toEqual([
      { ending: 'walked', label: 'Walked', detail: 'I went to the place.' },
      { ending: 'dry-run', label: 'Not walked, a dry run', detail: 'I ended it without going.' },
    ]);
    endingRows().forEach((row) => expect(Object.keys(row).sort()).toEqual(['detail', 'ending', 'label']));
  });

  it('accept only the two answers she can give', () => {
    REHEARSAL_ENDINGS.forEach((ending) => expect(isRehearsalEnding(ending)).toBe(true));
    ['', 'walk', 'not-walked', 'Walked', 'unknown', null, undefined, 0].forEach((value) =>
      expect(isRehearsalEnding(value)).toBe(false),
    );
  });
});

describe('a started rehearsal', () => {
  it('is kept with who, what and when, and nothing claiming it ended', () => {
    const started = unfinishedFrom(run);
    expect(Object.keys(started).sort()).toEqual(['condition', 'id', 'packId', 'startedAt']);
    expect(isUnfinished(started)).toBe(true);
    expect(isUnfinished(finished())).toBe(false);
  });

  it('is asked about in her words, without guessing and without implying it fell short', () => {
    const view = unfinishedView(unfinishedFrom(run));
    expect(view.heading).toBe('How did this rehearsal end?');
    expect(view.detail).toBe(
      'You started a rehearsal without a location fix on 3 September 2026. Only you can say how it ended.',
    );
    expect(view.rows).toEqual(endingRows());
    const words = [view.heading, view.detail, ...view.rows.flatMap((row) => [row.label, row.detail])].join(' ');
    expect(words).not.toMatch(/interrupt|abandon|missed|partial|incomplete|so far|failed|resume/i);
  });

  // The trap this criterion names. comparableEarlier takes Rehearsals, and an
  // unfinished rehearsal is not one: the compiler refuses it, so a journey that
  // never happened cannot be handed to the comparison at all.
  it('cannot be compared against, because it is not a Rehearsal', () => {
    const started: UnfinishedRehearsal = unfinishedFrom(run);
    // @ts-expect-error an unfinished rehearsal has no finishedAt and no gaps
    const earlier = comparableEarlier([started], finished({ id: 'later' }));
    // Were the type bypassed, it still has no finish to be earlier by.
    expect(earlier).toBeNull();
  });
});

describe('the ending of a finished rehearsal', () => {
  it('is the one she gave', () => {
    expect(endingOf(finished({ ending: 'walked' }))).toEqual({ state: 'walked' });
    expect(endingOf(finished({ ending: 'dry-run' }))).toEqual({ state: 'dry-run' });
  });

  // Rehearsals recorded before the endings existed.
  it('is not recorded when none was kept, and is never defaulted to either ending', () => {
    expect(endingOf(finished())).toEqual({ state: 'not-recorded' });
    expect(endingOf(finished({ ending: 'probably' as never }))).toEqual({ state: 'not-recorded' });
  });

  it('is stated in words, and not recorded in the shape an unknown pack change uses', () => {
    expect(endingLine({ state: 'walked' })).toBe('Walked');
    expect(endingLine({ state: 'dry-run' })).toBe('Not walked, a dry run');
    expect(endingLine({ state: 'not-recorded' })).toBe(
      'Whether this rehearsal was walked or a dry run was not recorded, so it cannot be said either way.',
    );
    const shape = /^Whether .+ was not recorded, so it cannot be said either way\.$/;
    expect(copy.PACK_CHANGE_UNKNOWN).toMatch(shape);
    expect(copy.ENDING_NOT_RECORDED).toMatch(shape);
  });
});
