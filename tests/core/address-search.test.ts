import { describe, expect, it } from 'vitest';

import {
  addressQueryCanRun,
  addressFilterForCql,
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

  // The filter is checked by what it finds, not by how it is spelt: it is run
  // here over register rows exactly as the register would run it.
  type Row = Record<string, string | number | null>;
  const row = (fields: Row): Row => ({
    ezi_address: '', house_prefix_1: null, house_number_1: null, house_suffix_1: null,
    house_number_2: null, road_name: '', road_type: null, road_suffix: null,
    locality_name: '', postcode: '', ...fields,
  });
  const like = (pattern: string) =>
    new RegExp(`^${pattern.replace(/%/g, '.*').replace(/_/g, '.')}$`);
  function finds(typed: string, register: Row): boolean {
    const js = addressFilterForCql(typed)
      .replace(/(\w+) LIKE '([^']*)'/g, (_m, field, value) =>
        `${like(value)}.test(String(r.${field} ?? ''))`)
      .replace(/(\w+) (<=|>=) (\d+)/g, (_m, field, op, n) => `(r.${field} != null && r.${field} ${op} ${n})`)
      .replace(/(\w+) = (\d+)/g, (_m, field, n) => `r.${field} === ${n}`)
      .replace(/(\w+) = '([^']*)'/g, (_m, field, value) => `r.${field} === '${value}'`)
      .replace(/ AND /g, ' && ')
      .replace(/ OR /g, ' || ');
    return new Function('r', `return (${js});`)(register) as boolean;
  }

  const DANDENONG = row({
    ezi_address: '7/1774-1776 DANDENONG ROAD CLAYTON 3168', house_number_1: 1774, house_number_2: 1776,
    road_name: 'DANDENONG', road_type: 'ROAD', locality_name: 'CLAYTON', postcode: '3168',
  });
  const MARKET = row({
    ezi_address: '5A MARKET STREET S NEWTOWN (GEELONG) 3220', house_number_1: 5, house_suffix_1: 'A',
    road_name: 'MARKET', road_type: 'STREET', road_suffix: 'S', locality_name: 'NEWTOWN (GEELONG)', postcode: '3220',
  });
  const BARMAH = row({
    ezi_address: 'R25 BARMAH-SHEPPARTON ROAD MOUNT PLEASANT 3631', house_prefix_1: 'R', house_number_1: 25,
    road_name: 'BARMAH-SHEPPARTON', road_type: 'ROAD', locality_name: 'MOUNT PLEASANT', postcode: '3631',
  });
  const VISTA = row({
    ezi_address: 'G04/2 MT HENRY VISTA RIPPLESIDE 3215', house_number_1: 2,
    road_name: 'MT HENRY', road_type: 'VISTA', locality_name: 'RIPPLESIDE', postcode: '3215',
  });
  const CAUSEWAY = row({
    ezi_address: '42 VICTORIA PORTLAND 3305', house_number_1: 42,
    road_name: 'VICTORIA', locality_name: 'PORTLAND', postcode: '3305',
  });

  it.each<[string, Row]>([
    // The reported address: a number inside a stored range, typed every which way.
    ['1774 Dandenong Road', DANDENONG],
    ['1775 dandenong rd', DANDENONG],
    ['  1774-1776  Dandenong Rd, Clayton VIC 3168 ', DANDENONG],
    ['Unit 7/1776 Dandenong Rd Clayton, Victoria, Australia', DANDENONG],
    ['unit 7 1774 dandenong road 3168', DANDENONG],
    ['1774 Dandenong Clayton', DANDENONG],
    ['1774 Dandenong Ro', DANDENONG], // still being typed
    ['Dandenong Road Clayton', DANDENONG],
    // A number suffix, a road direction, and a suburb the register brackets.
    ['5a Market St S Newtown', MARKET],
    ['5A Market Street South, Newtown (Geelong) 3220', MARKET],
    // A number prefix, a hyphenated road typed with a space, Mount for the suburb.
    ['R25 Barmah Shepparton Rd Mt Pleasant', BARMAH],
    ['r25 barmah-shepparton road mount pleasant', BARMAH],
    // A lettered unit, Mount typed for the register's MT, a road type not in the short list.
    ['G04/2 Mount Henry Vista Rippleside', VISTA],
    ['g04/2 mt henry vista', VISTA],
    // A road with no type, whose name is also the state's.
    ['42 Victoria 3305', CAUSEWAY],
    ['42 Victoria Portland VIC', CAUSEWAY],
  ])('%j finds its register address', (typed, register) => {
    expect(finds(typed, register)).toBe(true);
  });

  it.each<[string, Row]>([
    ['1778 Dandenong Road', DANDENONG],      // outside the range
    ['1774 Dandenong Road Oakleigh', DANDENONG],
    ['Unit 8/1774 Dandenong Road', DANDENONG],
    ['5 Market Street N Newtown', MARKET],   // the other direction
    ['1774 Dandenong Road 3000', DANDENONG],
  ])('%j does not find another address', (typed, register) => {
    expect(finds(typed, register)).toBe(false);
  });

  it('sends nothing CQL could read as syntax, and leaves a bare number as a plain prefix', () => {
    expect(addressFilterForCql("o'connor%_;)('")).toBe("((road_name LIKE 'OCONNOR%'))");
    expect(addressFilterForCql('1774')).toBe("ezi_address LIKE '1774%'");
    expect(addressFilterForCql('9'.repeat(30) + ' High St')).not.toContain('house_number_1'); // too long to be a house number
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
      .toEqual({ candidates: [], returnedCount: 0 });
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
  it('offers the flagged record when one record in the group is flagged', () => {
    const unflagged = at('6 RIDGE ROAD KALORAMA 3766', KALORAMA);
    const flagged = at('6 RIDGE ROAD KALORAMA 3766', NEARBY, { isPrimary: true });
    expect(resolveAddressCandidates([unflagged, flagged])).toEqual({
      candidates: [flagged.candidate],
      returnedCount: 2,
    });
  });

  it('offers the first record when none is flagged, so the address can still build a pack', () => {
    const first = at('6 RIDGE ROAD KALORAMA 3766', KALORAMA);
    expect(resolveAddressCandidates([first, at('6 RIDGE ROAD KALORAMA 3766', NEARBY)]))
      .toEqual({ candidates: [first.candidate], returnedCount: 2 });
  });

  it('offers the first flagged record when more than one is flagged', () => {
    const first = at('6 RIDGE ROAD KALORAMA 3766', KALORAMA, { isPrimary: true });
    expect(resolveAddressCandidates([first, at('6 RIDGE ROAD KALORAMA 3766', NEARBY, { isPrimary: true })]))
      .toEqual({ candidates: [first.candidate], returnedCount: 2 });
  });

  it('keeps every address once, in service order', () => {
    expect(addresses(resolveAddressCandidates([
      at('4 RIDGE ROAD KALORAMA 3766', KALORAMA),
      at('6 RIDGE ROAD KALORAMA 3766', KALORAMA),
      at('6 RIDGE ROAD KALORAMA 3766', NEARBY),
      at('8 RIDGE ROAD KALORAMA 3766', NEARBY),
    ]))).toEqual([
      '4 RIDGE ROAD KALORAMA 3766',
      '6 RIDGE ROAD KALORAMA 3766',
      '8 RIDGE ROAD KALORAMA 3766',
    ]);
  });

  it('ignores an inactive record when choosing the point', () => {
    const active = at('6 RIDGE ROAD KALORAMA 3766', KALORAMA);
    expect(resolveAddressCandidates([
      at('6 RIDGE ROAD KALORAMA 3766', NEARBY, { propertyStatus: 'R', isPrimary: true }),
      active,
    ])).toEqual({ candidates: [active.candidate], returnedCount: 2 });
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
    expect(completedSearchState({ candidates: [candidate], returnedCount: 1 }))
      .toEqual({ kind: 'candidates', candidates: [candidate], returnedCount: 1 });
  });

  it('maps an empty successful response to no-match, not failure', () => {
    expect(completedSearchState({ candidates: [], returnedCount: 0 }))
      .toEqual({ kind: 'no-match' });
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

  // Character for character, with no dash of any kind: the em dash is gone,
  // and a hyphen in its place would be a different sentence.
  it('uses the baseline R2 no-match literal exactly, with no dash of any kind', () => {
    expect(copy.NO_ADDRESS_MATCH).toBe(
      'No matching address found. Check the spelling or try the nearest cross street.',
    );
    expect(copy.NO_ADDRESS_MATCH).not.toContain('\u2014');
    expect(copy.NO_ADDRESS_MATCH).not.toContain('-');
  });

  it('keeps both search-failure sentences exact', () => {
    expect(copy.SEARCH_COULD_NOT_RUN).toBe('We could not search for this address right now.');
    expect(copy.SEARCH_FAILURE_MEANING).toBe(
      'This is not the same as saying the address is not there. Try again when you have a connection.',
    );
  });

  it('offers a way forward when none of the listed addresses fits', () => {
    expect(copy.REFINE_ADDRESS_HINT).toBe(
      'Check or add a unit or street number, then search again.',
    );
  });
});

// ── E1-US1-AC2 live search while typing ─────────────────────────────────────
// The three states the live search must never conflate are tested one at a
// time: still typing, answered with nothing, and could not run.

const resolution = (candidates: AddressCandidate[], returnedCount = candidates.length) =>
  ({ candidates, returnedCount });

const answered = (query: string, candidates: AddressCandidate[], returnedCount?: number): SettledSearch =>
  ({ query, outcome: { kind: 'resolved', resolution: resolution(candidates, returnedCount) } });

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
      kind: 'candidates', candidates: [candidate], returnedCount: 4,
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