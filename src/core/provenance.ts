import { MS_PER_DAY, OFFICIAL_DOMAINS, PACK_REFRESH_DAYS } from './constants';
import * as copy from './copy';
import type {
  CompletePackContent,
  LayerCode,
  PackDetailItem,
  Source,
  TextPackContent,
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

export function packDetailItems(content: CompletePackContent): PackDetailItem[] {
  const items: PackDetailItem[] = [
    ...content.layers.map((row) => ({ id: row.id, name: LAYER_NAMES[row.code], source: row.source })),
    ...content.destinations.map((row) => ({
      id: row.id,
      name: row.name ?? copy.OFFICIAL_DESTINATION_INFORMATION,
      source: row.source,
    })),
    ...content.recovery.map((row) => ({ id: row.id, name: row.title, source: row.source })),
  ];
  if (content.pack.builtWithTiles) {
    const source = content.pack.sources.find(({ licence }) => licence === 'ODbL');
    if (source) items.push({ id: `${content.pack.id}:basemap`, name: copy.OFFLINE_BASEMAP, source });
  }
  return items;
}

export type OriginalSourceDecision = {
  kind: 'explain-before-open';
  item: PackDetailItem;
};

/** Opening a source is always a two-step, explicit choice. Connectivity is not
 * guessed from navigator.onLine because an interface can exist without a
 * working route to the source. */
export function decideOriginalSourceAccess(item: PackDetailItem): OriginalSourceDecision {
  return { kind: 'explain-before-open', item };
}
