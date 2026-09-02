import { describe, expect, it } from 'vitest';
import * as copy from '../../src/core/copy';
import {
  ageLabel,
  hasNearbyData,
  nearbyView,
  nearestOfType,
  parsePostcode,
  postcodeOrigin,
  type NearbyCache,
  type NearbyView,
} from '../../src/core/nearby';
import type { BundleFacility, SnapshotActivation } from '../../src/core/types';
import { KALORAMA } from '../fixtures';

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 8, 2, 6); // 4:00 pm in Melbourne
const ago = (ms: number): string => new Date(NOW - ms).toISOString();

const facility = (over: Partial<BundleFacility> = {}): BundleFacility => ({
  facility_id: 1,
  type: 'NSP',
  name: 'Kalorama Memorial Reserve',
  address: 'Ridge Road, Kalorama',
  lat: -37.808,
  lon: 145.36,
  lga_name: 'Yarra Ranges',
  designation_status: 'designated',
  last_verified_at: ago(2 * 24 * HOUR),
  ...over,
});
const activation = (over: Partial<SnapshotActivation> = {}): SnapshotActivation => ({
  activation_id: 1,
  type: 'RELIEF',
  name: 'Lilydale Community Centre',
  address: null,
  lat: -37.756,
  lon: 145.35,
  source_updated_at: ago(10 * 60_000),
  ...over,
});
const healthy = (msAgo: number) => ({ status: 'healthy', last_success_at: ago(msAgo) });

const cache = (over: Partial<NearbyCache> = {}, feedAgeMs = 10 * 60_000): NearbyCache => ({
  facilities: [facility(), facility({ facility_id: 2, type: 'CFR', name: 'Ferny Creek Community Fire Refuge', lat: -37.883, lon: 145.333 })],
  postcodes: [{ postcode: '3766', centroid_lat: KALORAMA.lat, centroid_lon: KALORAMA.lon }],
  activations: [activation()],
  meta: {
    static_synced_at: ago(2 * HOUR),
    static_version: '2026-09-01T02:00:00.000Z',
    data_health: JSON.stringify({ cfa_nsp_arcgis: healthy(24 * HOUR), cfr_static_list: healthy(24 * HOUR), other: healthy(HOUR) }),
    dynamic_synced_at: ago(feedAgeMs),
    dynamic_generated_at: ago(feedAgeMs),
    dynamic_source_status: 'healthy',
    dynamic_source_last_success_at: ago(feedAgeMs),
  },
  ...over,
});

const OFFLINE = { staticSyncedNow: false, dynamicSyncedNow: false };
const ONLINE = { staticSyncedNow: true, dynamicSyncedNow: true };
const rows = (view: NearbyView) => view.groups.flatMap((group) => group.rows);
const row = (view: NearbyView, type: string) => rows(view).find((r) => r.type === type)!;

describe('the cache helpers', () => {
  it('knows whether anything was ever downloaded', () => {
    expect(hasNearbyData(cache({ meta: {} }))).toBe(false);
    expect(hasNearbyData(cache({ meta: { dynamic_synced_at: ago(0) } }))).toBe(true);
    expect(hasNearbyData(cache())).toBe(true);
  });

  it('accepts only a four-digit postcode and resolves it against the downloaded list', () => {
    expect(parsePostcode(' 3766 ')).toBe('3766');
    expect(parsePostcode('376')).toBeNull();
    expect(parsePostcode('abcd')).toBeNull();
    expect(postcodeOrigin(cache(), '3766')).toEqual(KALORAMA);
    expect(postcodeOrigin(cache(), '3000')).toBeNull();
  });

  it('scans for the nearest row of one type only', () => {
    const near = nearestOfType(cache().facilities, KALORAMA, 'NSP');
    expect(near?.row.name).toBe('Kalorama Memorial Reserve');
    expect(near?.distanceM).toBeLessThan(1000);
    expect(nearestOfType(cache().facilities, KALORAMA, 'ERC')).toBeNull();
  });

  it('labels an age in the coarsest honest unit', () => {
    expect(ageLabel(30_000)).toBe(copy.JUST_NOW);
    expect(ageLabel(-5)).toBe(copy.JUST_NOW);
    expect(ageLabel(10 * 60_000)).toBe(copy.MINUTES_AGO(10));
    expect(ageLabel(2 * HOUR)).toBe(copy.HOURS_AGO(2));
    expect(ageLabel(3 * 24 * HOUR)).toBe(copy.ITEM_DAYS_AGO(3));
  });
});

describe('nearbyView', () => {
  it('always lists all six types, in two groups', () => {
    const view = nearbyView(NOW, KALORAMA, cache(), OFFLINE);
    expect(view.groups.map((g) => g.heading)).toEqual([copy.GROUP_BUSHFIRE, copy.GROUP_RELIEF]);
    expect(rows(view).map((r) => r.type)).toEqual(['NSP', 'CFR', 'ERC', 'RELIEF', 'RECOVERY', 'ASSEMBLY']);
  });

  it('AC4: offline, static rows come from the cache labelled cached, with their age and verified date', () => {
    const nsp = row(nearbyView(NOW, KALORAMA, cache(), OFFLINE), 'NSP');
    expect(nsp.state).toBe('cached');
    expect(nsp.stateLabel).toBe(copy.STATE_CACHED(copy.HOURS_AGO(2)));
    expect(nsp.timestamp).toBe(copy.VERIFIED_ON('31 August 2026'));
    expect(nsp.place).toEqual({ name: 'Kalorama Memorial Reserve', address: 'Ridge Road, Kalorama', distance: '580 m' });
    expect(nsp.note).toBeNull();
  });

  it('a fresh dynamic snapshot offline shows the centre as cached and possibly outdated', () => {
    const relief = row(nearbyView(NOW, KALORAMA, cache(), OFFLINE), 'RELIEF');
    expect(relief.state).toBe('cached');
    expect(relief.stateLabel).toBe(copy.STATE_CACHED(copy.MINUTES_AGO(10)));
    expect(relief.place?.name).toBe('Lilydale Community Centre');
    expect(relief.timestamp).toBe(copy.AS_OF('3:50 pm, 2 September'));
    expect(relief.note).toBe(copy.MAY_BE_OUTDATED);
  });

  it('AC5: a snapshot past the threshold shows no place — only the stale line and the hotline', () => {
    const relief = row(nearbyView(NOW, KALORAMA, cache({}, 61 * 60_000), OFFLINE), 'RELIEF');
    expect(relief.place).toBeNull();
    expect(relief.stateLabel).toBe(copy.STATE_CACHED(copy.HOURS_AGO(1)));
    expect(relief.note).toBe(`${copy.TOO_OLD_TO_SHOW} ${copy.VICEMERGENCY_HOTLINE}`);
    expect(relief.note).toContain('1800 226 226');
  });

  it('is not stale at exactly the threshold', () => {
    expect(row(nearbyView(NOW, KALORAMA, cache({}, 60 * 60_000), OFFLINE), 'RELIEF').place).not.toBeNull();
  });

  it('synced this session with healthy sources, rows are live and carry no caution', () => {
    const view = nearbyView(NOW, KALORAMA, cache(), ONLINE);
    expect(row(view, 'NSP').state).toBe('live');
    expect(row(view, 'RELIEF').state).toBe('live');
    expect(row(view, 'RELIEF').stateLabel).toBe(copy.STATE_LIVE);
    expect(row(view, 'RELIEF').note).toBeNull();
  });

  it('a struggling source downgrades its rows even when synced this session', () => {
    const struggling = cache({
      meta: {
        ...cache().meta,
        dynamic_source_status: 'degraded',
        data_health: JSON.stringify({ cfa_nsp_arcgis: { status: 'down', last_success_at: null } }),
      },
    });
    const view = nearbyView(NOW, KALORAMA, struggling, ONLINE);
    expect(row(view, 'RELIEF').state).toBe('cached');
    expect(row(view, 'RELIEF').note).toContain(copy.SOURCE_UNCONFIRMED('VicEmergency feed'));
    expect(row(view, 'RELIEF').note).toContain('1800 226 226');
    expect(row(view, 'NSP').state).toBe('cached');
    expect(row(view, 'NSP').note).toContain(copy.SOURCE_UNCONFIRMED('CFA Neighbourhood Safer Places list'));
    // The CFR source is absent from that health block, so it reads as never read.
    expect(row(view, 'CFR').note).toContain(copy.SOURCE_NOT_READ('Community Fire Refuge list'));
  });

  it('a kind never synced is unavailable, with the hotline', () => {
    const staticOnly = cache({ meta: { static_synced_at: ago(HOUR), data_health: '{}' } });
    const view = nearbyView(NOW, KALORAMA, staticOnly, OFFLINE);
    expect(row(view, 'ERC').state).toBe('unavailable');
    expect(row(view, 'ERC').stateLabel).toBe(copy.STATE_UNAVAILABLE);
    expect(row(view, 'ERC').note).toContain('1800 226 226');
    expect(row(view, 'NSP').state).toBe('cached');
  });

  it('says plainly when a kind has nothing in the list, and when a place needs review', () => {
    const empty = nearbyView(NOW, KALORAMA, cache({ facilities: [], activations: [] }), OFFLINE);
    expect(row(empty, 'CFR').note).toBe(copy.NONE_IN_LIST('Community Fire Refuge'));
    expect(row(empty, 'RELIEF').note).toBe(copy.NONE_LISTED_OPEN('Relief Centre'));
    const review = nearbyView(NOW, KALORAMA, cache({ facilities: [facility({ designation_status: 'needs_review' })] }), OFFLINE);
    expect(row(review, 'NSP').note).toBe(copy.NEEDS_REVIEW_NOTE);
  });

  it('falls back to the snapshot time when the feed never succeeded, and survives a corrupt health value', () => {
    const meta = { ...cache().meta, data_health: '{nope' };
    delete meta.dynamic_source_last_success_at;
    const view = nearbyView(NOW, KALORAMA, cache({ meta }), OFFLINE);
    expect(row(view, 'RELIEF').timestamp).toBe(copy.AS_OF('3:50 pm, 2 September'));
    expect(row(view, 'NSP').note).toContain(copy.SOURCE_NOT_READ('CFA Neighbourhood Safer Places list'));
  });

  it('lists every source with its status and age; the snapshot reading of the feed wins', () => {
    const view = nearbyView(NOW, KALORAMA, cache(), OFFLINE);
    expect(view.health).toContain(copy.HEALTH_LINE('CFA Neighbourhood Safer Places list', 'reachable', copy.ITEM_DAYS_AGO(1)));
    expect(view.health).toContain(copy.HEALTH_LINE('VicEmergency feed', 'reachable', copy.MINUTES_AGO(10)));
    expect(view.health).toContain(copy.HEALTH_LINE('other', 'reachable', copy.HOURS_AGO(1)));
    const never = nearbyView(NOW, KALORAMA, cache({ meta: { static_synced_at: ago(0), data_health: JSON.stringify({ vicemergency_feed: { status: 'unknown', last_success_at: null } }) } }), OFFLINE);
    expect(never.health).toContain(copy.HEALTH_LINE('VicEmergency feed', 'not yet read', copy.NEVER));
  });
});
