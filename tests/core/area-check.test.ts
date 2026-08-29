import { describe, expect, it } from 'vitest';

import {
  areaCheckView,
  extentSnapshotDisagrees,
  formatSavedDate,
  resolveBushfireAreaStatus,
} from '../../src/core/area-check';
import * as copy from '../../src/core/copy';
import type { BushfireAreaResult } from '../../src/core/types';

const result = (status: BushfireAreaResult['status']): BushfireAreaResult => ({
  status,
  checkedAt: Date.UTC(2026, 7, 28, 2),
  lgaName: 'YARRA RANGES',
  source: {
    publisher: 'Department of Transport and Planning',
    url: 'https://opendata.maps.vic.gov.au/geoserver/wfs',
    licence: 'CC BY 4.0',
    retrievedAt: Date.UTC(2026, 7, 28, 2),
  },
  snapshotDisagreed: false,
});

describe('E1-US1-AC5–AC7 area decisions', () => {
  it('maps a positive point hit to present regardless of the existence input', () => {
    expect(resolveBushfireAreaStatus(1, false)).toBe('present');
  });

  it('maps zero hits with a live LGA hit to none-mapped-here', () => {
    expect(resolveBushfireAreaStatus(0, true)).toBe('none-mapped-here');
  });

  it('maps zero hits with no live LGA hit to not-published', () => {
    expect(resolveBushfireAreaStatus(0, false)).toBe('not-published');
  });

  it.each([
    [['YARRA RANGES'], 'YARRA RANGES', true, false],
    [[], 'MELBOURNE', false, false],
    [['YARRA RANGES'], 'YARRA RANGES', false, true],
    [[], 'MELBOURNE', true, true],
  ] as const)('detects snapshot/live disagreement', (publishedIn, lga, live, expected) => {
    expect(extentSnapshotDisagrees(publishedIn, lga, live)).toBe(expected);
  });

  it('formats the saved date with no leading zero', () => {
    expect(formatSavedDate(Date.UTC(2026, 2, 2, 1))).toBe('2 March 2026');
  });

  it('renders all three statuses with publisher/date and priority', () => {
    expect(areaCheckView(result('present'))).toEqual({
      resultLine: copy.INSIDE_BUSHFIRE_AREA,
      publisherLine: 'Published by the Department of Transport and Planning, saved 28 August 2026.',
      priorityLine: copy.OFFICIAL_INSTRUCTIONS_FIRST,
    });
    expect(areaCheckView(result('none-mapped-here')).resultLine).toBe(
      copy.NOTHING_MAPPED_AT_ADDRESS,
    );
    expect(areaCheckView(result('not-published')).resultLine).toBe(copy.AREA_NOT_PUBLISHED);
  });
});

describe('E1-US1-AC5–AC7 exact copy', () => {
  it('keeps presence and absence meanings separate', () => {
    expect(copy.INSIDE_BUSHFIRE_AREA).toBe(
      'This address is inside a Designated Bushfire Prone Area.',
    );
    expect(copy.NOTHING_MAPPED_AT_ADDRESS).toBe(
      'No Designated Bushfire Prone Area is mapped at this address in the current planning scheme.',
    );
    expect(copy.AREA_NOT_PUBLISHED).toBe(
      'The Designated Bushfire Prone Area is not published for this area — Department of Transport and Planning.',
    );
  });

  it('keeps failed-check wording distinct from absence', () => {
    expect(copy.AREA_CHECK_COULD_NOT_RUN).toBe(
      'We could not check the bushfire area for this address right now.',
    );
    expect(copy.AREA_NOT_SAVED).toBe(
      'Nothing has been saved. Your address is still here — try again when you have a connection.',
    );
  });
});
