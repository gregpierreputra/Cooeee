import { describe, expect, it } from 'vitest';
import { COLS, MAT_CENTRE, REACH, ROWS, SPAWN, blocked, onDoorMat, restingOrder, roomAt } from '../../src/core/drill-house';
import { DRILL_ITEMS } from '../../src/core/drill-items';
import { FURNITURE, GRID, ROOM_OF } from '../../src/core/drill-layout';

// Every cell centre a person can walk to from the start, by flood fill.
function walkable(): Set<string> {
  const seen = new Set<string>();
  const queue = [[Math.floor(SPAWN.x), Math.floor(SPAWN.y)]];
  while (queue.length > 0) {
    const [x, y] = queue.pop()!;
    const key = `${x},${y}`;
    if (seen.has(key) || blocked(x + 0.5, y + 0.5)) continue;
    seen.add(key);
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return seen;
}

describe('E7 the drill house', () => {
  it('is a grid of equal rows that starts the person in the living room', () => {
    expect(GRID.every((row) => row.length === COLS)).toBe(true);
    expect(blocked(SPAWN.x, SPAWN.y)).toBe(false);
    expect(roomAt(SPAWN.x, SPAWN.y)).toBe('living room');
  });

  it('stops the person at walls, furniture and the edge of the house', () => {
    expect(blocked(0.5, 0.5)).toBe(true);
    expect(blocked(-1, 5)).toBe(true);
    expect(blocked(5, ROWS + 1)).toBe(true);
    expect(blocked(20.5, 6.5)).toBe(true); // the sofa
    expect(blocked(10.5, 8.5)).toBe(false); // the bucket is clutter, stepped round
    expect(blocked(13.5, 4.25)).toBe(false); // right up against the kitchen bench
    expect(blocked(13.5, 4.1)).toBe(true); // but not into it
    expect(roomAt(0.5, 0.5)).toBeNull();
  });

  it('counts the mat and nothing beside it', () => {
    expect(onDoorMat(MAT_CENTRE.x, MAT_CENTRE.y)).toBe(true);
    expect(onDoorMat(MAT_CENTRE.x, MAT_CENTRE.y + 1)).toBe(false);
  });

  it('lets a person walk from the start to the mat, every room and every item', () => {
    const cells = walkable();
    expect(cells.has(`${Math.floor(MAT_CENTRE.x)},${Math.floor(MAT_CENTRE.y)}`)).toBe(true);
    const rooms = new Set([...cells].map((key) => roomAt(...(key.split(',').map((n) => Number(n) + 0.5) as [number, number]))));
    expect(rooms.size).toBe(new Set(Object.values(ROOM_OF)).size);
    for (const item of DRILL_ITEMS) {
      const inReach = [...cells].some((key) => {
        const [x, y] = key.split(',').map(Number);
        return Math.hypot(x + 0.5 - item.x, y + 0.5 - item.y) <= REACH;
      });
      expect(inReach, item.id).toBe(true);
    }
  });

  it('draws a thing on furniture just after the furniture, and stops at a wall', () => {
    expect(restingOrder(21.5, 20.5)).toBe(20.5); // open floor sorts where it stands
    expect(restingOrder(2.6, 17.9)).toBeCloseTo(19.01); // a pillow on the two row bed
    expect(restingOrder(25.6, 8.2)).toBeCloseTo(9.01); // photos on a sideboard above a wall
    expect(restingOrder(0.5, 0.5)).toBeCloseTo(1.01); // inside a wall, with wall below
  });

  it('never blocks the middle of a floor tile that has no furniture on it', () => {
    const covered = new Set<string>();
    for (const piece of FURNITURE) {
      if (piece.flat || piece.wall || piece.loose) continue;
      for (let y = piece.y; y < piece.y + piece.h; y++) for (let x = piece.x; x < piece.x + piece.w; x++) covered.add(`${x},${y}`);
    }
    const pinched: string[] = [];
    GRID.forEach((row, y) => [...row].forEach((cell, x) => {
      if (cell in ROOM_OF && !covered.has(`${x},${y}`) && blocked(x + 0.5, y + 0.5)) pinched.push(`${x},${y}`);
    }));
    expect(pinched).toEqual([]);
  });
});
