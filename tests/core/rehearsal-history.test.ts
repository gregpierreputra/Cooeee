import { describe, expect, it } from 'vitest';
import * as copy from '../../src/core/copy';
import { historyRows } from '../../src/core/rehearsal-history';
import type { Rehearsal } from '../../src/core/types';

// 1_756_100_000_000 is 25 August 2025 in Melbourne; a day later is the 26th.
const DAY = 86_400_000;
const rehearsal = (over: Partial<Rehearsal>): Rehearsal => ({
  id: 'r',
  packId: 'pack-1',
  condition: 'no-data',
  startedAt: 1_756_100_000_000,
  finishedAt: 1_756_100_000_000,
  gaps: [],
  ...over,
});

describe('E5-US5 the rehearsal history on the pack page', () => {
  it('lists every finished rehearsal newest first, in the result screen words', () => {
    const rows = historyRows([
      rehearsal({ id: 'older', ending: 'dry-run', gaps: [{ gapType: 'places-missing', kind: 'pack-content', hazard: 'bushfire' }] }),
      rehearsal({
        id: 'newer',
        condition: 'no-location-fix',
        startedAt: 1_756_100_000_000 + DAY,
        finishedAt: 1_756_100_000_000 + DAY + 12 * 60_000,
        ending: 'walked',
        elapsedMs: 12 * 60_000,
      }),
    ]);
    expect(rows).toEqual([
      {
        id: 'newer',
        date: '26 August 2025',
        condition: 'No location fix',
        ending: 'You went there. It took you 12 minutes.',
        gaps: 'No gaps found',
        found: [],
      },
      {
        id: 'older',
        date: '25 August 2025',
        condition: 'No mobile data',
        ending: 'A dry run. You ended it without going.',
        gaps: '1 gap found',
        found: [
          {
            actionId: 'build-pack-again-for-places',
            title: copy.GAP_PLACES,
            reason: copy.GAP_REASON_PLACES,
            meaning: copy.GAP_MEANING_PACK_CONTENT,
            action: copy.ACTION_BUILD_AGAIN_PLACES,
          },
        ],
      },
    ]);
    expect(copy.HISTORY_GAPS(2)).toBe('2 gaps found');
  });

  it('is empty for a pack never rehearsed', () => {
    expect(historyRows([])).toEqual([]);
  });
});
