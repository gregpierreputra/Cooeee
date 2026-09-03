import { describe, expect, it } from 'vitest';
import { MAX_SYNC_ROWS } from '../../src/core/constants';
import { assertStaticBundle } from '../../src/data/nearby';

const facility = (facility_id: number) => ({
  facility_id, type: 'NSP', name: 'Olinda Recreation Reserve', address: null,
  lat: -37.848, lon: 145.363, lga_name: null, designation_status: 'designated', last_verified_at: '2026-09-02',
});
const bundle = (facilities: unknown[]) => ({
  version: '2026-09-02', generated_at: '2026-09-02T00:00:00Z', facilities, postcodes: [], data_health: {},
});

describe('assertStaticBundle', () => {
  it('accepts a bundle of the expected size and refuses one past the row cap', () => {
    expect(assertStaticBundle(bundle([facility(1), facility(2)])).facilities).toHaveLength(2);
    const oversized = Array.from({ length: MAX_SYNC_ROWS + 1 }, (_, i) => facility(i));
    expect(() => assertStaticBundle(bundle(oversized))).toThrow(/facilities has more than/);
  });
});
