import * as copy from './copy';
import { formatSavedDate } from './provenance';
import type { BushfireAreaResult, ExposureLayer, LayerPublicationStatus, LayerStatus } from './types';

/** A positive point hit controls immediately.
 * For zero hits, the live existence probe controls,
 * the snapshot is an independent drift check. */
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
 * EPIC 1 can honestly produce. 
 * No fetch; the single feature is the gazetted plan the point hit named, and it
 * is stored only when there was a hit. An absence keeps an empty feature list,
 * because there is no designation to describe. */
export function bpaExposureLayer(packId: string, result: BushfireAreaResult): ExposureLayer {
  const { planNumber, gazettalDate } = result;
  return {
    id: `${packId}:BPA`,
    packId,
    group: 'designation',
    code: 'BPA',
    status: result.status,
    features: result.status === 'present' && planNumber && gazettalDate
      ? [{ planNumber, gazettalDate }]
      : [],
    checkedAt: result.checkedAt,
    source: result.source,
  };
}

type AreaCheckView = {
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