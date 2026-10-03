import { describe, expect, it } from 'vitest';
import { MS_PER_DAY, PACK_RADIUS_KM } from '../../src/core/constants';
import { OFFICIAL_INSTRUCTIONS_FIRST, SAVED_DAYS_AGO } from '../../src/core/copy';
import { buildPackSeed, diffPacks, packAgeLabel } from '../../src/core/pack';
import { pack, source } from '../fixtures';

const NOW = 1_800_000_000_000;
const daysAgo = (n: number) => NOW - n * MS_PER_DAY;

describe('packAgeLabel', () => {
  it('states only the age, however old the pack is', () => {
    expect(packAgeLabel(NOW, daysAgo(29))).toBe(SAVED_DAYS_AGO(29));
    expect(packAgeLabel(NOW, daysAgo(96))).toBe('Saved 96 days ago');
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