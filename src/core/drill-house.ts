// E7 — where the figure can stand. Everything here is worked out from the
// layout the picture is painted from, so a wall on screen is a wall underfoot.
// Positions are in tiles: x across, y down, fractions allowed.

import type { DrillRoom } from './drill-items';
import { FURNITURE, GRID, MAT, ROOM_OF, START } from './drill-layout';

export const ROWS = GRID.length;
export const COLS = GRID[0].length;

/** Half the width of the figure's feet, and how far an arm reaches. */
export const PERSON_RADIUS = 0.3;
export const REACH = 1.5;

/** True for every cell the figure cannot enter: wall, or under furniture. */
const SOLID: boolean[][] = GRID.map((row) => [...row].map((cell) => !(cell in ROOM_OF)));
for (const piece of FURNITURE) {
  if (piece.flat) continue;
  for (let y = piece.y; y < piece.y + piece.h; y++) {
    for (let x = piece.x; x < piece.x + piece.w; x++) SOLID[y][x] = true;
  }
}

const cellAt = (x: number, y: number): string => GRID[Math.floor(y)]?.[Math.floor(x)] ?? '#';

const solidAt = (x: number, y: number): boolean => SOLID[Math.floor(y)]?.[Math.floor(x)] ?? true;

/** Whether feet of this radius at (x, y) would overlap a wall or furniture. */
export const blocked = (x: number, y: number, radius = PERSON_RADIUS): boolean =>
  solidAt(x - radius, y - radius) ||
  solidAt(x + radius, y - radius) ||
  solidAt(x - radius, y + radius) ||
  solidAt(x + radius, y + radius);

export const onDoorMat = (x: number, y: number): boolean => cellAt(x, y) === MAT;

export const roomAt = (x: number, y: number): DrillRoom | null => ROOM_OF[cellAt(x, y)] ?? null;

/** The middle of the first cell holding this mark. */
function centreOf(mark: string): { x: number; y: number } {
  const y = GRID.findIndex((row) => row.includes(mark));
  return { x: GRID[y].indexOf(mark) + 0.5, y: y + 0.5 };
}

export const SPAWN = centreOf(START);
/** Where the door arrow points: the middle cell of the mat. */
export const MAT_CENTRE = { x: centreOf(MAT).x + 1, y: centreOf(MAT).y };
