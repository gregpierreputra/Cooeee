import { describe, expect, it } from 'vitest';

import { RECOVERY_STALE_DAYS, MS_PER_DAY } from '../../src/core/constants';
import * as copy from '../../src/core/copy';
import { monogram, NEEDS, recoveryPack, recoveryStale, selectPrograms, shareText } from '../../src/core/recover';
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

describe('selectPrograms', () => {
  const b = program({ id: 'b', org: 'Services Australia', title: 'Zed payment', needs: ['money'] });
  const a = program({ id: 'a', org: 'Services Australia', title: 'Alpha payment', needs: ['money', 'stay'] });
  const c = program({ id: 'c', org: 'Australian Red Cross', title: 'Coping', needs: ['health'] });
  const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

  it('returns only the programs tagged with the need, by organisation then title', () => {
    expect(ids(selectPrograms([b, c, a], 'money', []))).toEqual(['a', 'b']);
    expect(ids(selectPrograms([b, c, a], 'health', []))).toEqual(['c']);
    expect(selectPrograms([b, c, a], 'documents', [])).toEqual([]);
  });

  it('lists every program, or only the kept ones, with kept programs first', () => {
    expect(ids(selectPrograms([b, c, a], 'all', []))).toEqual(['c', 'a', 'b']);
    expect(ids(selectPrograms([b, c, a], 'all', ['b']))).toEqual(['b', 'c', 'a']);
    expect(ids(selectPrograms([b, c, a], 'kept', ['b', 'missing']))).toEqual(['b']);
  });

  it('offers every need exactly once', () => {
    expect([...NEEDS].sort()).toEqual(['documents', 'food', 'health', 'money', 'property', 'stay']);
  });
});

describe('shareText', () => {
  it('carries the caveat, and the publisher and saved date of every program, and nothing about the person', () => {
    const text = shareText('Money for essentials', [program({ telephone: '180 22 66' }), program({ id: 'p2', title: 'Second' })]);
    expect(text.startsWith(`Money for essentials\n${copy.RECOVER_MAY_MATCH}`)).toBe(true);
    expect(text.match(/Published by Services Australia · Saved /g)).toHaveLength(2);
    expect(text).toContain('Call 180 22 66');
    expect(text).toContain('https://www.servicesaustralia.gov.au/example');
    expect(text.endsWith(copy.SHARED_FROM)).toBe(true);
  });
});

describe('monogram', () => {
  it('is up to three initials, in capitals', () => {
    expect(monogram('Services Australia')).toBe('SA');
    expect(monogram('Country Fire Authority')).toBe('CFA');
    expect(monogram('National Emergency Management Agency')).toBe('NEM');
  });
});

describe('recoveryStale', () => {
  const snapshot = Date.UTC(2026, 8, 11);
  it('turns over the day after the threshold', () => {
    expect(recoveryStale(snapshot + RECOVERY_STALE_DAYS * MS_PER_DAY, '2026-09-11')).toBe(false);
    expect(recoveryStale(snapshot + (RECOVERY_STALE_DAYS + 1) * MS_PER_DAY, '2026-09-11')).toBe(true);
  });
});
