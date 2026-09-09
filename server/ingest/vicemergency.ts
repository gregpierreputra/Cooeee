import { isInsideVictoria, MAX_SYNC_ROWS, MAX_TEXT_CHARS, OFFICIAL_DOMAINS } from '../../src/core/constants.ts';
import { readJsonBounded } from '../../src/data/bounded-body.ts';
import type { ConditionHazard, DynamicType, LatLon } from '../../src/core/types.ts';
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

// How a feed feature is recognised as a heat or severe weather notice, matched
// the same way over the same fields plus the CAP event. ponytail: not yet
// verified against a live heat item (none in September) — adjust this table only.
const HAZARD_BY_LABEL: [label: string, hazard: ConditionHazard][] = [
  ['heatwave', 'heat'],
  ['heat health', 'heat'],
  ['extreme heat', 'heat'],
  ['severe weather', 'storm'],
  ['thunderstorm', 'storm'],
];
// Who issued the notice, from the feed's own organisation code.
const PUBLISHER_BY_ORG: Record<string, string> = {
  'AU/BOM': 'Bureau of Meteorology',
  'VIC/DH': 'Department of Health',
};
const DEFAULT_PUBLISHER = 'Emergency Management Victoria';
// A notice past the phone's own row cap keeps no rings at all, so one enormous
// polygon set cannot bloat every phone's snapshot. ponytail: the cap drops the
// area rather than simplifying it; add ring simplification if a real notice trips it.
const MAX_RING_POINTS = MAX_SYNC_ROWS;

type Props = Record<string, unknown>;
type Geometry = { type?: string; coordinates?: unknown; geometries?: Geometry[] } | null | undefined;
type Feature = { geometry?: Geometry; properties?: Props | null };

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, MAX_TEXT_CHARS) : null;

const labelsOf = (props: Props): string =>
  LABEL_FIELDS.map((field) => text(props[field]) ?? '').join(' | ').toLowerCase();

export function classify(props: Props): DynamicType | null {
  const labels = labelsOf(props);
  return TYPE_BY_LABEL.find(([label]) => labels.includes(label))?.[1] ?? null;
}

export function classifyHazard(props: Props): ConditionHazard | null {
  const cap = props.cap as Props | null | undefined;
  const labels = `${labelsOf(props)} | ${text(cap?.event) ?? ''}`.toLowerCase();
  return HAZARD_BY_LABEL.find(([label]) => labels.includes(label))?.[1] ?? null;
}

const publisherOf = (props: Props): string => {
  const org = text(props.sourceOrg) ?? '';
  return PUBLISHER_BY_ORG[org] ?? (labelsOf(props).includes('health') ? 'Department of Health' : DEFAULT_PUBLISHER);
};

/** A link is kept only when it is https and points at a publisher the app already trusts. */
const officialUrl = (value: unknown): string | null => {
  const url = text(value);
  if (!url) return null;
  try {
    const { protocol, hostname: host } = new URL(url);
    if (protocol !== 'https:') return null;
    return OFFICIAL_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`)) ? url : null;
  } catch {
    return null;
  }
};

const round4 = (n: number): number => Math.round(n * 10_000) / 10_000;

/** The outer ring of every polygon in the geometry, as named points rounded to
 *  about ten metres. Empty when there are none, or when the total passes the cap. */
export function rings(geometry: Geometry, depth = 0): LatLon[][] {
  if (!geometry || depth > MAX_GEOMETRY_DEPTH) return [];
  if (geometry.type === 'GeometryCollection') {
    return (geometry.geometries ?? []).flatMap((inner) => rings(inner, depth + 1));
  }
  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  const found: LatLon[][] = [];
  for (const polygon of (Array.isArray(polygons) ? polygons : []) as unknown[]) {
    const outer = Array.isArray(polygon) ? (polygon[0] as unknown) : null;
    if (!Array.isArray(outer)) continue;
    const ring: LatLon[] = [];
    for (const pair of outer as unknown[]) {
      const [lon, lat] = Array.isArray(pair) ? (pair as unknown[]) : [];
      if (typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)) {
        ring.push({ lat: round4(lat), lon: round4(lon) });
      }
    }
    if (ring.length >= 3) found.push(ring);
  }
  const points = found.reduce((sum, ring) => sum + ring.length, 0);
  return points > MAX_RING_POINTS ? [] : found;
}

// A GeometryCollection may nest. Past this depth the feature is skipped, so a
// hostile or broken feed cannot exhaust the stack and stop the poll.
const MAX_GEOMETRY_DEPTH = 8;

/** The feature's point: its own, or the first inside a GeometryCollection. */
export function firstPoint(geometry: Geometry, depth = 0): { lat: number; lon: number } | null {
  if (!geometry || depth > MAX_GEOMETRY_DEPTH) return null;
  if (geometry.type === 'GeometryCollection') {
    return geometry.geometries?.map((inner) => firstPoint(inner, depth + 1)).find((point) => point !== null)
      ?? null;
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
  const conditionExists = db.prepare('SELECT 1 FROM conditions WHERE condition_id = ?');
  const upsertCondition = db.prepare(
    `INSERT INTO conditions
       (condition_id, hazard, title, publisher, level, url, statewide, rings_json, status, source_updated_at, ingested_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
     ON CONFLICT(condition_id) DO UPDATE SET hazard = excluded.hazard, title = excluded.title,
       publisher = excluded.publisher, level = excluded.level, url = excluded.url, statewide = excluded.statewide,
       rings_json = excluded.rings_json, status = 'active', closed_at = NULL,
       source_updated_at = excluded.source_updated_at, ingested_at = excluded.ingested_at`,
  );
  const activeConditions = db.prepare("SELECT condition_id FROM conditions WHERE status = 'active'");
  const closeCondition = db.prepare("UPDATE conditions SET status = 'closed', closed_at = ? WHERE condition_id = ?");

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
    const conditionsSeen = new Set<string>();
    for (const feature of features) {
      const props = feature.properties ?? {};
      // A relief facility is a place, never a notice, whatever its name contains.
      const type = classify(props);
      const hazard = type ? null : classifyHazard(props);
      if (hazard) {
        const id = text(props.sourceId) ?? text(props.id);
        const title = text(props.sourceTitle) ?? text(props.name) ?? text(props.webHeadline);
        const area = rings(feature.geometry);
        const statewide = props.statewide === 'Y';
        if (!id || !title || (area.length === 0 && !statewide)) {
          skipped += 1;
          continue;
        }
        seen += 1;
        const isNew = conditionExists.get(id) === undefined;
        upsertCondition.run(
          id,
          hazard,
          title,
          publisherOf(props),
          text(props.category1) ?? text(props.status),
          officialUrl(props.url),
          statewide ? 1 : 0,
          JSON.stringify(area),
          text(props.updated) ?? text(props.created) ?? now,
          now,
        );
        if (isNew) added += 1;
        else updated += 1;
        conditionsSeen.add(id);
        continue;
      }
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
    const ended = (activeConditions.all() as { condition_id: string }[]).filter(
      (row) => !conditionsSeen.has(row.condition_id),
    );
    for (const row of ended) closeCondition.run(now, row.condition_id);
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
