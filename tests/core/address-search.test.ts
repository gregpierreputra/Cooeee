import { describe, expect, it } from 'vitest';

import {
  addressQueryCanRun,
  addressQueryForCql,
  addressResultsAtLimit,
  completedSearchState,
  liveSearchState,
  resolveAddressCandidates,
  sameAddressQuery,
  type SettledSearch,
} from '../../src/core/address-search';
import * as copy from '../../src/core/copy';
import type { AddressCandidate, AddressRecord } from '../../src/core/types';

const KALORAMA = { lat: -37.817939, lon: 145.36594 };
const NEARBY = { lat: -37.817944, lon: 145.365951 };

function record(
  address: string,
  over: Partial<AddressRecord> = {},
): AddressRecord {
  return {
    candidate: { address, localityName: 'KALORAMA', ...KALORAMA },
    propertyStatus: 'A',
    isPrimary: false,
    ...over,
  };
}

/** One record of an exact-address group, at a stated point. */
function at(
  address: string,
  point: { lat: number; lon: number },
  over: Partial<AddressRecord> = {},
): AddressRecord {
  return record(address, {
    candidate: { address, localityName: 'KALORAMA', ...point },
    ...over,
  });
}

const addresses = ({ candidates }: { candidates: { address: string }[] }) =>
  candidates.map(({ address }) => address);

describe('address search decisions', () => {
  it.each([
    ['AB', false],
    ['ABC', true],
    ['ABCD', true],
  ])('requires at least three trimmed characters for %j', (query, expected) => {
    expect(addressQueryCanRun(query)).toBe(expected);
  });

  it('uppercases, trims and CQL-escapes only the outbound query', () => {
    expect(addressQueryForCql("  o'connor ")).toBe("O''CONNOR");
  });

  it('preserves service order while excluding inactive records', () => {
    expect(addresses(resolveAddressCandidates([
      record('SECOND'),
      record('RETIRED', { propertyStatus: 'R' }),
      record('FIRST'),
    ]))).toEqual(['SECOND', 'FIRST']);
  });

  it('returns nothing for an empty response', () => {
    expect(resolveAddressCandidates([]))
      .toEqual({ candidates: [], unresolvedCount: 0, returnedCount: 0 });
  });
});

describe('E1-US1-AC2 duplicate resolution — identical coordinates', () => {
  it('collapses one repeated address to a single candidate at its first-seen position', () => {
    const resolution = resolveAddressCandidates([
      at('6 RIDGE ROAD KALORAMA 3766', KALORAMA),
      at('8 RIDGE ROAD KALORAMA 3766', KALORAMA),
      at('6 RIDGE ROAD KALORAMA 3766', KALORAMA),
    ]);
    expect(addresses(resolution)).toEqual([
      '6 RIDGE ROAD KALORAMA 3766',
      '8 RIDGE ROAD KALORAMA 3766',
    ]);
    expect(resolution.unresolvedCount).toBe(0);
  });

  it('uses the selection flag only to replace a duplicate in place, never to reorder', () => {
    const secondary = at('SAME', KALORAMA, {
      candidate: { address: 'SAME', localityName: 'SECONDARY', ...KALORAMA },
    });
    const flagged = at('SAME', KALORAMA, {
      isPrimary: true,
      candidate: { address: 'SAME', localityName: 'FLAGGED', ...KALORAMA },
    });
    expect(resolveAddressCandidates([secondary, record('NEXT'), flagged])).toEqual({
      candidates: [flagged.candidate, record('NEXT').candidate],
      unresolvedCount: 0,
      returnedCount: 3,
    });
  });

  it('retains the first record in service order when no record in the group is flagged', () => {
    const first = at('SAME', KALORAMA, {
      candidate: { address: 'SAME', localityName: 'FIRST', ...KALORAMA },
    });
    const second = at('SAME', KALORAMA, {
      candidate: { address: 'SAME', localityName: 'SECOND', ...KALORAMA },
    });
    expect(resolveAddressCandidates([first, second]).candidates).toEqual([first.candidate]);
  });
});

describe('E1-US1-AC2 duplicate resolution — conflicting coordinates', () => {
  it('retains the one flagged record when exactly one record in the group is flagged', () => {
    const unflagged = at('6 RIDGE ROAD KALORAMA 3766', KALORAMA);
    const flagged = at('6 RIDGE ROAD KALORAMA 3766', NEARBY, { isPrimary: true });
    expect(resolveAddressCandidates([unflagged, flagged])).toEqual({
      candidates: [flagged.candidate],
      unresolvedCount: 0,
      returnedCount: 2,
    });
  });

  it('selects no coordinate and reports the group unresolved when none is flagged', () => {
    expect(resolveAddressCandidates([
      at('6 RIDGE ROAD KALORAMA 3766', KALORAMA),
      at('6 RIDGE ROAD KALORAMA 3766', NEARBY),
    ])).toEqual({ candidates: [], unresolvedCount: 1, returnedCount: 2 });
  });

  it('selects no coordinate and reports the group unresolved when more than one is flagged', () => {
    expect(resolveAddressCandidates([
      at('6 RIDGE ROAD KALORAMA 3766', KALORAMA, { isPrimary: true }),
      at('6 RIDGE ROAD KALORAMA 3766', NEARBY, { isPrimary: true }),
    ])).toEqual({ candidates: [], unresolvedCount: 1, returnedCount: 2 });
  });

  it('withholds only the unresolved group and keeps every resolved candidate in order', () => {
    const resolution = resolveAddressCandidates([
      at('4 RIDGE ROAD KALORAMA 3766', KALORAMA),
      at('6 RIDGE ROAD KALORAMA 3766', KALORAMA),
      at('6 RIDGE ROAD KALORAMA 3766', NEARBY),
      at('8 RIDGE ROAD KALORAMA 3766', NEARBY),
    ]);
    expect(addresses(resolution)).toEqual([
      '4 RIDGE ROAD KALORAMA 3766',
      '8 RIDGE ROAD KALORAMA 3766',
    ]);
    expect(resolution.unresolvedCount).toBe(1);
  });

  it('counts unresolved groups, not the records inside them', () => {
    expect(resolveAddressCandidates([
      at('6 RIDGE ROAD KALORAMA 3766', KALORAMA),
      at('6 RIDGE ROAD KALORAMA 3766', NEARBY),
      at('8 RIDGE ROAD KALORAMA 3766', KALORAMA),
      at('8 RIDGE ROAD KALORAMA 3766', NEARBY),
      at('8 RIDGE ROAD KALORAMA 3766', { lat: -37.9, lon: 145.4 }),
    ])).toEqual({ candidates: [], unresolvedCount: 2, returnedCount: 5 });
  });

  it('ignores an inactive record when deciding whether a group conflicts', () => {
    const active = at('6 RIDGE ROAD KALORAMA 3766', KALORAMA);
    expect(resolveAddressCandidates([
      active,
      at('6 RIDGE ROAD KALORAMA 3766', NEARBY, { propertyStatus: 'R' }),
    ])).toEqual({ candidates: [active.candidate], unresolvedCount: 0, returnedCount: 2 });
  });
});

describe('E1-US1-AC2 distinct addresses are never merged', () => {
  it('keeps units, suffixes and street numbers apart even at one shared coordinate', () => {
    const distinct = [
      '1/6 RIDGE ROAD KALORAMA 3766',
      '2/6 RIDGE ROAD KALORAMA 3766',
      '6 RIDGE ROAD KALORAMA 3766',
      '6A RIDGE ROAD KALORAMA 3766',
      '6-8 RIDGE ROAD KALORAMA 3766',
      '16 RIDGE ROAD KALORAMA 3766',
    ];
    const resolution = resolveAddressCandidates(distinct.map((a) => at(a, KALORAMA)));
    expect(addresses(resolution)).toEqual(distinct);
    expect(resolution.unresolvedCount).toBe(0);
  });

  it('applies no trimming, case folding or punctuation stripping to the grouping key', () => {
    const distinct = ['6 RIDGE ROAD', '6  RIDGE ROAD', ' 6 RIDGE ROAD', '6 ridge road'];
    expect(addresses(resolveAddressCandidates(
      distinct.map((a) => at(a, KALORAMA)),
    ))).toEqual(distinct);
  });

  it('emits every candidate verbatim, never a value merged across records', () => {
    const flagged = at('SAME', NEARBY, {
      isPrimary: true,
      candidate: { address: 'SAME', localityName: 'FLAGGED', ...NEARBY },
    });
    const [candidate] = resolveAddressCandidates([
      at('SAME', KALORAMA, {
        candidate: { address: 'SAME', localityName: 'OTHER', ...KALORAMA },
      }),
      flagged,
    ]).candidates;
    expect(candidate).toEqual(flagged.candidate);
  });
});

describe('E1-US1-AC2 search state', () => {
  it('keeps a single candidate as a candidate-list state', () => {
    const candidate = record('ONLY').candidate;
    expect(completedSearchState({ candidates: [candidate], unresolvedCount: 0, returnedCount: 1 }))
      .toEqual({ kind: 'candidates', candidates: [candidate], unresolvedCount: 0, returnedCount: 1 });
  });

  it('maps an empty successful response to no-match, not failure', () => {
    expect(completedSearchState({ candidates: [], unresolvedCount: 0, returnedCount: 0 }))
      .toEqual({ kind: 'no-match' });
  });

  it('never reports no-match while an unresolved group is present', () => {
    expect(completedSearchState({ candidates: [], unresolvedCount: 1, returnedCount: 2 })).toEqual({
      kind: 'candidates', candidates: [], unresolvedCount: 1, returnedCount: 2,
    });
  });

  it('carries the unresolved count alongside resolved candidates', () => {
    const candidate = record('ONLY').candidate;
    expect(completedSearchState({ candidates: [candidate], unresolvedCount: 2, returnedCount: 5 }))
      .toEqual({
        kind: 'candidates', candidates: [candidate], unresolvedCount: 2, returnedCount: 5,
      });
  });

  it('cannot turn a response holding an active record into no-match', () => {
    const resolution = resolveAddressCandidates([record('ONLY')]);
    expect(completedSearchState(resolution).kind).toBe('candidates');
  });
});

describe('E1-US1-AC2–AC4 copy', () => {
  it('keeps candidate choice wording exact', () => {
    expect(copy.CHOOSE_ADDRESS).toBe('Choose your address from the list.');
    expect(copy.NONE_OF_THESE).toBe('None of these is my address');
  });

  // Character for character, including the em dash. The hyphen that stood here
  // until now was a different sentence from the one the baseline mandates.
  it('uses the baseline R2 no-match literal exactly, em dash included', () => {
    expect(copy.NO_ADDRESS_MATCH).toBe(
      'No matching address found — check the spelling or try the nearest cross street.',
    );
    expect(copy.NO_ADDRESS_MATCH).toContain('\u2014');
    expect(copy.NO_ADDRESS_MATCH).not.toContain('-');
  });

  it('keeps both search-failure sentences exact', () => {
    expect(copy.SEARCH_COULD_NOT_RUN).toBe('We could not search for this address right now.');
    expect(copy.SEARCH_FAILURE_MEANING).toBe(
      'This is not the same as saying the address is not there. Try again when you have a connection.',
    );
  });

  it('states the ambiguity without naming a count it does not have', () => {
    expect(copy.ADDRESS_NOT_RESOLVED).toBe(
      'One address could not be matched to a single map location.',
    );
    expect(copy.ADDRESSES_NOT_RESOLVED(3)).toBe(
      '3 addresses could not be matched to a single map location.',
    );
  });

  it('explains the ambiguity and offers a way forward, without reassurance', () => {
    expect(copy.ADDRESS_NOT_RESOLVED_REASON).toBe(
      'The address register holds multiple map locations for the same written address, so Cooeee cannot choose one.',
    );
    expect(copy.REFINE_ADDRESS_HINT).toBe(
      'Check or add a unit or street number, then search again.',
    );
  });
});

// ── E1-US1-AC2 live search while typing ─────────────────────────────────────
// The three states the live search must never conflate are tested one at a
// time: still typing, answered with nothing, and could not run.

const resolution = (candidates: AddressCandidate[], unresolvedCount = 0, returnedCount = candidates.length) =>
  ({ candidates, unresolvedCount, returnedCount });

const answered = (query: string, candidates: AddressCandidate[], returnedCount?: number): SettledSearch =>
  ({ query, outcome: { kind: 'resolved', resolution: resolution(candidates, 0, returnedCount) } });

const failedFor = (query: string): SettledSearch => ({ query, outcome: { kind: 'failed' } });

describe('E1-US1-AC2 live search state', () => {
  const candidate = record('6 RIDGE ROAD KALORAMA 3766').candidate;

  it.each([
    ['', 'too-short'],
    ['RI', 'too-short'],
    ['RID', 'pending'],
    ['RIDG', 'pending'],
  ])('below the minimum %j never reaches a request state', (query, expected) => {
    expect(liveSearchState(query, null, false).kind).toBe(expected);
  });

  it('is pending, never no-match, while the query has no answer of its own', () => {
    expect(liveSearchState('RIDGE', null, false)).toEqual({ kind: 'pending' });
  });

  it('is pending while an answer to earlier text is all that exists', () => {
    expect(liveSearchState('RIDGE ROAD', answered('RIDGE', [candidate]), false))
      .toEqual({ kind: 'pending' });
  });

  it('cannot show the no-match sentence for a query that was never answered', () => {
    expect(liveSearchState('RIDGE ROAD', answered('RIDGE', []), false).kind).toBe('pending');
  });

  it('says no-match only when this exact query was answered with nothing', () => {
    expect(liveSearchState('RIDGE', answered('RIDGE', []), false)).toEqual({ kind: 'no-match' });
  });

  it('says unavailable, never no-match, when the search could not run', () => {
    expect(liveSearchState('RIDGE', failedFor('RIDGE'), false)).toEqual({ kind: 'unavailable' });
  });

  it('lists candidates with the count the register returned', () => {
    expect(liveSearchState('RIDGE', answered('RIDGE', [candidate], 4), false)).toEqual({
      kind: 'candidates', candidates: [candidate], unresolvedCount: 0, returnedCount: 4,
    });
  });

  it('treats surrounding whitespace as the same search, not a stale answer', () => {
    expect(liveSearchState('  RIDGE ', answered('RIDGE', [candidate]), false).kind)
      .toBe('candidates');
    expect(sameAddressQuery(' RIDGE ', 'RIDGE')).toBe(true);
    expect(sameAddressQuery('RIDGE', 'RIDGE ROAD')).toBe(false);
  });

  it('withholds the list once dismissed, without claiming a result either way', () => {
    expect(liveSearchState('RIDGE', answered('RIDGE', [candidate]), true))
      .toEqual({ kind: 'dismissed' });
  });

  it('ends dismissal when the query changes, and returns to pending', () => {
    // The component clears the flag on change; the state is pending regardless,
    // because the new text has no answer of its own yet.
    expect(liveSearchState('RIDGE R', answered('RIDGE', [candidate]), true))
      .toEqual({ kind: 'pending' });
  });

  it('drops back to the hint below the minimum, whatever was answered before', () => {
    expect(liveSearchState('RI', answered('RIDGE', [candidate]), false))
      .toEqual({ kind: 'too-short' });
  });
});

describe('E1-US1-AC2 returned-record count', () => {
  it.each([
    [9, false],
    [10, true],
    [11, true],
  ])('treats %i returned records as at the cap: %j (inclusive at the limit)', (count, expected) => {
    expect(addressResultsAtLimit(count)).toBe(expected);
  });

  it('counts what the register returned, not what survived filtering', () => {
    const resolved = resolveAddressCandidates([
      record('FIRST'),
      record('RETIRED', { propertyStatus: 'R' }),
      at('FIRST', KALORAMA, { isPrimary: true }),
    ]);
    expect(resolved.returnedCount).toBe(3);
    expect(resolved.candidates).toHaveLength(1);
  });

  it('reports zero returned records for an empty response', () => {
    expect(resolveAddressCandidates([]).returnedCount).toBe(0);
  });

  it('states both numbers in one line, so the cap cannot read as the whole register', () => {
    expect(copy.ADDRESS_RESULT_COUNT(10, 8)).toBe(
      'The address register returned 10 records; 8 distinct addresses are listed below.',
    );
    expect(copy.ADDRESS_RESULT_COUNT(1, 1)).toBe(
      'The address register returned 1 record; 1 distinct address is listed below.',
    );
    expect(copy.ADDRESS_RESULT_CAPPED(10)).toBe(
      'Cooeee asks the register for at most 10 records, so there may be more. '
      + 'Type more of the address to shorten the list.',
    );
  });
});