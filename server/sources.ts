import type { DataHealth, SourceStatus } from '../src/core/types.ts';
import { type Db, nowIso } from './db.ts';

export type SyncCounts = { seen: number; added: number; updated: number; skipped?: number };

// Spec §6: three consecutive failures degrade a source, ten mark it down.
const DEGRADED_AFTER = 3;
const DOWN_AFTER = 10;

/** Run one ingestion attempt for `sourceId`. A sync_log row is written whether it
 *  succeeds or fails, and data_sources is updated to match. Returns whether it succeeded. */
export async function runSync(
  db: Db,
  sourceId: string,
  job: () => Promise<SyncCounts>,
): Promise<boolean> {
  const startedAt = nowIso();
  db.prepare('UPDATE data_sources SET last_attempt_at = ? WHERE source_id = ?').run(startedAt, sourceId);
  try {
    const counts = await job();
    logRun(db, sourceId, startedAt, counts, counts.skipped ? 'partial' : 'success', null);
    db.prepare(
      `UPDATE data_sources
         SET last_success_at = ?, consecutive_failures = 0, status = 'healthy', last_error = NULL
       WHERE source_id = ?`,
    ).run(nowIso(), sourceId);
    return true;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logRun(db, sourceId, startedAt, null, 'failed', detail);
    recordFailure(db, sourceId, detail);
    console.error(`[sync] ${sourceId} failed: ${detail}`);
    return false;
  }
}

function logRun(
  db: Db,
  sourceId: string,
  startedAt: string,
  counts: SyncCounts | null,
  status: 'success' | 'partial' | 'failed',
  detail: string | null,
): void {
  db.prepare(
    `INSERT INTO sync_log
       (source_id, run_started_at, run_finished_at, records_seen, records_added, records_updated, status, error_detail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    sourceId,
    startedAt,
    nowIso(),
    counts?.seen ?? null,
    counts?.added ?? null,
    counts?.updated ?? null,
    status,
    detail,
  );
}

/** One more failure for a source, with the degraded/down thresholds applied. */
export function recordFailure(db: Db, sourceId: string, detail: string): void {
  db.prepare(
    'UPDATE data_sources SET consecutive_failures = consecutive_failures + 1, last_error = ? WHERE source_id = ?',
  ).run(detail, sourceId);
  const failures = consecutiveFailures(db, sourceId);
  const status = failures >= DOWN_AFTER ? 'down' : failures >= DEGRADED_AFTER ? 'degraded' : null;
  if (status) db.prepare('UPDATE data_sources SET status = ? WHERE source_id = ?').run(status, sourceId);
}

export function consecutiveFailures(db: Db, sourceId: string): number {
  const row = db
    .prepare('SELECT consecutive_failures AS n FROM data_sources WHERE source_id = ?')
    .get(sourceId) as { n: number } | undefined;
  return row?.n ?? 0;
}

/** Every source's status, keyed by id — the `data_health` block of every response. */
export function dataHealth(db: Db): DataHealth {
  const rows = db
    .prepare('SELECT source_id, status, last_success_at FROM data_sources')
    .all() as { source_id: string; status: SourceStatus; last_success_at: string | null }[];
  return Object.fromEntries(
    rows.map((row) => [row.source_id, { status: row.status, last_success_at: row.last_success_at }]),
  );
}
