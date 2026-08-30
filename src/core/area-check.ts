import * as copy from './copy';
import { formatSavedDate } from './provenance';
import type { BushfireAreaResult, ExposureLayer, LayerPublicationStatus, LayerStatus } from './types';

export { formatSavedDate } from './provenance';

/** A positive point hit controls immediately. For zero hits, the live
 * existence probe controls; the snapshot is an independent drift check. */
export function resolveBushfireAreaStatus(
  pointHits: number,
  publication: LayerPublicationStatus,
): LayerStatus {
  if (pointHits > 0) return 'present';
  if (publication === 'unknown') return 'unknown';
  return publication === 'published' ? 'none-mapped-here' : 'not-published';
}

export function extentSnapshotDisagrees(
  snapshotPublishedIn: readonly string[],
  lgaName: string,
  liveLayerExistsInLga: boolean,
): boolean {
  return snapshotPublishedIn.includes(lgaName) !== liveLayerExistsInLga;
}

/** Turns an already-fetched official area result into the one content row
 * EPIC 1 can honestly produce. No fetch; features stay empty because
 * fetchBushfireAreaResult validates plan_number/gazettal_date but does not
 * surface them — a genuine gap, not a fabricated value. */
export function bpaExposureLayer(packId: string, result: BushfireAreaResult): ExposureLayer {
  return {
    id: `${packId}:BPA`,
    packId,
    group: 'designation',
    code: 'BPA',
    status: result.status,
    features: [],
    checkedAt: result.checkedAt,
    source: result.source,
  };
}

export type AreaCheckView = {
  resultLine: string;
  publisherLine: string;
  priorityLine: string;
};

/** Keep the three honest domain states exhaustive for rendering. */
export function areaCheckView(result: BushfireAreaResult): AreaCheckView {
  const publisherLine = copy.DTP_SAVED_DATE(formatSavedDate(result.checkedAt));
  switch (result.status) {
    case 'present':
      return {
        resultLine: copy.INSIDE_BUSHFIRE_AREA,
        publisherLine,
        priorityLine: copy.OFFICIAL_INSTRUCTIONS_FIRST,
      };
    case 'none-mapped-here':
      return {
        resultLine: copy.NOTHING_MAPPED_AT_ADDRESS,
        publisherLine,
        priorityLine: copy.OFFICIAL_INSTRUCTIONS_FIRST,
      };
    case 'not-published':
      return {
        resultLine: copy.AREA_NOT_PUBLISHED,
        publisherLine,
        priorityLine: copy.OFFICIAL_INSTRUCTIONS_FIRST,
      };
  }
}
