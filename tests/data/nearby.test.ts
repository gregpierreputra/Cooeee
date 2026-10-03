import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { MAX_SYNC_ROWS } from '../../src/core/constants';
import { db } from '../../src/data/db';
import { assertStaticBundle, DYNAMIC_SNAPSHOT_PATH, readNearbyCache, syncNearby } from '../../src/data/nearby';

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

  it('skips a place of a type it does not show and keeps the postcode list', () => {
    const postcodes = [{ postcode: '3149', centroid_lat: -37.878, centroid_lon: 145.128 }];
    const parsed = assertStaticBundle({ ...bundle([facility(1), { ...facility(2), type: 'COOL' }]), postcodes });
    expect(parsed.facilities.map((row) => row.facility_id)).toEqual([1]);
    expect(parsed.postcodes.map((row) => row.postcode)).toEqual(['3149']);
  });

  it('refuses a date it could not later read, so the cache never holds one', () => {
    expect(() => assertStaticBundle(bundle([{ ...facility(1), last_verified_at: 'last Tuesday' }])))
      .toThrow(/last_verified_at must be a date/);
    expect(() => assertStaticBundle({ ...bundle([]), generated_at: 'soon' })).toThrow(/generated_at must be a date/);
    const health = (last_success_at: unknown) => ({ ...bundle([]), data_health: { feed: { status: 'healthy', last_success_at } } });
    expect(() => assertStaticBundle(health('n/a'))).toThrow(/last_success_at must be a date/);
    expect(assertStaticBundle(health(null)).data_health.feed.last_success_at).toBeNull();
  });
});

// Spec §7.4: the two endpoints sync independently, so a failing feed never
// takes the stored list of places with it.
describe('syncNearby', () => {
  const snapshot = { generated_at: '2026-09-02T00:00:00Z', source_status: 'healthy', source_last_success_at: null, activations: [] };
  const serve = (dynamicOk: boolean): typeof fetch => async (input) =>
    String(input).startsWith(DYNAMIC_SNAPSHOT_PATH)
      ? dynamicOk ? Response.json(snapshot) : new Response('down', { status: 503 })
      : Response.json(bundle([facility(1), facility(2)]));

  it('stores both, then keeps the stored places when only the feed fails', async () => {
    await db.delete();
    await db.open();
    expect(await syncNearby(serve(true))).toEqual({ staticSyncedNow: true, dynamicSyncedNow: true });
    expect((await readNearbyCache()).facilities).toHaveLength(2);

    expect(await syncNearby(serve(false))).toEqual({ staticSyncedNow: true, dynamicSyncedNow: false });
    const cache = await readNearbyCache();
    expect(cache.facilities).toHaveLength(2);
    expect(cache.meta.dynamic_source_status).toBe('healthy'); // the last good snapshot stands
  });
});
