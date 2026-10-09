import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';

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
  // Per-connection settings (schema.sql repeats journal_mode, foreign_keys and
  // synchronous for a plain `sqlite3 db < schema.sql` bootstrap). auto_vacuum
  // comes first: it only takes on a file whose header is not yet written, and
  // switching to WAL writes it.
  db.exec(`
    PRAGMA auto_vacuum = INCREMENTAL;
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA synchronous = NORMAL;
    PRAGMA journal_size_limit = 1048576;
    PRAGMA busy_timeout = 2000;
  `);
  // A file made before that order was fixed has auto_vacuum off, so the daily
  // incremental_vacuum did nothing. One VACUUM converts it, once.
  const vacuum = db.prepare('PRAGMA auto_vacuum').get() as { auto_vacuum: number };
  if (path !== ':memory:' && vacuum.auto_vacuum === 0) db.exec('PRAGMA auto_vacuum = INCREMENTAL; VACUUM');
  const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'facilities'").get();
  if (!exists) db.exec(readFileSync(SCHEMA_URL, 'utf8'));
  // A database made before site_kind gains the column once; the next CFA sync fills it.
  const columns = db.prepare('PRAGMA table_info(facilities)').all() as { name: string }[];
  if (!columns.some((column) => column.name === 'site_kind')) {
    db.exec("ALTER TABLE facilities ADD COLUMN site_kind TEXT CHECK (site_kind IN ('building','open_space'))");
  }
  const seed = db.prepare(
    `INSERT OR IGNORE INTO data_sources
       (source_id, name, source_kind, endpoint_url, refresh_interval_seconds)
     VALUES (?, ?, ?, ?, ?)`,
  );
  for (const row of SOURCES) seed.run(...row);
  return db;
}

const statements = new WeakMap<Db, Map<string, StatementSync>>();

/** The prepared statement for this SQL, prepared once per connection and reused
 *  on every request after. Safe to share: the server runs on one thread and
 *  each call finishes before the next begins. */
export function statement(db: Db, sql: string): StatementSync {
  let cache = statements.get(db);
  if (!cache) statements.set(db, (cache = new Map()));
  let prepared = cache.get(sql);
  if (!prepared) cache.set(sql, (prepared = db.prepare(sql)));
  return prepared;
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
