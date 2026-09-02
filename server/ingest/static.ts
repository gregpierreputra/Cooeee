import { type Db, nowIso, transaction } from '../db.ts';
import { findNearest } from '../geo.ts';
import type { SyncCounts } from '../sources.ts';

export type FacilityInput = {
  externalRef: string;
  typeCode: 'NSP' | 'CFR';
  name: string;
  address: string | null;
  lat: number;
  lon: number;
  lgaName: string | null;
};

/** Spec §6 static rules: an empty run never touches the database; rows are
 *  upserted on (source_id, external_ref); rows missing from this run are flagged
 *  for human review, never deleted. */
export function upsertFacilities(db: Db, sourceId: string, rows: FacilityInput[]): SyncCounts {
  if (rows.length === 0) {
    throw new Error('upstream returned no rows — existing facilities left untouched');
  }
  const now = nowIso();
  const existing = db.prepare('SELECT facility_id FROM facilities WHERE source_id = ? AND external_ref = ?');
  const insert = db.prepare(
    `INSERT INTO facilities
       (source_id, external_ref, type_code, name, address, lat, lon, lga_name, last_verified_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const update = db.prepare(
    `UPDATE facilities
       SET name = ?, address = ?, lat = ?, lon = ?, lga_name = ?, designation_status = 'designated',
           last_verified_at = ?, updated_at = ?
     WHERE facility_id = ?`,
  );
  const designated = db.prepare(
    "SELECT facility_id, external_ref FROM facilities WHERE source_id = ? AND designation_status = 'designated'",
  );
  const flag = db.prepare(
    "UPDATE facilities SET designation_status = 'needs_review', updated_at = ? WHERE facility_id = ?",
  );

  return transaction(db, () => {
    let added = 0;
    let updated = 0;
    for (const row of rows) {
      const found = existing.get(sourceId, row.externalRef) as { facility_id: number } | undefined;
      if (found) {
        update.run(row.name, row.address, row.lat, row.lon, row.lgaName, now, now, found.facility_id);
        updated += 1;
      } else {
        insert.run(sourceId, row.externalRef, row.typeCode, row.name, row.address, row.lat, row.lon, row.lgaName, now, now, now);
        added += 1;
      }
    }
    // A designated row this run did not mention is flagged for review — never deleted.
    const seen = new Set(rows.map((row) => row.externalRef));
    const absent = (designated.all(sourceId) as { facility_id: number; external_ref: string }[]).filter(
      (row) => !seen.has(row.external_ref),
    );
    for (const row of absent) flag.run(now, row.facility_id);
    if (absent.length > 0) {
      console.warn(`[sync] ${sourceId}: ${absent.length} row(s) missing from this run — marked needs_review for human review`);
    }
    return { seen: rows.length, added, updated };
  });
}

/** Spec §3: the precomputed nearest static facility for every postcode. Small
 *  enough to rebuild in full after any static sync. */
export function rebuildNearestStatic(db: Db): void {
  const postcodes = db
    .prepare('SELECT postcode, centroid_lat AS lat, centroid_lon AS lon FROM postcodes')
    .all() as { postcode: string; lat: number; lon: number }[];
  const insert = db.prepare(
    'INSERT INTO postcode_nearest_static (postcode, type_code, facility_id, distance_km, computed_at) VALUES (?, ?, ?, ?, ?)',
  );
  const now = nowIso();
  transaction(db, () => {
    db.exec('DELETE FROM postcode_nearest_static');
    for (const postcode of postcodes) {
      for (const typeCode of ['NSP', 'CFR']) {
        const nearest = findNearest<{ facility_id: number; lat: number; lon: number }>(db, 'facilities', postcode, typeCode);
        insert.run(postcode.postcode, typeCode, nearest?.row.facility_id ?? null, nearest?.distanceKm ?? null, now);
      }
    }
  });
}
