import { isInsideVictoria } from '../../src/core/constants.ts';
import { readJsonBounded } from '../../src/data/bounded-body.ts';
import type { DynamicType } from '../../src/core/types.ts';
import { type Db, nowIso, transaction } from '../db.ts';
import { consecutiveFailures, runSync, type SyncCounts } from '../sources.ts';

export const SOURCE_ID = 'vicemergency_feed';
const FEED_URL = 'https://emergency.vic.gov.au/public/osom-geojson.json';
const FETCH_TIMEOUT_MS = 20_000;
const MAX_BODY_BYTES = 50 * 1_048_576; // tens of KB on a quiet day; incident polygons during an event
const POLL_MS = 60_000;
const POLL_MAX_MS = 5 * 60_000;

// How a feed feature is recognised as a relief facility. The feed has no public
// schema, so these labels are matched, in this order, against the text fields
// below. ponytail: not yet verified against a live activation (none was open
// while this was written) — adjust this table, and nothing else, once one is seen.
const TYPE_BY_LABEL: [label: string, type: DynamicType][] = [
  ['emergency relief centre', 'ERC'],
  ['relief centre', 'RELIEF'],
  ['recovery centre', 'RECOVERY'],
  ['assembly area', 'ASSEMBLY'],
];
const LABEL_FIELDS = ['feedType', 'category1', 'category2', 'sourceTitle', 'name', 'sourceFeed'];

type Props = Record<string, unknown>;
type Geometry = { type?: string; coordinates?: unknown; geometries?: Geometry[] } | null | undefined;
type Feature = { geometry?: Geometry; properties?: Props | null };

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

export function classify(props: Props): DynamicType | null {
  const labels = LABEL_FIELDS.map((field) => text(props[field]) ?? '').join(' | ').toLowerCase();
  return TYPE_BY_LABEL.find(([label]) => labels.includes(label))?.[1] ?? null;
}

/** The feature's point: its own, or the first inside a GeometryCollection. */
export function firstPoint(geometry: Geometry): { lat: number; lon: number } | null {
  if (!geometry) return null;
  if (geometry.type === 'GeometryCollection') {
    return geometry.geometries?.map(firstPoint).find((point) => point !== null) ?? null;
  }
  if (geometry.type !== 'Point' || !Array.isArray(geometry.coordinates)) return null;
  const [lon, lat] = geometry.coordinates as unknown[];
  return typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)
    && isInsideVictoria(lat, lon)
    ? { lat, lon }
    : null;
}

/** Fetch the feed once and bring `activations` in line with it (spec §6). */
export async function pollOnce(db: Db, fetcher: typeof fetch = fetch): Promise<SyncCounts> {
  const response = await fetcher(FEED_URL, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`VicEmergency feed returned HTTP ${response.status}`);
  const feed = (await readJsonBounded(response, MAX_BODY_BYTES)) as { features?: unknown; properties?: { featureCount?: unknown } };
  if (!Array.isArray(feed.features)) throw new TypeError('VicEmergency feed: features must be an array');
  // The feed states its own count. A truncated body must never close every centre.
  const stated = feed.properties?.featureCount;
  if (typeof stated === 'number' && stated !== feed.features.length) {
    throw new Error('VicEmergency feed: featureCount does not match the features received');
  }
  return applyFeed(db, feed.features as Feature[]);
}

/** Upsert every relief feature as an active activation and close the ones that
 *  have left the feed — for this live table, disappearance means closure. */
export function applyFeed(db: Db, features: Feature[]): SyncCounts {
  const now = nowIso();
  const byId = new Map(features.map((feature) => [text(feature.properties?.id), feature]));
  const existing = db.prepare('SELECT 1 FROM activations WHERE source_id = ? AND external_ref = ?');
  const upsertIncident = db.prepare(
    `INSERT INTO incidents (incident_id, category, status, headline, source_updated_at, ingested_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(incident_id) DO UPDATE SET category = excluded.category, status = excluded.status,
       headline = excluded.headline, source_updated_at = excluded.source_updated_at, ingested_at = excluded.ingested_at`,
  );
  const upsertActivation = db.prepare(
    `INSERT INTO activations
       (source_id, external_ref, type_code, name, address, lat, lon, incident_id, status, opened_at, source_updated_at, ingested_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
     ON CONFLICT(source_id, external_ref) DO UPDATE SET type_code = excluded.type_code, name = excluded.name,
       address = excluded.address, lat = excluded.lat, lon = excluded.lon, incident_id = excluded.incident_id,
       status = 'active', closed_at = NULL, source_updated_at = excluded.source_updated_at, ingested_at = excluded.ingested_at`,
  );
  const active = db.prepare(
    "SELECT activation_id, external_ref FROM activations WHERE source_id = ? AND status = 'active'",
  );
  const close = db.prepare("UPDATE activations SET status = 'closed', closed_at = ? WHERE activation_id = ?");

  // Only the incident an activation points at is kept (no geometry): the
  // database stays small and the foreign key stays satisfiable.
  const linkIncident = (props: Props): string | null => {
    const eventId = text(props.eventId);
    const incident = eventId ? byId.get(eventId)?.properties : null;
    if (!eventId || !incident) return null;
    const headline = text(incident.webHeadline) ?? text(incident.name) ?? text(incident.sourceTitle);
    upsertIncident.run(eventId, text(incident.category1), text(incident.status), headline, text(incident.updated), now);
    return eventId;
  };

  return transaction(db, () => {
    let seen = 0;
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const refsSeen = new Set<string>();
    for (const feature of features) {
      const props = feature.properties ?? {};
      const type = classify(props);
      if (!type) continue;
      seen += 1;
      const externalRef = text(props.sourceId) ?? text(props.id);
      const name = text(props.name) ?? text(props.sourceTitle) ?? text(props.webHeadline);
      const point = firstPoint(feature.geometry);
      if (!externalRef || !name || !point) {
        skipped += 1;
        continue;
      }
      const isNew = existing.get(SOURCE_ID, externalRef) === undefined;
      upsertActivation.run(
        SOURCE_ID,
        externalRef,
        type,
        name,
        text(props.location),
        point.lat,
        point.lon,
        linkIncident(props),
        text(props.created),
        text(props.updated) ?? text(props.created) ?? now,
        now,
      );
      if (isNew) added += 1;
      else updated += 1;
      refsSeen.add(externalRef);
    }
    const gone = (active.all(SOURCE_ID) as { activation_id: number; external_ref: string }[]).filter(
      (row) => !refsSeen.has(row.external_ref),
    );
    for (const row of gone) close.run(now, row.activation_id);
    if (gone.length > 0) console.info(`[poll] ${gone.length} activation(s) left the feed — marked closed`);
    return { seen, added, updated, skipped };
  });
}

/** Poll every minute while healthy; back off exponentially (capped) while
 *  failing, so a struggling feed is not hammered. */
export function startPoller(db: Db, fetcher: typeof fetch = fetch): void {
  const tick = async (): Promise<void> => {
    const ok = await runSync(db, SOURCE_ID, () => pollOnce(db, fetcher));
    const delay = ok ? POLL_MS : Math.min(POLL_MS * 2 ** consecutiveFailures(db, SOURCE_ID), POLL_MAX_MS);
    setTimeout(() => void tick(), delay);
  };
  void tick();
}
