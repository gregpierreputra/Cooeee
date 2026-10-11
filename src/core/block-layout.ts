// Ready the Block — the yard as data. ONE source for the picture and the
// taps: scripts/block-art/build-block-art.mjs paints the ground from GRID, and
// the game draws the pieces and the day's things over it from the sprite
// sheet, so what can be tapped is always what can be seen.

/** One tile, in source pixels. The picture is drawn at whole multiples. */
export const BLOCK_TILE = 16;

/** One string per row of tiles, 36 across and 28 down, the back fence at the
 *  top and the road at the bottom:
 *
 *    F fence          g lawn          d concrete (driveway and carport)
 *    v gravel strip   b garden bed    R house roof   W house wall face
 *    k deck           p paved path    S shed roof    T shed wall face
 *    f footpath       c kerb          r road
 */
export const BLOCK_GRID = [
  'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
  'FggggggggggggggggggggggggggSSSSSSggF',
  'FggggggggggggggggggggggggggSSSSSSggF',
  'FggggggggggggggggggggggggggSSSSSSggF',
  'FggggggggggggggggggggggggggTTTTTTggF',
  'FggggggggggggggggggggggggggTTTTTTggF',
  'FddddddvRRRRRRRRRRRRRRRRRRRvgggggggF',
  'FddddddvRRRRRRRRRRRRRRRRRRRvgggggggF',
  'FddddddvRRRRRRRRRRRRRRRRRRRvgggggggF',
  'FddddddvRRRRRRRRRRRRRRRRRRRvgggggggF',
  'FddddddvRRRRRRRRRRRRRRRRRRRvgggggggF',
  'FddddddvRRRRRRRRRRRRRRRRRRRvgggggggF',
  'FddddddvRRRRRRRRRRRRRRRRRRRvgggggggF',
  'FddddddvRRRRRRRRRRRRRRRRRRRvgggggggF',
  'FddddddbWWWWWWWWWWWWWWWWWWWbgggggggF',
  'FddddddbWWWWWWWWWWWWWWWWWWWbgggggggF',
  'FddddddbbbbkkkkkkkkkkkkkkkkbgggggggF',
  'FddddddbbbbkkkkkkkkkkkkkkkkbgggggggF',
  'FdddddgggggggggggppggggggggggggggggF',
  'FdddddgggggggggggppggggggggggggggggF',
  'FdddddgggggggggggppggggggggggggggggF',
  'FdddddgggggggggggppggggggggggggggggF',
  'FdddddgggggggggggppggggggggggggggggF',
  'FdddddgggggggggggppggggggggggggggggF',
  'ffffffffffffffffffffffffffffffffffff',
  'cccccccccccccccccccccccccccccccccccc',
  'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
];

export const BLOCK_COLS = BLOCK_GRID[0].length;
export const BLOCK_ROWS = BLOCK_GRID.length;
export const BLOCK_WIDTH = BLOCK_COLS * BLOCK_TILE;
export const BLOCK_HEIGHT = BLOCK_ROWS * BLOCK_TILE;

/** A thing drawn in the yard: a sprite with the middle of its bottom edge at
 *  (x, y), in tiles. */
export type Placed = { sprite: string; x: number; y: number };

/** The scenery: always there, never a fire risk, never a thing to tap. */
export const BLOCK_SCENERY: Placed[] = [
  { sprite: 'frontDoor', x: 17.5, y: 16.0 },
  { sprite: 'windowScreened', x: 21.5, y: 15.6 },
  { sprite: 'gumTree', x: 4.0, y: 5.9 },
  { sprite: 'gumTree', x: 31.5, y: 21.0 },
];
