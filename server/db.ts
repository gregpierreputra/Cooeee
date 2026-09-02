import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Db = DatabaseSync;

/** ISO-8601 UTC — the one timestamp format stored anywhere in this database. */
export const nowIso = (): string => new Date().toISOString();

const SCHEMA_URL = new URL('./db/schema.sql', import.meta.url);

// The upstream sources this server ingests (spec §2). Inserted once; afterwards
// only the sync wrapper in sources.ts updates these rows.
const SOURCES: [id: string, name: string, kind: 'static' | 'dynamic', url: string, seconds: number][] = [
  [
    'cfa_nsp_arcgis',
    'CFA Neighbourhood Safer Places (ArcGIS)',
    'static',
    'https://services-ap1.arcgis.com/vh59f3ZyAEAhnejO/ArcGIS/rest/services/MY_CFA_Data_Layers_V2/FeatureServer/2',
    7 * 24 * 3600,
  ],
  [
    'cfr_static_list',
    'Community Fire Refuges (CFA list)',
    'static',
    'https://www.cfa.vic.gov.au/plan-prepare/your-local-area-info-and-advice/community-fire-refuges',
    7 * 24 * 3600,
  ],
  [
    'vicmap_admin_postcodes',
    'Vicmap postcode boundaries (WFS)',
    'static',
    'https://opendata.maps.vic.gov.au/geoserver/wfs',
    90 * 24 * 3600,
  ],
  [
    'vicemergency_feed',
    'VicEmergency live feed',
    'dynamic',
    'https://emergency.vic.gov.au/public/osom-geojson.json',
    60,
  ],
];

/** Open the database, creating the schema on first use. ':memory:' is for tests. */
export function openDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  // Per-connection settings (schema.sql repeats the first three for a plain
  // `sqlite3 db < schema.sql` bootstrap). Incremental auto_vacuum only takes
  // effect on an empty file, which is exactly when a new database gets it.
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA synchronous = NORMAL;
    PRAGMA journal_size_limit = 1048576;
    PRAGMA auto_vacuum = INCREMENTAL;
  `);
  const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'facilities'").get();
  if (!exists) db.exec(readFileSync(SCHEMA_URL, 'utf8'));
  const seed = db.prepare(
    `INSERT OR IGNORE INTO data_sources
       (source_id, name, source_kind, endpoint_url, refresh_interval_seconds)
     VALUES (?, ?, ?, ?, ?)`,
  );
  for (const row of SOURCES) seed.run(...row);
  return db;
}

/** Run `fn` inside one transaction: all of its writes land, or none do. */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
