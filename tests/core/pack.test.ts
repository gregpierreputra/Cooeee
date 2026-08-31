import { describe, expect, it } from 'vitest';
import { MS_PER_DAY, PACK_RADIUS_KM, PACK_REFRESH_DAYS } from '../../src/core/constants';
import { NOT_RECENTLY_VERIFIED, OFFICIAL_INSTRUCTIONS_FIRST, SAVED_DAYS_AGO } from '../../src/core/copy';
import { buildPackSeed, diffPacks, freshness } from '../../src/core/pack';
import { pack, source } from '../fixtures';

const NOW = 1_800_000_000_000;
const daysAgo = (n: number) => NOW - n * MS_PER_DAY;

describe('freshness', () => {
  it('is not stale at 29 days', () => {
    expect(freshness(NOW, daysAgo(29))).toEqual({ stale: false, label: SAVED_DAYS_AGO(29) });
  });

  it('is not stale at exactly 30 days — the window is inclusive', () => {
    expect(PACK_REFRESH_DAYS).toBe(30);
    expect(freshness(NOW, daysAgo(30)).stale).toBe(false);
  });

  it('is stale at 31 days, and says so in words', () => {
    expect(freshness(NOW, daysAgo(31))).toEqual({
      stale: true,
      label: NOT_RECENTLY_VERIFIED(31),
    });
    expect(freshness(NOW, daysAgo(31)).label).toBe('Saved 31 days ago — not recently verified');
  });

  it('labels a long-stale pack without ever suggesting it has expired', () => {
    expect(freshness(NOW, daysAgo(96)).label).toBe('Saved 96 days ago — not recently verified');
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