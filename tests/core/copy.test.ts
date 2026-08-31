import { describe, expect, it } from 'vitest';
import * as copy from '../../src/core/copy';

// Exact match, character for character, em dashes and the ± sign included. These
// lines are the product's central safety claim, so a reword is a test failure and
// not a style discussion.
describe('mandated literals', () => {
  it('destinations are never ranked by worth', () => {
    expect(copy.SORTED_BY_DISTANCE).toBe('sorted by distance, not a safety ranking');
  });

  it('recovery never implies an entitlement', () => {
    expect(copy.ORG_DECIDES).toBe('the responsible organisation decides who is eligible');
  });

  it('history is context, never a prediction', () => {
    expect(copy.PAST_NOT_PREDICTION).toBe('Past events are not a prediction.');
  });

  it('absence of a place of last resort is stated, not implied by silence', () => {
    expect(copy.NO_DESTINATION_PUBLISHED).toBe(
      'No official place of last resort is published for this area',
    );
  });

  // Exact match including punctuation. The literal is mandated with an em dash;
  // a hyphen-minus in its place is a different sentence, and it stood in this
  // file undetected because the assertion carried the same typo.
  it('an unmatched address says what to try next, with the mandated em dash', () => {
    expect(copy.NO_ADDRESS_MATCH).toBe(
      'No matching address found — check the spelling or try the nearest cross street.',
    );
    expect([...copy.NO_ADDRESS_MATCH].filter((c) => c === '\u2014')).toHaveLength(1);
    expect(copy.NO_ADDRESS_MATCH).not.toContain('-');
  });

  it('no fix falls back to saved information, in words', () => {
    expect(copy.NO_GPS).toBe('No GPS fix — showing your saved information.');
  });

  it('a vague fix reports its own error figure', () => {
    expect(copy.GPS_TOO_INACCURATE(240)).toBe(
      'GPS is too inaccurate here to trust a direction (± 240 m).',
    );
  });

  it('being outside every prepared area is stated plainly', () => {
    expect(copy.OUTSIDE_AREAS).toBe("You're outside the areas you've prepared");
  });

  it('offline names the date of what is being shown', () => {
    expect(copy.OFFLINE_LINE('12 Oct 2026')).toBe(
      'Offline — showing your saved pack from 12 Oct 2026.',
    );
  });

  it('a stale pack is labelled without being disabled', () => {
    expect(copy.NOT_RECENTLY_VERIFIED(96)).toBe('Saved 96 days ago — not recently verified');
  });

  it('a failed check says the check failed, not that nothing changed', () => {
    expect(copy.CHECK_DID_NOT_FINISH('12 Oct 2026')).toBe(
      'The check did not finish — showing your saved copy from 12 Oct 2026.',
    );
  });

  it('no data distinguishes the internet from the phone network', () => {
    expect(copy.NO_DATA).toBe('Internet not reachable. Phone calls and SMS may still work.');
  });

  it('the app states what it cannot detect', () => {
    expect(copy.CANNOT_DETECT_SIGNAL).toBe(
      'may work if your phone shows signal — this app cannot detect phone signal',
    );
  });
});

describe('composed lines', () => {
  it('an absence reason carries the mandated line and the area verbatim', () => {
    expect(copy.NO_DESTINATION_PUBLISHED_FOR('Yarra Ranges')).toBe(
      'No official place of last resort is published for this area — Yarra Ranges.',
    );
  });

  it('a fresh pack is dated without a verdict attached', () => {
    expect(copy.SAVED_DAYS_AGO(3)).toBe('Saved 3 days ago');
  });
});

describe('shared vocabulary', () => {
  it('has 16 compass points, starting at north', () => {
    expect(copy.CARDINAL_POINTS).toHaveLength(16);
    expect(copy.CARDINAL_POINTS[0]).toBe('NORTH');
    expect(copy.CARDINAL_POINTS[8]).toBe('SOUTH');
  });

  it('has exactly three distance ordinals and no superlative', () => {
    expect(copy.ORDINALS).toEqual(['nearest', 'second nearest', 'third nearest']);
  });

  it('labels all six needs', () => {
    expect(Object.keys(copy.NEED_LABELS)).toEqual([
      'stay',
      'money',
      'food',
      'property',
      'health',
      'documents',
    ]);
  });
});

describe('shell copy', () => {
  it('states an update is waiting and that nothing changes until the user chooses', () => {
    expect(copy.NEW_VERSION_READY).toContain('nothing changes until then');
  });

  it('says a pack is missing without implying anything about the place', () => {
    expect(copy.NO_PACKS_YET).toBe('No packs saved yet.');
    expect(copy.NO_PACKS_HINT).toContain('while you have a connection');
  });
});

describe('E1-US2 mandated provenance and offline-source copy', () => {
  it('states why one item was omitted and the storage rule behind it', () => {
    expect(copy.ITEM_LEFT_OUT).toBe('One item was left out of your pack.');
    expect(copy.ITEM_LEFT_OUT_REASON).toBe(
      'It did not name who published it or when it was published, so it was not saved.',
    );
    expect(copy.PROVENANCE_STORAGE_RULE).toBe(
      'Cooeee only stores information it can show you the source for.',
    );
    expect(copy.ITEMS_LEFT_OUT(2)).toBe('2 items were left out of your pack.');
  });

  it('states what an offline source tap cannot do and what remains local', () => {
    expect(copy.SOURCE_IS_ON_WEB).toBe(
      'This source is on the web.',
    );
    expect(copy.STORED_PROVENANCE_REMAINS).toBe(
      'The publisher and the saved date below are stored on this device and stay readable.',
    );
    expect(copy.EXTERNAL_SOURCE_NOTICE).toBe(
      'Opening it may use your connection and leave Cooeee.',
    );
    expect(copy.CONTINUE_TO_ORIGINAL_SOURCE).toBe('Continue to original source (web)');
  });

  it('formats the shared publisher and saved date line exactly', () => {
    expect(copy.PROVENANCE_LINE('Department of Transport and Planning', '3 March 2026')).toBe(
      'Published by Department of Transport and Planning · Saved 3 March 2026',
    );
  });
});
