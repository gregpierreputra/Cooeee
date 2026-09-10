import { describe, expect, it } from 'vitest';
import * as copy from '../../src/core/copy';
import { rehearsalResult } from '../../src/core/rehearsal-result';
import type { ActionCompletion, DetectedGap, Rehearsal } from '../../src/core/types';

const rehearsal = (gaps: DetectedGap[], over: Partial<Rehearsal> = {}): Rehearsal => ({
  id: 'run-1',
  packId: 'pack-1',
  condition: 'no-data',
  startedAt: 1_756_100_000_000,
  finishedAt: 1_756_100_060_000,
  gaps,
  ...over,
});

const packContentGap: DetectedGap = {
  gapType: 'places-missing',
  kind: 'pack-content',
  hazard: 'bushfire',
};
const persistentGap: DetectedGap = {
  gapType: 'live-direction-unavailable',
  kind: 'condition-persistent',
  hazard: 'bushfire',
};

describe('a result with gaps', () => {
  // TC-5.2.1-A
  it('gives every gap exactly one action', () => {
    const result = rehearsalResult(rehearsal([packContentGap, persistentGap]));
    expect(result.state).toBe('gaps');
    if (result.state !== 'gaps') return;

    expect(result.rows).toHaveLength(2);
    result.rows.forEach((row) => {
      expect(typeof row.action).toBe('string');
      expect(row.action.length).toBeGreaterThan(0);
      expect(row.actionId.length).toBeGreaterThan(0);
      // One action, not a list of them.
      expect(Array.isArray(row.action)).toBe(false);
      expect(row).not.toHaveProperty('actions');
    });
  });

  // TC-5.2.1-B
  it('renders the two kinds with wording that tells them apart', () => {
    const result = rehearsalResult(rehearsal([packContentGap, persistentGap]));
    if (result.state !== 'gaps') throw new Error('expected gaps');

    const [content, persistent] = result.rows;
    expect(content.meaning).toBe('This information is missing from your pack.');
    expect(persistent.meaning).toBe(
      'This is not available under this condition. Here is what to do instead.',
    );
    expect(content.meaning).not.toBe(persistent.meaning);
  });

  it('names whose journey each gap belongs to', () => {
    const result = rehearsalResult(rehearsal([packContentGap]));
    if (result.state !== 'gaps') throw new Error('expected gaps');
    expect(result.rows[0].hazardLine).toBe('Bushfire journey');
  });

  it('states the condition the rehearsal ran under', () => {
    expect(rehearsalResult(rehearsal([packContentGap])).conditionLine).toBe(
      'Rehearsed without No mobile data.',
    );
    expect(
      rehearsalResult(rehearsal([persistentGap], { condition: 'no-location-fix' })).conditionLine,
    ).toBe('Rehearsed without No location fix.');
  });

  it('keeps the rows in the order the run found them', () => {
    const result = rehearsalResult(rehearsal([persistentGap, packContentGap]));
    if (result.state !== 'gaps') throw new Error('expected gaps');
    expect(result.rows.map((row) => row.gapType)).toEqual([
      'live-direction-unavailable',
      'places-missing',
    ]);
  });
});

// TC-5.2.1-D
describe('a result with no gaps', () => {
  it('is its own state, not an empty list', () => {
    const result = rehearsalResult(rehearsal([]));
    expect(result.state).toBe('no-gaps');
    expect(result).not.toHaveProperty('rows');
  });

  it('says what held, and never that the reader is prepared', () => {
    const result = rehearsalResult(rehearsal([]));
    if (result.state !== 'no-gaps') throw new Error('expected no-gaps');

    expect(result.heading).toBe('Nothing was missing in this rehearsal');
    expect(`${result.heading} ${result.detail}`).not.toMatch(
      /\bprepared\b|\bready\b|\bprotected\b|\bcovered\b|\ball set\b|\bwell done\b/i,
    );
    // It says what was checked, not what is true in general.
    expect(result.detail).toContain('That is what was checked, on this pack, today.');
  });
});

// TC-5.2.1-E. The single most important thing this screen must not do.
describe('a result never marks the reader', () => {
  const everyState = [
    rehearsalResult(rehearsal([packContentGap, persistentGap])),
    rehearsalResult(rehearsal([])),
  ];

  it('carries no total, count, percentage, score or grade in its shape', () => {
    everyState.forEach((result) => {
      ['total', 'count', 'score', 'grade', 'percentage', 'passed', 'failed', 'readiness'].forEach(
        (field) => expect(result).not.toHaveProperty(field),
      );
      Object.values(result).forEach((value) => expect(typeof value).not.toBe('number'));
    });
  });

  it('carries no total, count, percentage, score or grade in its words', () => {
    const everyString = everyState
      .flatMap((result) =>
        result.state === 'gaps'
          ? [result.conditionLine, ...result.rows.flatMap((row) => [row.hazardLine, row.title, row.meaning, row.action])]
          : [result.conditionLine, result.heading, result.detail],
      )
      .join(' ');

    expect(everyString).not.toMatch(
      /\b\d+ (of|out of|gaps?|items?|checks?)\b|\b\d+%|\bscore\b|\bgrade\b|\btotal\b|\bpassed\b|\bfailed\b|\bpass\b|\bfail\b/i,
    );
    // No bare digit anywhere: a number on this screen is a number the reader
    // would count with.
    expect(everyString).not.toMatch(/\d/);
  });

  it('says nothing about the reader at all', () => {
    const everyString = [
      copy.RESULT_HEADING,
      copy.RESULT_CONDITION_LINE('No mobile data'),
      copy.NO_GAPS_HEADING,
      copy.NO_GAPS_DETAIL('No mobile data'),
      copy.ACTION_LABEL,
    ].join(' ');
    expect(everyString).not.toMatch(/\bunprepared\b|\byou (are|aren't) (ready|prepared)\b/i);
  });
});

// TC-5.2.1-F. Reading the result again gives the same result: it is rendered
// from what the run recorded, not from a fresh look at the pack.
describe('a result is a reading of the run that was recorded', () => {
  it('is the same every time it is read', () => {
    const record = rehearsal([packContentGap, persistentGap]);
    expect(rehearsalResult(record)).toEqual(rehearsalResult(record));
  });

  it('does not change the gaps it was given', () => {
    const gaps = [packContentGap, persistentGap];
    const record = rehearsal(gaps);
    rehearsalResult(record);
    expect(record.gaps).toEqual([packContentGap, persistentGap]);
  });
});

// E5-US2-AC1 — the reader's own record of what they have done about a gap.
describe('an action the reader has marked done', () => {
  const completion = (over: Partial<ActionCompletion> = {}): ActionCompletion => ({
    id: 'pack-1:build-pack-again-for-places',
    packId: 'pack-1',
    actionId: 'build-pack-again-for-places',
    doneAt: Date.UTC(2026, 2, 3),
    ...over,
  });

  const rowsOf = (record: Rehearsal, completions: ActionCompletion[]) => {
    const result = rehearsalResult(record, completions);
    if (result.state !== 'gaps') throw new Error('expected gaps');
    return result.rows;
  };

  // TC-5.2.1-C, the reading half: the date is carried, in the product's format.
  it('carries the date it was marked, written as every date in this product is', () => {
    const [row] = rowsOf(rehearsal([packContentGap]), [completion()]);
    expect(row.doneOn).toBe('3 March 2026');
    expect(copy.ACTION_DONE_ON(row.doneOn!)).toBe('You marked this done 3 March 2026');
  });

  it('is not done until there is a completion for it', () => {
    const [row] = rowsOf(rehearsal([packContentGap]), []);
    expect(row.doneOn).toBeNull();
  });

  // One field, not a boolean beside a date: a row cannot say it is done while
  // holding no date to say it with.
  it('cannot say it is done without the date it was done on', () => {
    rowsOf(rehearsal([packContentGap, persistentGap]), [completion()]).forEach((row) => {
      expect(row).not.toHaveProperty('done');
      expect(typeof row.doneOn === 'string' || row.doneOn === null).toBe(true);
    });
  });

  it('marks only the action it belongs to', () => {
    const rows = rowsOf(rehearsal([packContentGap, persistentGap]), [completion()]);
    expect(rows[0].doneOn).toBe('3 March 2026');
    expect(rows[1].doneOn).toBeNull();
  });

  // A completion is identified by the pack it was made against. One pack's
  // record says nothing about another's.
  it('does not carry across to another pack', () => {
    const [row] = rowsOf(rehearsal([packContentGap]), [
      completion({ packId: 'other-pack', id: 'other-pack:build-pack-again-for-places' }),
    ]);
    expect(row.doneOn).toBeNull();
  });

  it('ignores a completion for an action this result does not carry', () => {
    const rows = rowsOf(rehearsal([persistentGap]), [completion()]);
    expect(rows[0].doneOn).toBeNull();
  });

  // Completions belong to the pack, not to the run, so a later run finds the
  // ones made before it: the reader does not re-tick what they have done.
  it('is found by a later run of the same pack', () => {
    const laterRun = rehearsal([packContentGap], { id: 'run-2', startedAt: 2, finishedAt: 3 });
    expect(rowsOf(laterRun, [completion()])[0].doneOn).toBe('3 March 2026');
  });

  // TC-5.2.1-F. The record of what a rehearsal found is not touched by what the
  // reader has done about it.
  it('does not change the gap it belongs to', () => {
    const record = rehearsal([packContentGap, persistentGap]);
    const withNone = rowsOf(record, []);
    const withOne = rowsOf(record, [completion()]);

    expect(record.gaps).toEqual([packContentGap, persistentGap]);
    expect(withOne.map((row) => row.gapType)).toEqual(withNone.map((row) => row.gapType));
    expect(withOne.map((row) => row.action)).toEqual(withNone.map((row) => row.action));
    expect(withOne.map((row) => row.meaning)).toEqual(withNone.map((row) => row.meaning));
  });

  // TC-5.2.1-I, the reading half: with the completion gone the row is simply
  // not done. It is not newly detected, and nothing about the gap changed.
  it('reads as not done once the reader has removed it, and nothing else moves', () => {
    const record = rehearsal([packContentGap]);
    const before = rowsOf(record, []);
    const marked = rowsOf(record, [completion()]);
    const undone = rowsOf(record, []);

    expect(marked[0].doneOn).toBe('3 March 2026');
    expect(undone[0].doneOn).toBeNull();
    expect(undone).toEqual(before);
  });

  it('never turns a completion into a number', () => {
    const result = rehearsalResult(rehearsal([packContentGap, persistentGap]), [completion()]);
    ['done', 'doneCount', 'remaining', 'outstanding', 'completed'].forEach((field) =>
      expect(result).not.toHaveProperty(field),
    );
  });
});

describe('the wording of the record and of a write that did not keep', () => {
  it('attributes a completion to the reader, not to the world', () => {
    expect(copy.ACTION_DONE_ON('3 March 2026')).toBe('You marked this done 3 March 2026');
    // Never reads as the lost capability having returned.
    expect(copy.ACTION_DONE_ON('3 March 2026')).not.toMatch(
      /\brestored\b|\bfixed\b|\bworking\b|\bavailable\b|\bresolved\b/i,
    );
  });

  it('offers the correction in the reader\'s own terms', () => {
    expect(copy.MARK_ACTION_DONE).toBe('Mark this done');
    expect(copy.UNDO_ACTION_DONE).toBe('I have not done this');
  });

  // Rule 0.1: "we could not keep this" and "this did not happen" are different
  // statements, and the screen makes the first one.
  it('says a run was not kept without saying it did not happen', () => {
    expect(copy.RUN_NOT_KEPT).toBe(
      'This rehearsal could not be kept on this device. What it found is on this screen now, and will not be here later.',
    );
    expect(copy.RUN_NOT_KEPT).not.toMatch(/\bdid not (run|happen)\b|\bfailed to run\b|\bno rehearsal\b/i);
  });

  it('says a marking was not kept, and promises no date for it', () => {
    expect(copy.ACTION_NOT_KEPT).toBe(
      'This could not be kept on this device. Nothing was recorded, so it will still be here to mark next time.',
    );
    expect(copy.ACTION_NOT_KEPT).not.toMatch(/\d/);
  });

  it('says nothing about the reader being unprepared', () => {
    [copy.RUN_NOT_KEPT, copy.ACTION_NOT_KEPT, copy.MARK_ACTION_DONE, copy.UNDO_ACTION_DONE].forEach(
      (line) => expect(line).not.toMatch(/\bunprepared\b|\bnot ready\b/i),
    );
  });
});
