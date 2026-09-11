import { describe, expect, it } from 'vitest';

import { RECOVERY_STALE_DAYS, MS_PER_DAY } from '../../src/core/constants';
import { matchPrograms, NEEDS, recoveryPack, recoveryStale } from '../../src/core/recover';
import { pack, program } from '../fixtures';

const withRecovery = (count: number, createdAt: number, id: string) =>
  pack({ id, createdAt, manifest: { ...pack().manifest, groups: { ...pack().manifest.groups, recovery: { count, sha256: 'x' } } } });

describe('recoveryPack', () => {
  it('is the newest complete pack that carries recovery references, or null', () => {
    const old = withRecovery(2, 1, 'old');
    const newest = withRecovery(2, 3, 'newest');
    const none = withRecovery(0, 9, 'none');
    expect(recoveryPack([old, none, newest])).toBe(newest);
    expect(recoveryPack([none])).toBeNull();
    expect(recoveryPack([])).toBeNull();
  });
});

describe('matchPrograms', () => {
  const b = program({ id: 'b', org: 'Services Australia', title: 'Zed payment', needs: ['money'] });
  const a = program({ id: 'a', org: 'Services Australia', title: 'Alpha payment', needs: ['money', 'stay'] });
  const c = program({ id: 'c', org: 'Australian Red Cross', title: 'Coping', needs: ['health'] });

  it('returns only the programs tagged with the need, by organisation then title', () => {
    expect(matchPrograms([b, c, a], 'money').map((p) => p.id)).toEqual(['a', 'b']);
    expect(matchPrograms([b, c, a], 'health').map((p) => p.id)).toEqual(['c']);
    expect(matchPrograms([b, c, a], 'documents')).toEqual([]);
  });

  it('offers every need exactly once', () => {
    expect([...NEEDS].sort()).toEqual(['documents', 'food', 'health', 'money', 'property', 'stay']);
  });
});

describe('recoveryStale', () => {
  const snapshot = Date.UTC(2026, 8, 11);
  it('turns over the day after the threshold', () => {
    expect(recoveryStale(snapshot + RECOVERY_STALE_DAYS * MS_PER_DAY, '2026-09-11')).toBe(false);
    expect(recoveryStale(snapshot + (RECOVERY_STALE_DAYS + 1) * MS_PER_DAY, '2026-09-11')).toBe(true);
  });
});
