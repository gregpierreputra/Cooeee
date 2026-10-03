import { describe, expect, it } from 'vitest';
import { FIX_PUBLISH_M, READOUT_MIN_CHANGE_M } from '../../src/core/constants';
import { steadyReadout, type ShownReadout } from '../../src/core/readout';

// The readout's steadiness (28 Sep review).

const shown: ShownReadout = { placeId: 'village-green', distanceM: 2_600, bearingDeg: 0 };

describe('the readout holds still while the fix wobbles', () => {
  it("uses the fix's accuracy, and never less than FIX_PUBLISH_M", () => {
    expect(READOUT_MIN_CHANGE_M).toBe(FIX_PUBLISH_M);
  });

  it('a 1 m wobble at ±4 m accuracy changes nothing', () => {
    expect(steadyReadout(shown, { ...shown, distanceM: 2_601 }, 4)).toBe(shown);
    expect(steadyReadout(shown, { ...shown, distanceM: 2_599 }, 4)).toBe(shown);
  });

  it('a 6 m move changes the figure', () => {
    const moved = { ...shown, distanceM: 2_594 };
    expect(steadyReadout(shown, moved, 4)).toBe(moved);
  });

  it('a vaguer fix needs a bigger move', () => {
    expect(steadyReadout(shown, { ...shown, distanceM: 2_620 }, 30)).toBe(shown);
    const moved = { ...shown, distanceM: 2_640 };
    expect(steadyReadout(shown, moved, 30)).toBe(moved);
  });

  it('a move across the line to the place counts too, as metres at its distance', () => {
    // 0.1 degrees at 2.6 km is about 4.5 m: held. 0.2 degrees, about 9 m: changed.
    expect(steadyReadout(shown, { ...shown, bearingDeg: 0.1 }, 4)).toBe(shown);
    const turned = { ...shown, bearingDeg: 359.8 };
    expect(steadyReadout(shown, turned, 4)).toBe(turned);
  });

  it('another place, or nothing shown yet, shows the new figures at once', () => {
    const other = { placeId: 'belgrave', distanceM: 2_601, bearingDeg: 0 };
    expect(steadyReadout(shown, other, 4)).toBe(other);
    expect(steadyReadout(null, shown, 4)).toBe(shown);
  });
});
