import * as copy from './copy';
import { formatSavedDate } from './provenance';
import type { BushfireAreaResult, LayerStatus } from './types';

export { formatSavedDate } from './provenance';

/** A positive point hit controls immediately. For zero hits, the live
 * existence probe controls; the snapshot is an independent drift check. */
export function resolveBushfireAreaStatus(
  pointHits: number,
  liveLayerExistsInLga: boolean,
): LayerStatus {
  if (pointHits > 0) return 'present';
  return liveLayerExistsInLga ? 'none-mapped-here' : 'not-published';
}

export function extentSnapshotDisagrees(
  snapshotPublishedIn: readonly string[],
  lgaName: string,
  liveLayerExistsInLga: boolean,
): boolean {
  return snapshotPublishedIn.includes(lgaName) !== liveLayerExistsInLga;
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
