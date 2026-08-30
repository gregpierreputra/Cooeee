import { describe, expect, it } from 'vitest';
import { MS_PER_DAY, PACK_REFRESH_DAYS } from '../../src/core/constants';
import { NOT_RECENTLY_VERIFIED, SAVED_DAYS_AGO } from '../../src/core/copy';
import { ageDays, diffPacks, freshness, layerStatus, textBytes } from '../../src/core/pack';
import { pack } from '../fixtures';

const NOW = 1_800_000_000_000;
const daysAgo = (n: number) => NOW - n * MS_PER_DAY;

describe('ageDays', () => {
  it('counts whole days since verifiedAt', () => {
    expect(ageDays(NOW, daysAgo(0))).toBe(0);
    expect(ageDays(NOW, daysAgo(96))).toBe(96);
  });

  it('does not round a part-day up', () => {
    expect(ageDays(NOW, daysAgo(1) + 1)).toBe(0);
  });
});

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

describe('textBytes', () => {
  it('counts encoded bytes, not characters', () => {
    expect(textBytes('ab')).toBe(4); // JSON.stringify adds the two quotes
    expect(textBytes([])).toBe(2);
  });

  it('counts a multi-byte character as more than one byte', () => {
    expect(textBytes('—')).toBeGreaterThan(textBytes('-'));
  });
});

describe('layerStatus', () => {
  it('is present when the layer covers the point', () => {
    expect(layerStatus(1, 'published')).toBe('present');
    expect(layerStatus(3, 'unknown')).toBe('present');
  });

  it('distinguishes "published here but not at this address" from "not published at all"', () => {
    expect(layerStatus(0, 'published')).toBe('none-mapped-here');
    expect(layerStatus(0, 'unpublished')).toBe('not-published');
    expect(layerStatus(0, 'unknown')).toBe('unknown');
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
