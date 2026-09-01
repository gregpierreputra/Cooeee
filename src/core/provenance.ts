import { MS_PER_DAY, OFFICIAL_DOMAINS, PACK_REFRESH_DAYS } from './constants';
import * as copy from './copy';
import type {
  CompletePackContent,
  ExposureLayer,
  LayerCode,
  PackDetailItem,
  Source,
  TextPackContent,
  VerifiedLayerStatus,
} from './types';

export type OmittedItem = { id: string; missing: 'publisher' | 'saved-date' };

export function missingDisplayProvenance(source: Source): OmittedItem['missing'] | null {
  if (typeof source.publisher !== 'string' || source.publisher.trim().length === 0) {
    return 'publisher';
  }
  if (!Number.isFinite(source.retrievedAt) || source.retrievedAt <= 0) return 'saved-date';
  return null;
}

export function hasCompleteSource(source: Source): boolean {
  return missingDisplayProvenance(source) === null
    && typeof source.url === 'string'
    && isAllowedSourceUrl(source.url)
    && typeof source.licence === 'string'
    && source.licence.trim().length > 0;
}

/** AC2 removes incomplete information items before any offer or write. Pack
 * identity sources are not optional items and remain a build-failing invariant. */
export function prepareProvenancedContent(content: TextPackContent): {
  content: TextPackContent;
  omittedItems: OmittedItem[];
} {
  const omittedItems: OmittedItem[] = [];
  const keep = <T extends { id: string; source: Source }>(row: T): boolean => {
    const missing = missingDisplayProvenance(row.source);
    if (!missing) return true;
    omittedItems.push({ id: row.id, missing });
    return false;
  };
  return {
    content: {
      ...content,
      layers: content.layers.filter(keep),
      destinations: content.destinations.filter(keep),
      recovery: content.recovery.filter(keep),
    },
    omittedItems,
  };
}

export function formatSavedDate(epochMs: number): string {
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Australia/Melbourne',
  }).format(epochMs);
}

/** Vicmap states a gazettal date as dd/mm/yyyy. It is read back through
 * formatSavedDate so a gazetted date reads exactly like a saved date; midday is
 * used so the Melbourne rendering cannot fall to the day before. Text that is
 * not that shape is shown exactly as the publisher wrote it, never guessed at. */
export function formatGazettalDate(stated: string): string {
  const parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(stated);
  if (!parts) return stated;
  const [, day, month, year] = parts;
  return formatSavedDate(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
}

export function savedAgeDays(now: number, savedAt: number): number {
  return Math.max(0, Math.floor((now - savedAt) / MS_PER_DAY));
}

export function provenanceView(now: number, source: Source): {
  publisherLine: string;
  ageLine: string;
  stale: boolean;
} {
  const days = savedAgeDays(now, source.retrievedAt);
  return {
    publisherLine: copy.PROVENANCE_LINE(source.publisher, formatSavedDate(source.retrievedAt)),
    ageLine: days === 0 ? copy.SAVED_TODAY : copy.ITEM_DAYS_AGO(days),
    stale: days > PACK_REFRESH_DAYS,
  };
}

export function isAllowedSourceUrl(urlText: string): boolean {
  try {
    const url = new URL(urlText);
    return url.protocol === 'https:' && OFFICIAL_DOMAINS.some(
      (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

const LAYER_NAMES: Record<LayerCode, string> = {
  BPA: copy.DESIGNATED_BUSHFIRE_PRONE_AREA,
  BMO: copy.BUSHFIRE_MANAGEMENT_OVERLAY,
  LSIO: copy.LAND_SUBJECT_TO_INUNDATION_OVERLAY,
  FO: copy.FLOODWAY_OVERLAY,
  SBO: copy.SPECIAL_BUILDING_OVERLAY,
};

/** A layer row is named by its stored status as well as its code. Naming it by
 * code alone made an absence indistinguishable from a designation: a pack whose
 * BPA status was 'none-mapped-here' or 'not-published' still rendered as
 * "Designated Bushfire Prone Area", so its stored source query — which correctly
 * returns no feature for an absence — read as a contradiction of the row. */
const LAYER_STATUS_NAME: Record<VerifiedLayerStatus, (layerName: string) => string> = {
  present: (layerName) => layerName,
  'none-mapped-here': copy.LAYER_NONE_MAPPED_HERE,
  'not-published': copy.LAYER_NOT_PUBLISHED,
};

function layerItemName(row: Pick<ExposureLayer, 'code' | 'status'>): string {
  return LAYER_STATUS_NAME[row.status](LAYER_NAMES[row.code]);
}

/** The absence marker is a stored row but not an information item: it has no
 * publisher-attributed content to open, only a reason. It renders as its own
 * plain statement, never as a pseudo-item in the list. */
export function packDetailAbsence(content: CompletePackContent): string | null {
  return content.destinations.find((row) => row.kind === 'absence')?.reason ?? null;
}

/** What a designated layer row can state about itself without a network: the
 * gazetted plan the check matched. Only a BPA hit stores one, and only when both
 * halves of it were saved — a half-citation would name a plan without dating it. */
function layerCitation(row: ExposureLayer, lgaName: string): string | undefined {
  if (row.code !== 'BPA' || row.status !== 'present') return undefined;
  const [feature] = row.features;
  if (!feature?.planNumber || !feature.gazettalDate) return undefined;
  return copy.BPA_PLAN_CITATION(
    feature.planNumber,
    formatGazettalDate(feature.gazettalDate),
    lgaName,
    row.source.publisher,
  );
}

export function packDetailItems(content: CompletePackContent): PackDetailItem[] {
  const items: PackDetailItem[] = [
    ...content.layers.map((row) => {
      const citation = layerCitation(row, content.pack.lgaName);
      return {
        id: row.id,
        name: layerItemName(row),
        source: row.source,
        ...(citation ? { citation } : {}),
      };
    }),
    ...content.destinations
      .filter((row) => row.kind !== 'absence')
      .map((row) => ({
        id: row.id,
        name: row.name ?? copy.OFFICIAL_DESTINATION_INFORMATION,
        source: row.source,
      })),
    ...content.recovery.map((row) => ({ id: row.id, name: row.title, source: row.source })),
  ];
  // ponytail: unreachable for Iteration 1 packs, which are all built without a
  // basemap; kept because builtWithTiles is a stored field and this is the
  // rendering the basemap capability will need when it lands.
  if (content.pack.builtWithTiles) {
    const source = content.pack.sources.find(({ licence }) => licence === 'ODbL');
    if (source) items.push({ id: `${content.pack.id}:basemap`, name: copy.OFFLINE_BASEMAP, source });
  }
  return items;
}

type OriginalSourceDecision = {
  kind: 'explain-before-open';
  item: PackDetailItem;
};

/** Opening a source is always a two-step, explicit choice. Connectivity is not
 * guessed from navigator.onLine because an interface can exist without a
 * working route to the source. */
export function decideOriginalSourceAccess(item: PackDetailItem): OriginalSourceDecision {
  return { kind: 'explain-before-open', item };
}
