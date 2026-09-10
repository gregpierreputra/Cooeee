import { describe, expect, it } from 'vitest';
import * as copy from '../../src/core/copy';
import { rehearsalResult } from '../../src/core/rehearsal-result';
import type { DetectedGap, Rehearsal } from '../../src/core/types';

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
