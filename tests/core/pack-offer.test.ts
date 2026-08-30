import { describe, expect, it } from 'vitest';

import {
  canonicalJson,
  exactTextBytes,
  formatPackBytes,
  offerMatchesStoredSize,
  packOfferSizeLine,
} from '../../src/core/pack-offer';
import type { PackOffer, PackSeed, TextPackContent } from '../../src/core/types';
import { destination, pack, program } from '../fixtures';

function seed(): PackSeed {
  const complete = pack();
  const { status, verifiedAt, builtWithTiles, sizeBytes, manifest, ...value } = complete;
  void status;
  void verifiedAt;
  void builtWithTiles;
  void sizeBytes;
  void manifest;
  return value;
}

const content: TextPackContent = {
  pack: seed(),
  layers: [],
  destinations: [destination()],
  recovery: [program()],
};

const offer: PackOffer = {
  version: 1,
  textBytes: 421_888,
  tileBytes: 13_002_342,
  tileCount: 120,
  tilesAvailable: true,
  omittedItems: [],
  textManifest: {
    layers: { count: 0, sha256: 'a' },
    destinations: { count: 1, sha256: 'b' },
    recovery: { count: 1, sha256: 'c' },
  },
};

describe('E1-US1-AC9 canonical byte accounting', () => {
  it('sorts object keys recursively while preserving array order', () => {
    expect(canonicalJson({ z: [{ b: 2, a: 1 }], a: true, skip: undefined, n: null }))
      .toBe('{"a":true,"n":null,"z":[{"a":1,"b":2}]}');
  });

  it('counts the exact UTF-8 bytes of the canonical content', () => {
    expect(exactTextBytes(content)).toBe(
      new TextEncoder().encode(canonicalJson(content)).length,
    );
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('rejects non-finite number %s', (value) => {
    expect(() => canonicalJson({ value })).toThrow('non-finite');
  });

  it('rejects unsupported values instead of silently dropping them', () => {
    expect(() => canonicalJson(() => undefined)).toThrow('unsupported');
  });
});

describe('E1-US1-AC9 size display and verification', () => {
  it.each([
    [0, '0 KB'],
    [1, '1 KB'],
    [421_888, '412 KB'],
    [1_048_576, '1.0 MB'],
    [13_002_342, '12.4 MB'],
  ])('formats %i bytes as %s', (bytes, expected) => {
    expect(formatPackBytes(bytes)).toBe(expected);
  });

  it.each([-1, 1.5])('rejects invalid byte count %s', (bytes) => {
    expect(() => formatPackBytes(bytes)).toThrow(RangeError);
  });

  it('builds the mandated split size line', () => {
    expect(packOfferSizeLine(offer)).toBe(
      'Text 412 KB · Map tiles 12.4 MB for about 10 km around this place',
    );
  });

  it('requires exact text and selected tile bytes', () => {
    expect(offerMatchesStoredSize(offer, { text: 421_888, tiles: 13_002_342 }, true)).toBe(true);
    expect(offerMatchesStoredSize(offer, { text: 421_888, tiles: 0 }, false)).toBe(true);
    expect(offerMatchesStoredSize(offer, { text: 421_887, tiles: 0 }, false)).toBe(false);
    expect(offerMatchesStoredSize(offer, { text: 421_888, tiles: 1 }, false)).toBe(false);
  });
});
