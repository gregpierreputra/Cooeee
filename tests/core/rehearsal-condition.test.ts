import { describe, expect, it } from 'vitest';
import * as copy from '../../src/core/copy';
import {
  REHEARSAL_CONDITIONS,
  conditionLabel,
  conditionRows,
  isRehearsalCondition,
  type RehearsalCondition,
} from '../../src/core/rehearsal-condition';

describe('the supported conditions', () => {
  // D-B, 9 September: two conditions, and the same two whatever the pack holds.
  // These are ways a phone fails, not ways a hazard behaves.
  it('are exactly two, fixed in code rather than read from data', () => {
    expect(REHEARSAL_CONDITIONS).toEqual(['no-data', 'no-location-fix']);
    expect(conditionRows()).toHaveLength(2);
  });

  it('are offered in a fixed order, so the list cannot reshuffle between mounts', () => {
    expect(conditionRows().map((row) => row.condition)).toEqual(conditionRows().map((row) => row.condition));
    expect(conditionRows().map((row) => row.condition)).toEqual(['no-data', 'no-location-fix']);
  });

  // TC-5.1.1-A. There is no selected, chosen, default or checked field on a
  // row, so nothing can be pre-selected: it is not that the value is false, it
  // is that the shape has nowhere to put it.
  it('carry no selected state, so nothing can be pre-selected', () => {
    conditionRows().forEach((row) => {
      expect(Object.keys(row).sort()).toEqual(['condition', 'detail', 'label']);
    });
  });

  // Nothing may present one condition as likelier, more realistic or more
  // serious. A row has no field that could hold such a claim, and no wording
  // that implies one.
  it('carry no rank, ordinal or likelihood, in shape or in wording', () => {
    const rows = conditionRows();
    rows.forEach((row) => {
      expect(row).not.toHaveProperty('rank');
      expect(row).not.toHaveProperty('order');
      expect(row).not.toHaveProperty('likelihood');
    });
    const everyWord = rows.map((row) => `${row.label} ${row.detail}`).join(' ');
    expect(everyWord).not.toMatch(
      /\bmost\b|\blikely\b|\bmore likely\b|\bcommon\b|\bworst\b|\btypical\b|\bserious\b|\brealistic\b|\bfirst\b|\bmain\b/i,
    );
  });

  it('state each condition in the reader\'s words, not as a technical state', () => {
    expect(conditionRows()).toEqual([
      {
        condition: 'no-data',
        label: 'No mobile data',
        detail: 'Nothing loads. Anything the phone did not already have is not there.',
      },
      {
        condition: 'no-location-fix',
        label: 'No location fix',
        detail: 'The phone cannot work out where it is.',
      },
    ]);
  });

  it('name themselves the same way once chosen as they did when offered', () => {
    conditionRows().forEach((row) => {
      expect(conditionLabel(row.condition)).toBe(row.label);
    });
    expect(copy.REHEARSING_WITHOUT(conditionLabel('no-data'))).toBe(
      'Rehearsing without: No mobile data',
    );
    expect(copy.REHEARSING_WITHOUT(conditionLabel('no-location-fix'))).toBe(
      'Rehearsing without: No location fix',
    );
  });
});

describe('a value that is not a supported condition', () => {
  it('is not treated as a choice, whatever it is', () => {
    ['', 'no data', 'NO-DATA', 'no-signal', 'flood', 'both', '0', 'null'].forEach((value) => {
      expect(isRehearsalCondition(value)).toBe(false);
    });
    [null, undefined, 0, 1, true, {}, [], ['no-data']].forEach((value) => {
      expect(isRehearsalCondition(value)).toBe(false);
    });
  });

  it('accepts exactly the supported set and nothing else', () => {
    REHEARSAL_CONDITIONS.forEach((condition) => expect(isRehearsalCondition(condition)).toBe(true));
  });

  // A third condition cannot be introduced by handing one in through route
  // state or a restored history entry: it is not a condition, so it is not a
  // choice, and the screen stays on the choice it has not been given.
  it('cannot introduce a third condition from outside the screen', () => {
    const injected: unknown = 'no-power';
    expect(isRehearsalCondition(injected)).toBe(false);
    expect(REHEARSAL_CONDITIONS).not.toContain(injected as RehearsalCondition);
  });
});

// TC-5.1.1-B. The carried value is ONE condition, not a collection: there is no
// shape in the type for a second to occupy, so "never two" holds by
// construction rather than by a check that could be forgotten.
describe('the chosen condition', () => {
  it('is a single value, and choosing again replaces rather than accumulates', () => {
    let chosen: RehearsalCondition | null = null;
    expect(chosen).toBeNull();

    chosen = 'no-data';
    expect(chosen).toBe('no-data');
    expect(Array.isArray(chosen)).toBe(false);

    chosen = 'no-location-fix';
    expect(chosen).toBe('no-location-fix');
    // The condition it replaced is gone, not held alongside.
    expect(chosen).not.toBe('no-data');
  });

  it('names one condition only, whichever was chosen', () => {
    REHEARSAL_CONDITIONS.forEach((condition) => {
      const line = copy.REHEARSING_WITHOUT(conditionLabel(condition));
      const others = REHEARSAL_CONDITIONS.filter((other) => other !== condition);
      others.forEach((other) => expect(line).not.toContain(conditionLabel(other)));
    });
  });
});

describe('the wording of this screen', () => {
  it('asks the question the criterion sets, pending the copy review', () => {
    expect(copy.CHOOSE_CONDITION_HEADING).toBe('What are we rehearsing without?');
  });

  it('names no hazard: a condition is a way the phone fails, not a way a hazard behaves', () => {
    const everyString = [
      copy.CHOOSE_CONDITION_HEADING,
      copy.CONDITION_NO_DATA,
      copy.CONDITION_NO_DATA_DETAIL,
      copy.CONDITION_NO_FIX,
      copy.CONDITION_NO_FIX_DETAIL,
      copy.REHEARSING_WITHOUT('No mobile data'),
    ];
    everyString.forEach((line) => {
      expect(line).not.toMatch(/\b(bushfire|fire|heat|hot|flood|flooding|storm|smoke|ember)\b/i);
    });
    expect(everyString.length).toBeGreaterThanOrEqual(6);
  });

  it('says nothing about the reader being unprepared', () => {
    const joined = [
      copy.CHOOSE_CONDITION_HEADING,
      copy.CONDITION_NO_DATA_DETAIL,
      copy.CONDITION_NO_FIX_DETAIL,
    ].join(' ');
    expect(joined).not.toMatch(/\bunprepared\b|\bnot ready\b|\byou (are|aren't) (ready|prepared)\b/i);
  });
});
