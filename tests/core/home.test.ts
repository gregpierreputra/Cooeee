import { describe, expect, it } from 'vitest';
import { MS_PER_DAY, PACK_REFRESH_DAYS } from '../../src/core/constants';
import * as copy from '../../src/core/copy';
import {
  headerAge,
  homeView,
  NAV_ITEMS,
  oldestPack,
  preparationLine,
  preparationLineIndex,
  titleCase,
} from '../../src/core/home';
import { pack } from '../fixtures';

const NOW = Date.UTC(2026, 8, 1, 9);
const daysAgo = (days: number) => NOW - days * MS_PER_DAY;

// TC-1.2.6-A/B/C. The header's three states, at value-1, value and value+1
// around the inclusive 30-day window. Day 30 is INSIDE the window: the label
// starts on day 31, never on day 30.
describe('header age', () => {
  it('states the age in days on the day the pack was saved', () => {
    expect(headerAge(NOW, daysAgo(0))).toEqual({
      kind: 'checked',
      days: 0,
      text: 'Checked 0 days ago',
    });
  });

  it('states the age in days at 29 days, one inside the window', () => {
    expect(headerAge(NOW, daysAgo(29))).toEqual({
      kind: 'checked',
      days: 29,
      text: 'Checked 29 days ago',
    });
  });

  it('still states the age at exactly 30 days — the window is inclusive', () => {
    expect(headerAge(NOW, daysAgo(PACK_REFRESH_DAYS))).toEqual({
      kind: 'checked',
      days: 30,
      text: 'Checked 30 days ago',
    });
  });

  it('carries the label from day 31, the first day past the window', () => {
    expect(headerAge(NOW, daysAgo(PACK_REFRESH_DAYS + 1))).toEqual({
      kind: 'not-recently-verified',
      days: 31,
      text: 'Not recently verified',
    });
  });

  it('carries the label, and no day count in words, well past the window', () => {
    const age = headerAge(NOW, daysAgo(44));
    expect(age).toEqual({ kind: 'not-recently-verified', days: 44, text: 'Not recently verified' });
    expect(age.kind === 'not-recently-verified' && age.text).not.toContain('44');
  });

  // TC-1.2.6-D. No pack, no age: the header states nothing rather than
  // standing in a dash, a zero or a reassurance.
  it('reports nothing at all when no pack is saved', () => {
    expect(headerAge(NOW, null)).toEqual({ kind: 'none' });
  });

  // A device clock behind the saved date must not produce a negative age;
  // savedAgeDays floors at zero and the header inherits that.
  it('never reports a negative age when the device clock is behind', () => {
    expect(headerAge(NOW, NOW + 5 * MS_PER_DAY)).toEqual({
      kind: 'checked',
      days: 0,
      text: 'Checked 0 days ago',
    });
  });
});

describe('the pack the header reports', () => {
  it('is nothing when the store is empty', () => {
    expect(oldestPack([])).toBeNull();
  });

  it('is the only pack in the Iteration 1 store', () => {
    const only = pack({ verifiedAt: daysAgo(3) });
    expect(oldestPack([only])).toBe(only);
  });

  // Iteration 1 never stores two complete packs. If a later epic ever does,
  // the oldest is the honest figure to report — never the newest.
  it('is the oldest, if a later epic ever stores more than one', () => {
    const older = pack({ id: 'older', verifiedAt: daysAgo(40) });
    const newer = pack({ id: 'newer', verifiedAt: daysAgo(1) });
    expect(oldestPack([newer, older])).toBe(older);
    expect(headerAge(NOW, oldestPack([newer, older])!.verifiedAt).kind).toBe(
      'not-recently-verified',
    );
  });
});

// The line is chosen from whole days since the epoch, so every mount on the
// same day returns the same line: navigating away and back cannot reshuffle it.
describe('preparation line selection', () => {
  it('is stable for every instant within one day', () => {
    const start = 12 * MS_PER_DAY;
    expect(preparationLineIndex(start, 8)).toBe(4);
    expect(preparationLineIndex(start + MS_PER_DAY - 1, 8)).toBe(4);
  });

  it('moves on by one at the day boundary, and wraps at the end of the set', () => {
    expect(preparationLineIndex(0, 8)).toBe(0);
    expect(preparationLineIndex(MS_PER_DAY, 8)).toBe(1);
    expect(preparationLineIndex(7 * MS_PER_DAY, 8)).toBe(7);
    expect(preparationLineIndex(8 * MS_PER_DAY, 8)).toBe(0);
  });

  it('returns an index inside the set for a seed before the epoch', () => {
    expect(preparationLineIndex(-MS_PER_DAY, 8)).toBe(7);
    expect(preparationLineIndex(-9 * MS_PER_DAY, 8)).toBe(7);
  });

  it('returns an index inside the set for every day of a year', () => {
    for (let day = 0; day < 365; day += 1) {
      const index = preparationLineIndex(day * MS_PER_DAY, copy.PREPARATION_LINES.length);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(copy.PREPARATION_LINES.length);
    }
  });

  it('names its source alongside the line it chose', () => {
    const line = preparationLine(NOW);
    expect(copy.PREPARATION_LINES.map((row) => row.text)).toContain(line.text);
    expect(line.source).toBe('Based on Country Fire Authority guidance.');
  });

  it('offers eight lines, none of them about a place or about conditions', () => {
    expect(copy.PREPARATION_LINES).toHaveLength(8);
    expect(new Set(copy.PREPARATION_LINES.map((row) => row.text)).size).toBe(8);
    expect(new Set(copy.PREPARATION_LINES.map((row) => row.context)).size).toBe(8);
  });
});

// BlackSky is entered by a deliberate hold. It is never a tab, in any state.
describe('bottom navigation', () => {
  it('offers home and nearby places, the same whether or not a pack is saved', () => {
    expect(NAV_ITEMS).toEqual([
      { key: 'home', label: 'Home', to: '/' },
      { key: 'nearby', label: 'Nearby', to: '/nearby' },
    ]);
  });

  it('never offers BlackSky as a tab', () => {
    expect(NAV_ITEMS.map((item) => item.to)).not.toContain('/blacksky');
    expect(NAV_ITEMS.map((item) => item.label)).not.toContain(copy.HOLD_FOR_BLACKSKY);
  });
});

// TC-1.2.6-D and the Open-or-Build rule: one pack is opened, no pack is built,
// and the screen never offers both.
describe('the home view', () => {
  it('offers to build, and reports no age, when nothing is saved', () => {
    const view = homeView(NOW, []);
    expect(view.kind).toBe('no-pack');
  });

  it('offers the saved pack, with the pack card wording for its age', () => {
    const saved = pack({ verifiedAt: daysAgo(3) });
    const view = homeView(NOW, [saved]);
    expect(view.kind).toBe('pack');
    expect(view.kind === 'pack' && view.pack).toBe(saved);
    expect(view.kind === 'pack' && view.ageLine).toBe('Saved 3 days ago');
  });

  // The two wordings are deliberately different, and mean different things: the
  // card reports when the pack was written, the header when it was last checked.
  it('keeps the card wording and the header wording distinct past the window', () => {
    const view = homeView(NOW, [pack({ verifiedAt: daysAgo(44) })]);
    expect(view.kind === 'pack' && view.ageLine).toBe('Saved 44 days ago, not recently verified');
    const age = headerAge(NOW, daysAgo(44));
    expect(age.kind === 'not-recently-verified' && age.text).toBe('Not recently verified');
  });

  it('carries one preparation line and its source in every state', () => {
    for (const view of [homeView(NOW, []), homeView(NOW, [pack()])]) {
      expect(copy.PREPARATION_LINES.map((row) => row.text)).toContain(view.preparation.text);
      expect(view.preparation.context).not.toBe('');
      expect(view.preparation.source).toBe(copy.PREPARATION_SOURCE);
    }
  });
});

// Display only. The pack still stores the custodian's own string, so nothing
// downstream is ever compared against a value this function invented.
describe('address for display', () => {
  const displayAddress = titleCase;
  it('title-cases the capitals the geocoder returns, and leaves the numbers alone', () => {
    expect(displayAddress('10 OLD ROAD FERNY CREEK 3786')).toBe('10 Old Road Ferny Creek 3786');
    expect(displayAddress('6 RIDGE ROAD KALORAMA 3766')).toBe('6 Ridge Road Kalorama 3766');
  });

  it('leads the word after a hyphen, a slash and an apostrophe', () => {
    expect(displayAddress('12-14 ST ANDREWS ROAD')).toBe('12-14 St Andrews Road');
    expect(displayAddress('2/8 OBRIENS ROAD')).toBe('2/8 Obriens Road');
    expect(displayAddress("5 O'HARA STREET")).toBe("5 O'Hara Street");
    // A possessive is not a new word: the letter after its apostrophe stays down.
    expect(displayAddress("12 ST PATRICK'S ROAD")).toBe("12 St Patrick's Road");
  });

  it('returns the empty string unchanged, and never invents a character', () => {
    expect(displayAddress('')).toBe('');
    expect(displayAddress('10 OLD ROAD')).toHaveLength('10 OLD ROAD'.length);
  });
});

// The heading and the address line are cased by the one rule, so the card does
// not shout its name over a title-cased line. Storage is untouched either way.
describe('place name for display', () => {
  it('title-cases the locality the geocoder returned as the default name', () => {
    expect(titleCase('CLAYTON')).toBe('Clayton');
    expect(titleCase('FERNY CREEK')).toBe('Ferny Creek');
  });

  it('leaves a name the user typed themselves as they wrote it', () => {
    expect(titleCase('Kalorama')).toBe('Kalorama');
    expect(titleCase("Mum's Place")).toBe("Mum's Place");
  });
});
