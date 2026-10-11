import { describe, expect, it } from 'vitest';
import { MS_PER_DAY } from '../../src/core/constants';
import { daysLeftInPeriod, melbourneDay } from '../../src/core/day';

// Midnight in Melbourne on 10 October 2026 (AEDT, UTC+11) is 13:00 UTC the day before.
const MIDNIGHT = Date.UTC(2026, 9, 9, 13);

describe('the Melbourne calendar day', () => {
  it('turns at Melbourne midnight, not at UTC midnight', () => {
    const day = melbourneDay(MIDNIGHT);
    expect(day).toBe(Date.UTC(2026, 9, 10) / MS_PER_DAY);
    expect(melbourneDay(MIDNIGHT - 1)).toBe(day - 1);
    expect(melbourneDay(MIDNIGHT + 11 * 3_600_000)).toBe(day); // UTC midnight, 11 am in Melbourne
    expect(melbourneDay(MIDNIGHT + MS_PER_DAY - 1)).toBe(day);
  });

  it('counts a whole day across the end of daylight saving', () => {
    // Daylight saving ends on 5 April 2026: that day is 25 hours long.
    const start = Date.UTC(2026, 3, 4, 13); // midnight AEDT, 5 April
    expect(melbourneDay(start + 24 * 3_600_000)).toBe(melbourneDay(start)); // 11 pm AEST, still 5 April
    expect(melbourneDay(start + 25 * 3_600_000)).toBe(melbourneDay(start) + 1);
  });

  it('works before 1970', () => {
    expect(melbourneDay(Date.UTC(1969, 11, 31, 2))).toBe(-1);
  });
});

describe('days left in a stretch', () => {
  it('counts down to 1 on the last day, then starts again', () => {
    expect([0, 1, 2, 3, 4, 5].map((day) => daysLeftInPeriod(day, 3))).toEqual([3, 2, 1, 3, 2, 1]);
  });

  it('keeps whole stretches before the epoch', () => {
    expect([-3, -2, -1].map((day) => daysLeftInPeriod(day, 3))).toEqual([3, 2, 1]);
    expect(daysLeftInPeriod(10, 3, 10)).toBe(3);
  });
});
