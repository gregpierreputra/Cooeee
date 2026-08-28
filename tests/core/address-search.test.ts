import { describe, expect, it } from 'vitest';

import {
  addressQueryCanRun,
  addressQueryForCql,
  completedSearchState,
  visibleAddressCandidates,
} from '../../src/core/address-search';
import * as copy from '../../src/core/copy';
import type { AddressRecord } from '../../src/core/types';

function record(
  address: string,
  over: Partial<AddressRecord> = {},
): AddressRecord {
  return {
    candidate: { address, localityName: 'KALORAMA', lat: -37.81, lon: 145.36 },
    propertyStatus: 'A',
    isPrimary: false,
    ...over,
  };
}

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
    expect(visibleAddressCandidates([
      record('SECOND'),
      record('RETIRED', { propertyStatus: 'R' }),
      record('FIRST'),
    ]).map(({ address }) => address)).toEqual(['SECOND', 'FIRST']);
  });

  it('uses the primary flag only to collapse an exact duplicate in place', () => {
    const secondary = record('SAME', { candidate: {
      address: 'SAME', localityName: 'SECONDARY', lat: -37.81, lon: 145.36,
    } });
    const primary = record('SAME', { isPrimary: true, candidate: {
      address: 'SAME', localityName: 'PRIMARY', lat: -37.81, lon: 145.36,
    } });
    expect(visibleAddressCandidates([secondary, record('NEXT'), primary])).toEqual([
      primary.candidate,
      record('NEXT').candidate,
    ]);
  });

  it('keeps a single candidate as a candidate-list state', () => {
    const candidate = record('ONLY').candidate;
    expect(completedSearchState([candidate])).toEqual({
      kind: 'candidates', candidates: [candidate],
    });
  });

  it('maps an empty successful response to no-match, not failure', () => {
    expect(completedSearchState([])).toEqual({ kind: 'no-match' });
  });
});

describe('E1-US1-AC2–AC4 copy', () => {
  it('keeps candidate choice wording exact', () => {
    expect(copy.CHOOSE_ADDRESS).toBe('Choose your address from the list.');
    expect(copy.NONE_OF_THESE).toBe('None of these is my address');
  });

  it('uses the baseline R2 no-match literal exactly', () => {
    expect(copy.NO_ADDRESS_MATCH).toBe(
      'No matching address found - check the spelling or try the nearest cross street.',
    );
  });

  it('keeps both search-failure sentences exact', () => {
    expect(copy.SEARCH_COULD_NOT_RUN).toBe('We could not search for this address right now.');
    expect(copy.SEARCH_FAILURE_MEANING).toBe(
      'This is not the same as saying the address is not there. Try again when you have a connection.',
    );
  });
});
