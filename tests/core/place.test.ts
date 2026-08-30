import { describe, expect, it } from 'vitest';

import * as copy from '../../src/core/copy';
import { makePendingPlace } from '../../src/core/place';
import type { AddressCandidate } from '../../src/core/types';

const candidate: AddressCandidate = {
  address: '6 RIDGE ROAD KALORAMA 3766',
  localityName: 'KALORAMA',
  lat: -37.817939,
  lon: 145.36594,
};

describe('makePendingPlace', () => {
  it('preserves the returned address character for character', () => {
    expect(makePendingPlace(candidate, candidate.localityName).address).toBe(candidate.address);
  });

  it.each(['  Home base  ', '', '   '])('preserves the edited name %j', (name) => {
    expect(makePendingPlace(candidate, name).name).toBe(name);
  });

  it('copies longitude and latitude without transposing them', () => {
    expect(makePendingPlace(candidate, candidate.localityName)).toEqual({
      name: 'KALORAMA',
      address: '6 RIDGE ROAD KALORAMA 3766',
      lat: -37.817939,
      lon: 145.36594,
    });
  });

  it('does not mutate the candidate', () => {
    const original = structuredClone(candidate);
    makePendingPlace(candidate, 'Elsewhere');
    expect(candidate).toEqual(original);
  });
});

describe('E1-US1-AC1 copy', () => {
  it('keeps the mandated confirmation literals exact', () => {
    expect(copy.CONFIRM_ADDRESS_QUESTION).toBe('Is this the place you want to save?');
    expect(copy.PLACE_NAME_LABEL).toBe('Place name');
    expect(copy.SAVE_THIS_PLACE).toBe('Save this place');
    expect(copy.SEARCH_AGAIN).toBe('Search again');
  });
});
