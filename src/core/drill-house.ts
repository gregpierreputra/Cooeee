// E7 — where the figure can stand. Everything here is worked out from the
// layout the picture is painted from, so a wall on screen is a wall underfoot.
// Positions are in tiles: x across, y down, fractions allowed.

import { ATLAS } from './drill-atlas';
import type { DrillRoom } from './drill-items';
import { FURNITURE, GRID, MAT, ROOM_OF, START, TILE } from './drill-layout';

export const ROWS = GRID.length;
export const COLS = GRID[0].length;

/** How far an arm reaches. */
export const REACH = 1.8;

/** The figure's feet, as a small box round the point it stands on, in tiles:
 *  as wide as the drawn feet, and only a little deep, so it can pass close in
 *  front of furniture the way the picture suggests it can. */
const FEET = { side: 0.25, back: 0.2, front: 0.08 };

/** The floor each piece of furniture really covers: the width of its picture,
 *  and a depth at its base no deeper than its footprint. So what stops the
 *  figure is exactly what the picture shows standing there, never more. Flat
 *  pieces, wall pieces and loose clutter cover no floor. */
type Box = { x0: number; y0: number; x1: number; y1: number };
const BLOCKS: Box[] = FURNITURE.filter((piece) => !piece.flat && !piece.wall && !piece.loose).map((piece) => {
  const [, , width, height] = ATLAS[piece.sprite];
  const centre = (piece.x + piece.w / 2) * TILE + (piece.nudge ?? 0);
  const bottom = (piece.y + piece.h) * TILE;
  const depth = Math.min(height, piece.h * TILE - 4);
  return { x0: (centre - width / 2) / TILE, y0: (bottom - depth) / TILE, x1: (centre + width / 2) / TILE, y1: bottom / TILE };
});

/** True for every cell under a piece of furniture or wall: used only to tell
 *  whether a thing rests on something, for the order things are drawn in. */
const SOLID: boolean[][] = GRID.map((row) => [...row].map((cell) => !(cell in ROOM_OF)));
for (const piece of FURNITURE) {
  if (piece.flat || piece.loose) continue;
  for (let y = piece.y; y < piece.y + piece.h; y++) {
    for (let x = piece.x; x < piece.x + piece.w; x++) SOLID[y][x] = true;
  }
}

const cellAt = (x: number, y: number): string => GRID[Math.floor(y)]?.[Math.floor(x)] ?? '#';

/** Whether (x, y) is on a cell nothing can stand in: furniture or wall. A
 *  thing that sits there is on a bench, a shelf or hung on the wall. */
export const onSolid = (x: number, y: number): boolean => SOLID[Math.floor(y)]?.[Math.floor(x)] ?? true;

/** Where a thing standing at (x, y) sorts when the picture is drawn back to
 *  front. On the floor it sorts by where it stands, like a person. On a bench,
 *  a bed or a wall it sorts just after the whole piece it rests on, so it is
 *  drawn on top of that piece, however many rows the piece covers. */
export function restingOrder(x: number, y: number): number {
  if (!onSolid(x, y)) return y;
  // Walk down through the piece it rests on, stopping at the first cell that
  // is not furniture on a floor: open floor, a wall, or the edge of the house.
  let row = Math.floor(y);
  while (cellAt(x, row + 1) in ROOM_OF && onSolid(x, row + 1)) row += 1;
  return row + 1.01;
}

const isWall = (x: number, y: number): boolean => !(cellAt(x, y) in ROOM_OF);

/** Whether the figure's feet at (x, y) would overlap a wall or furniture. */
export function blocked(x: number, y: number): boolean {
  const x0 = x - FEET.side;
  const x1 = x + FEET.side;
  const y0 = y - FEET.back;
  const y1 = y + FEET.front;
  if (isWall(x0, y0) || isWall(x1, y0) || isWall(x0, y1) || isWall(x1, y1)) return true;
  return BLOCKS.some((box) => x0 < box.x1 && x1 > box.x0 && y0 < box.y1 && y1 > box.y0);
}

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
