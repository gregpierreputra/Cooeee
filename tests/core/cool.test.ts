import { describe, expect, it } from 'vitest';
import { COOL_DATASET_URL } from '../../src/core/constants';
import { coolSource, selectCoolForPack, toCoolDestination } from '../../src/core/cool';
import type { BundleFacility } from '../../src/core/types';
import { KALORAMA } from '../fixtures';

const km = (n: number) => ({ lat: KALORAMA.lat + n / 111.195, lon: KALORAMA.lon });
const cool = (n: number, over: Partial<BundleFacility> = {}): BundleFacility => ({
  facility_id: n,
  type: 'COOL',
  name: `Library ${n}`,
  address: null,
  ...km(n),
  lga_name: null,
  designation_status: 'designated',
  last_verified_at: '2026-09-09T00:00:00.000Z',
  ...over,
});

describe('selectCoolForPack', () => {
  it('takes the nearest count, and leaves out a row the list no longer confirms', () => {
    const rows = [cool(5), cool(1, { designation_status: 'needs_review' }), cool(3), cool(2)];
    expect(selectCoolForPack(rows, KALORAMA, 2).map((r) => r.facility_id)).toEqual([2, 3]);
  });
});

describe('toCoolDestination', () => {
  it('is a cool-heat row under the pack, with the dataset page as its source', () => {
    const source = coolSource(1_700_000_000_000);
    const row = toCoolDestination(cool(1, { address: 'Main Street' }), 'pack-1', source);
    expect(row).toMatchObject({ id: 'pack-1:1', packId: 'pack-1', kind: 'cool-heat', name: 'Library 1', addressText: 'Main Street' });
    expect(row.source).toEqual({ publisher: 'Department of Transport and Planning', url: COOL_DATASET_URL, licence: 'CC BY 4.0', retrievedAt: 1_700_000_000_000 });
    expect(toCoolDestination(cool(1), 'pack-1', source)).not.toHaveProperty('addressText');
  });
});
