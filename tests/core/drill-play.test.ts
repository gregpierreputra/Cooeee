import { describe, expect, it } from 'vitest';
import { SPAWN } from '../../src/core/drill-house';
import { DRILL_ITEMS } from '../../src/core/drill-items';
import { DOWN, LEFT, RIGHT, SPEED, UP, facing, haze, leavingEarly, nearestItem, speedFor, step } from '../../src/core/drill-play';

const bulky = DRILL_ITEMS.filter((item) => item.weight < 0).map((item) => item.id);

describe('E7 the drill rules of movement', () => {
  it('moves at the pace given, never faster on a diagonal', () => {
    const moved = step(SPAWN.x, SPAWN.y, 1, -1, 0.1, SPEED);
    expect(Math.hypot(moved.x - SPAWN.x, moved.y - SPAWN.y)).toBeCloseTo(SPEED * 0.1);
  });

  it('slides along a wall instead of stopping dead', () => {
    // Against the east wall of the living room, pushing right and down.
    const moved = step(26.69, 6.5, 1, 1, 0.1, SPEED);
    expect(moved.x).toBe(26.69);
    expect(moved.y).toBeGreaterThan(6.5);
  });

  it('slows for each bulky thing, down to a floor', () => {
    expect(speedFor([])).toBe(SPEED);
    expect(speedFor([bulky[0]])).toBeCloseTo(SPEED * 0.9);
    expect(speedFor(bulky)).toBeCloseTo(SPEED * 0.6);
    expect(speedFor(['not an item'])).toBe(SPEED);
  });

  it('faces the way the stick points and keeps facing when it rests', () => {
    expect(facing(1, 0.2, DOWN)).toBe(RIGHT);
    expect(facing(-1, 0.2, DOWN)).toBe(LEFT);
    expect(facing(0.1, -1, DOWN)).toBe(UP);
    expect(facing(0.1, 1, UP)).toBe(DOWN);
    expect(facing(0, 0, LEFT)).toBe(LEFT);
  });

  it('offers the nearest thing in reach that is not packed yet', () => {
    const torch = DRILL_ITEMS.find((item) => item.id === 'torch')!;
    expect(nearestItem(torch.x, torch.y + 0.5, [])?.id).toBe('torch');
    expect(nearestItem(torch.x, torch.y + 0.5, ['torch'])?.id).not.toBe('torch');
    expect(nearestItem(8.5, 12.5, [])).toBeNull();
  });

  it('thickens smoke and dark through the minute and never past the end', () => {
    expect(haze(0, 60).smoke).toBeLessThan(haze(30, 60).smoke);
    expect(haze(30, 60).dark).toBeLessThan(haze(60, 60).dark);
    expect(haze(60, 60).dark).toBeLessThan(1);
    expect(haze(999, 60)).toEqual(haze(60, 60));
  });

  it('lets a full bag leave early from the mat in the last ten seconds only', () => {
    expect(leavingEarly(10, 9.5, true)).toBe(true);
    expect(leavingEarly(10, 10, true)).toBe(true);
    expect(leavingEarly(10, 10.5, true)).toBe(false);
    expect(leavingEarly(9, 5, true)).toBe(false);
    expect(leavingEarly(10, 5, false)).toBe(false);
  });
});
