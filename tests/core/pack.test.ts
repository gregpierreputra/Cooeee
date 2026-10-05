import { describe, expect, it } from 'vitest';
import { MS_PER_DAY, PACK_RADIUS_KM } from '../../src/core/constants';
import { OFFICIAL_INSTRUCTIONS_FIRST, SAVED_DAYS_AGO } from '../../src/core/copy';
import { buildPackSeed, defaultPackName, diffPacks, packAgeLabel, packIcon, samePackName, streetPart } from '../../src/core/pack';
import { pack, source } from '../fixtures';

const NOW = 1_800_000_000_000;
const daysAgo = (n: number) => NOW - n * MS_PER_DAY;

describe('packAgeLabel', () => {
  it('states only the age, however old the pack is', () => {
    expect(packAgeLabel(NOW, daysAgo(29))).toBe(SAVED_DAYS_AGO(29));
    expect(packAgeLabel(NOW, daysAgo(96))).toBe('Saved 96 days ago');
  });
});

describe('samePackName', () => {
  it('ignores capitals and spaces at either end, and nothing else', () => {
    expect(samePackName('Home', ' home ')).toBe(true);
    expect(samePackName('Home', 'Home 2')).toBe(false);
    expect(samePackName('Mum and Dad', 'Mum & Dad')).toBe(false);
  });
});

describe('packIcon', () => {
  it('is the pack’s own drawing, or the pin when it has none or an unknown one', () => {
    expect(packIcon({ icon: 'family' })).toBe('family');
    expect(packIcon({})).toBe('place');
    expect(packIcon({ icon: '<img>' as never })).toBe('place');
  });

  it('is carried into a new pack only when it is a pack drawing', () => {
    const place = { name: 'Home', address: 'A', lat: 0, lon: 0 };
    expect(buildPackSeed('p', 1, { ...place, icon: 'home' }, 'L', source()).icon).toBe('home');
    expect(buildPackSeed('p', 1, { ...place, icon: 'x' as never }, 'L', source())).not.toHaveProperty('icon');
  });
});

describe('defaultPackName', () => {
  const candidate = { address: '8 RIDGE ROAD KALORAMA 3766', localityName: 'KALORAMA' };

  it('is the suburb while no other pack has its name', () => {
    expect(defaultPackName(candidate, ['Work'])).toBe('KALORAMA');
  });

  it('is the street when another pack has the suburb name, whatever its capitals', () => {
    expect(defaultPackName(candidate, ['Kalorama'])).toBe('8 RIDGE ROAD');
  });

  it('keeps a unit in the street, and keeps an address that does not end in suburb and postcode whole', () => {
    expect(streetPart('UNIT 2 8 RIDGE ROAD KALORAMA 3766', 'KALORAMA')).toBe('UNIT 2 8 RIDGE ROAD');
    expect(streetPart('8 RIDGE ROAD KALORAMA', 'KALORAMA')).toBe('8 RIDGE ROAD KALORAMA');
    expect(streetPart('KALORAMA 3766', 'KALORAMA')).toBe('KALORAMA 3766');
  });
});

describe('buildPackSeed', () => {
  const place = { name: 'Kalorama', address: '6 RIDGE ROAD KALORAMA 3766', lat: -37.82, lon: 145.37 };

  it('builds a fresh seed with no supersedes when nothing is being replaced', () => {
    const seed = buildPackSeed('pack-1', 1_000, place, 'YARRA RANGES', source(), undefined);
    expect(seed).toEqual({
      id: 'pack-1',
      name: 'Kalorama',
      address: '6 RIDGE ROAD KALORAMA 3766',
      lat: -37.82,
      lon: 145.37,
      radiusKm: PACK_RADIUS_KM,
      lgaName: 'YARRA RANGES',
      createdAt: 1_000,
      reminder: OFFICIAL_INSTRUCTIONS_FIRST,
      sources: [source()],
    });
    expect(seed).not.toHaveProperty('supersedes');
  });

  it('carries the exact prior pack id as supersedes on a replace', () => {
    const seed = buildPackSeed('pack-2', 1_000, place, 'YARRA RANGES', source(), 'old-pack-id');
    expect(seed.supersedes).toBe('old-pack-id');
  });
});

describe('diffPacks', () => {
  it('reports nothing when the user-visible fields are unchanged', () => {
    expect(diffPacks(pack(), pack({ id: 'pack-2', verifiedAt: NOW }))).toEqual([]);
  });

  it('reports each changed field with its old and new value', () => {
    const changes = diffPacks(pack(), pack({ name: 'Mum’s', reminder: 'Different.' }));
    expect(changes).toHaveLength(2);
    expect(changes).toContainEqual({ field: 'name', from: 'Kalorama', to: 'Mum’s' });
  });

  it('ignores machinery the user never sees', () => {
    expect(diffPacks(pack(), pack({ createdAt: 1, verifiedAt: 2, supersedes: 'pack-0' }))).toEqual(
      [],
    );
  });
});