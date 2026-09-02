import { describe, expect, it } from 'vitest';
import { route } from '../../server/api';
import { type Db, openDb } from '../../server/db';
import { upsertPostcodes } from '../../server/ingest/postcodes';
import { rebuildNearestStatic, upsertFacilities } from '../../server/ingest/static';
import { applyFeed, classify } from '../../server/ingest/vicemergency';
import { recordFailure, runSync } from '../../server/sources';

type Result = { type: string; facility: { name: string } | null; distance_km: number | null; message: string | null };
type Body = { results: Result[]; data_health: Record<string, { status: string }> };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const get = (db: Db, path: string): { status: number; body: any } =>
  route(db, 'GET', new URL(path, 'http://localhost'));
const result = (body: Body, type: string): Result => body.results.find((r) => r.type === type)!;

const CBD = { postcode: '3000', lat: -37.8134, lon: 144.9632 };
const OLINDA = { externalRef: '1', typeCode: 'NSP' as const, name: 'Olinda Recreation Reserve', address: null, lat: -37.848, lon: 145.363, lgaName: null };
const relief = (id: string, name: string) => ({
  geometry: { type: 'Point', coordinates: [145.35, -37.756] },
  properties: { id, sourceId: id, feedType: 'incident', category1: 'Relief Centre', name, location: 'Lilydale', updated: '2026-09-02T04:12:00+10:00' },
});

function seeded(): Db {
  const db = openDb(':memory:');
  upsertPostcodes(db, [CBD]);
  return db;
}

describe('GET /api/v1/safe-locations', () => {
  it('AC1: with nothing loaded, postcode 3000 answers every type with facility null and a reason', () => {
    const db = seeded();
    rebuildNearestStatic(db);
    const { status, body } = get(db, '/api/v1/safe-locations?postcode=3000');
    expect(status).toBe(200);
    expect(body.results.map((r: Result) => r.type).sort()).toEqual(['ASSEMBLY', 'CFR', 'ERC', 'NSP', 'RECOVERY', 'RELIEF']);
    for (const r of body.results as Result[]) {
      expect(r.facility).toBeNull();
      expect(r.message).toEqual(expect.any(String));
    }
    expect(body.data_health.vicemergency_feed.status).toBe('unknown');
  });

  it('reports the nearest static facility with its distance, by postcode and by point', () => {
    const db = seeded();
    upsertFacilities(db, 'cfa_nsp_arcgis', [OLINDA]);
    rebuildNearestStatic(db);
    for (const query of ['postcode=3000', `lat=${CBD.lat}&lon=${CBD.lon}`]) {
      const nsp = result(get(db, `/api/v1/safe-locations?${query}`).body, 'NSP');
      expect(nsp.facility?.name).toBe('Olinda Recreation Reserve');
      expect(nsp.distance_km).toBeCloseTo(35.4, 0);
      expect(nsp.message).toBeNull();
    }
  });

  it('refuses a malformed or unknown query', () => {
    const db = seeded();
    expect(get(db, '/api/v1/safe-locations?postcode=30').status).toBe(400);
    expect(get(db, '/api/v1/safe-locations?lat=91&lon=0').status).toBe(400);
    expect(get(db, '/api/v1/safe-locations').status).toBe(400);
    expect(get(db, '/api/v1/safe-locations?postcode=9999').status).toBe(404);
    expect(route(db, 'POST', new URL('http://localhost/api/v1/health')).status).toBe(405);
  });

  it('AC2: ten consecutive feed failures mark the source down, in data_health and in the dynamic message', () => {
    const db = seeded();
    for (let i = 0; i < 3; i += 1) recordFailure(db, 'vicemergency_feed', 'timeout');
    expect(get(db, '/api/v1/health').body.sources.find((s: { source_id: string }) => s.source_id === 'vicemergency_feed').status).toBe('degraded');
    for (let i = 0; i < 7; i += 1) recordFailure(db, 'vicemergency_feed', 'timeout');
    const body = get(db, '/api/v1/safe-locations?postcode=3000').body;
    expect(body.data_health.vicemergency_feed.status).toBe('down');
    expect(result(body, 'RELIEF').message).toContain('is down');
    expect(result(body, 'RELIEF').message).toContain('1800 226 226');
    expect(result(body, 'NSP').message).not.toContain('down');
  });
});

describe('static sync rules', () => {
  it('AC3: an empty upstream response leaves existing rows untouched and logs a failed run', async () => {
    const db = seeded();
    upsertFacilities(db, 'cfa_nsp_arcgis', [OLINDA]);
    const ok = await runSync(db, 'cfa_nsp_arcgis', async () => upsertFacilities(db, 'cfa_nsp_arcgis', []));
    expect(ok).toBe(false);
    expect(db.prepare('SELECT COUNT(*) AS n FROM facilities').get()).toEqual({ n: 1 });
    expect(db.prepare('SELECT status FROM sync_log ORDER BY log_id DESC LIMIT 1').get()).toEqual({ status: 'failed' });
    expect(get(db, '/api/v1/health').body.sources.find((s: { source_id: string }) => s.source_id === 'cfa_nsp_arcgis').consecutive_failures).toBe(1);
  });

  it('flags a row missing from a later run as needs_review instead of deleting it', () => {
    const db = seeded();
    upsertFacilities(db, 'cfa_nsp_arcgis', [OLINDA, { ...OLINDA, externalRef: '2', name: 'Gone' }]);
    upsertFacilities(db, 'cfa_nsp_arcgis', [OLINDA]);
    const rows = get(db, '/api/v1/sync/static-bundle').body.facilities;
    expect(rows.map((r: { name: string; designation_status: string }) => [r.name, r.designation_status])).toEqual([
      ['Olinda Recreation Reserve', 'designated'],
      ['Gone', 'needs_review'],
    ]);
  });

  it('answers a matching since with the same shape and nothing to load', async () => {
    const db = seeded();
    upsertFacilities(db, 'cfa_nsp_arcgis', [OLINDA]);
    await runSync(db, 'cfa_nsp_arcgis', async () => ({ seen: 1, added: 0, updated: 1 }));
    const full = get(db, '/api/v1/sync/static-bundle').body;
    expect(full.facilities).toHaveLength(1);
    expect(full.postcodes).toHaveLength(1);
    const again = get(db, `/api/v1/sync/static-bundle?since=${encodeURIComponent(full.version)}`).body;
    expect(again.version).toBe(full.version);
    expect(again.facilities).toEqual([]);
    expect(again.postcodes).toEqual([]);
  });
});

describe('the live feed', () => {
  it('recognises relief features by label and closes the ones that leave the feed', () => {
    const db = seeded();
    const fire = { geometry: { type: 'Point', coordinates: [145.0, -37.0] }, properties: { id: 'f', category1: 'Fire', category2: 'Bushfire' } };
    applyFeed(db, [relief('r1', 'Lilydale Community Centre'), fire]);
    let snapshot = get(db, '/api/v1/sync/dynamic-snapshot').body;
    expect(snapshot.activations).toEqual([expect.objectContaining({ type: 'RELIEF', name: 'Lilydale Community Centre' })]);
    expect(result(get(db, '/api/v1/safe-locations?postcode=3000').body, 'RELIEF').facility?.name).toBe('Lilydale Community Centre');

    applyFeed(db, [fire]);
    snapshot = get(db, '/api/v1/sync/dynamic-snapshot').body;
    expect(snapshot.activations).toEqual([]);
    expect(db.prepare("SELECT status FROM activations WHERE external_ref = 'r1'").get()).toEqual({ status: 'closed' });
  });

  it('classifies by any of the label fields, most specific first', () => {
    expect(classify({ sourceTitle: 'Emergency Relief Centre' })).toBe('ERC');
    expect(classify({ category2: 'Recovery Centre' })).toBe('RECOVERY');
    expect(classify({ name: 'Town Hall Assembly Area' })).toBe('ASSEMBLY');
    expect(classify({ category1: 'Fire', category2: 'Bushfire' })).toBeNull();
  });
});
