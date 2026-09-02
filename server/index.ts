import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createApi } from './api.ts';
import { openDb } from './db.ts';
import { SOURCE_ID as CFR, syncCfr } from './ingest/cfr.ts';
import { SOURCE_ID as NSP, syncNsp } from './ingest/nsp.ts';
import { SOURCE_ID as POSTCODES, syncPostcodes } from './ingest/postcodes.ts';
import { startPoller } from './ingest/vicemergency.ts';

const DB_PATH = process.env.DB_PATH ?? 'server/data/cooeee.sqlite';
const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '127.0.0.1';
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const BACKUPS_KEPT = 7;
const SYNC_LOG_DAYS = 30;
const CLOSED_ACTIVATION_DAYS = 7;

const db = openDb(DB_PATH);

// Static sources, postcodes first so the first nearest-per-postcode rebuild has both sides.
const STATIC_JOBS: [sourceId: string, run: () => Promise<boolean>][] = [
  [POSTCODES, () => syncPostcodes(db)],
  [NSP, () => syncNsp(db)],
  [CFR, () => syncCfr(db)],
];

function isDue(sourceId: string): boolean {
  const row = db
    .prepare('SELECT refresh_interval_seconds AS seconds, last_success_at AS at FROM data_sources WHERE source_id = ?')
    .get(sourceId) as { seconds: number; at: string | null };
  return row.at === null || Date.now() - Date.parse(row.at) > row.seconds * 1000;
}

// Checked hourly rather than scheduled per source: a 90-day timer overflows setInterval.
async function runDueStaticJobs(): Promise<void> {
  for (const [sourceId, run] of STATIC_JOBS) if (isDue(sourceId)) await run();
}

/** Keep the file small and take the daily snapshot (spec §8 backup item). */
function housekeeping(): void {
  const cutoff = (days: number): string => new Date(Date.now() - days * DAY_MS).toISOString();
  db.prepare('DELETE FROM sync_log WHERE run_started_at < ?').run(cutoff(SYNC_LOG_DAYS));
  db.prepare("DELETE FROM activations WHERE status = 'closed' AND closed_at < ?").run(cutoff(CLOSED_ACTIVATION_DAYS));
  db.exec('PRAGMA incremental_vacuum');
  if (DB_PATH === ':memory:') return;
  const dir = join(dirname(DB_PATH), 'backups');
  mkdirSync(dir, { recursive: true });
  const target = join(dir, `cooeee-${new Date().toISOString().slice(0, 10)}.sqlite`);
  if (!existsSync(target)) db.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
  const stale = readdirSync(dir).filter((name) => name.endsWith('.sqlite')).sort().slice(0, -BACKUPS_KEPT);
  for (const name of stale) unlinkSync(join(dir, name));
}

housekeeping();
setInterval(housekeeping, DAY_MS);
void runDueStaticJobs();
setInterval(() => void runDueStaticJobs(), HOUR_MS);
startPoller(db);

createApi(db).listen(PORT, HOST, () => {
  console.info(`[api] listening on http://${HOST}:${PORT} (database ${DB_PATH})`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    db.close();
    process.exit(0);
  });
}
