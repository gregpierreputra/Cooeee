import { describe, expect, it } from 'vitest';
import { ROADS_PAN_MAX_M, ROADS_PAN_RETURN_MS } from '../../src/core/constants';
import { isPanned, NO_PAN, panOffset, panShouldReturn } from '../../src/core/pan';

// BS_Enhancement-AC5, from the 28 Sep review: dragging the map to look around.
// An offset is where the map's centre is, metres north and east of the person.

const MPP = 10; // metres a screen pixel

describe('a drag on the screen as a move of the map', () => {
  it('north up: the map follows the finger, so its centre moves the other way', () => {
    // Dragged 80 px right: the map moves east under the finger, so the view
    // looks west.
    const right = panOffset(NO_PAN, 80, 0, 0, MPP);
    expect(right.north + 0).toBe(0);
    expect(right.east).toBe(-800);
    // Dragged 50 px down: the view looks north.
    const down = panOffset(NO_PAN, 0, 50, 0, MPP);
    expect(down.north).toBe(500);
    expect(down.east + 0).toBe(0);
  });

  it('facing east: up the screen is east, so a drag down looks east', () => {
    const down = panOffset(NO_PAN, 0, 80, 90, MPP);
    expect(down.east).toBeCloseTo(800, 9);
    expect(down.north).toBeCloseTo(0, 9);
    // With east up, the right of the screen is south, so a drag right looks
    // north.
    const right = panOffset(NO_PAN, 80, 0, 90, MPP);
    expect(right.north).toBeCloseTo(800, 9);
    expect(right.east).toBeCloseTo(0, 9);
  });

  it('adds to the offset already there', () => {
    const twice = panOffset(panOffset(NO_PAN, 30, 0, 0, MPP), 20, 0, 0, MPP);
    expect(twice.east).toBe(-500);
  });

  it('never goes further than 3 km from the person, stopping in the direction dragged', () => {
    expect(ROADS_PAN_MAX_M).toBe(3_000);
    const far = panOffset(NO_PAN, -400, 0, 0, MPP); // 4 km east asked for
    expect(far.east).toBeCloseTo(3_000, 9);
    expect(far.north + 0).toBe(0);
    const diagonal = panOffset(NO_PAN, -300, 300, 0, MPP); // left and down: 3 km east and 3 km north
    expect(Math.hypot(diagonal.north, diagonal.east)).toBeCloseTo(3_000, 9);
    expect(diagonal.north).toBeCloseTo(diagonal.east, 9);
    expect(diagonal.north).toBeGreaterThan(0);
    // Just inside the limit, left as it is.
    expect(panOffset(NO_PAN, -299, 0, 0, MPP).east).toBe(2_990);
  });
});

describe('coming back to the person', () => {
  const moved = { north: 100, east: 0 };

  it('knows when the map has been moved', () => {
    expect(isPanned(NO_PAN)).toBe(false);
    expect(isPanned(moved)).toBe(true);
  });

  it('comes back by itself after 15 s with nothing touching it', () => {
    expect(ROADS_PAN_RETURN_MS).toBe(15_000);
    expect(panShouldReturn(moved, 1_000, 1_000 + 14_999)).toBe(false);
    expect(panShouldReturn(moved, 1_000, 1_000 + 15_000)).toBe(true);
  });

  it('never while a finger is on it, and never when it has not moved', () => {
    expect(panShouldReturn(moved, null, 1_000_000)).toBe(false);
    expect(panShouldReturn(NO_PAN, 1_000, 1_000 + 60_000)).toBe(false);
  });
});
