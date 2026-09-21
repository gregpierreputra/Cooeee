// E7 — the drill house as data. ONE source for the picture and the physics:
// scripts/build-drill-art.mjs paints floors and walls from GRID, the game draws
// FURNITURE from the sprite sheet, and drill-house.ts builds its solid cells
// from both. So what stops the figure is always what the player can see.

import type { DrillRoom } from './drill-items';

/** One tile of the grid, in source pixels. The art is drawn at whole multiples. */
export const TILE = 16;

/** One string per row of tiles. A room letter is floor, '#' is wall, '+' is the
 *  door mat and '@' is where the figure starts (both living room floor). */
export const GRID = [
  '############################',
  '############################',
  '############################',
  '#ggggg#uuuu#kkkkkkkllll+++l#',
  '#ggggg#uuuu#kkkkkkkllllllll#',
  '#ggggg#uuuu#kkkkkkkllllllll#',
  '#gggggguuuu#kkkkkkkllllllll#',
  '#gggggguuuu#kkkkkkklll@llll#',
  '#ggggg#uuuu#kkkkkkkllllllll#',
  '###gg###uu######lllllll#####',
  '###gg###uu######lllllll#####',
  '###gg###uu######lllllll#####',
  '#hhhhhhhhhhhhhhhhhhhhhhhhhh#',
  '#hhhhhhhhhhhhhhhhhhhhhhhhhh#',
  '####mm####bb####ss#####cc###',
  '####mm####bb####ss#####cc###',
  '####mm####bb####ss#####cc###',
  '#mmmmmmm#bbbb#ssssss#cccccc#',
  '#mmmmmmm#bbbb#ssssss#cccccc#',
  '#mmmmmmm#bbbb#ssssss#cccccc#',
  '#mmmmmmm#bbbb#ssssss#cccccc#',
  '#mmmmmmm#bbbb#ssssss#cccccc#',
  '############################',
];

export const MAT = '+';
export const START = '@';

/** Which room a floor letter belongs to. A cell not listed here is wall. */
export const ROOM_OF: Record<string, DrillRoom> = {
  g: 'garage',
  u: 'laundry',
  k: 'kitchen',
  l: 'living room',
  h: 'hall',
  m: 'main bedroom',
  b: 'bathroom',
  s: 'study',
  c: 'second bedroom',
  [MAT]: 'living room',
  [START]: 'living room',
};

/** One piece of furniture. x, y, w, h are its footprint in whole tiles: the
 *  cells it blocks. The sprite is drawn centred on the footprint and standing
 *  on its bottom edge, so a tall piece rises over the cells behind it. A flat
 *  piece (a rug) is painted into the floor and blocks nothing. */
export type Piece = { sprite: string; x: number; y: number; w: number; h: number; flat?: true };

export const FURNITURE: Piece[] = [
  // living room: the front door and its mat, the television wall, a sofa facing it
  { sprite: 'door', x: 24, y: 2, w: 1, h: 1 },
  { sprite: 'doormat', x: 23, y: 3, w: 1, h: 1, flat: true },
  { sprite: 'doormat', x: 24, y: 3, w: 1, h: 1, flat: true },
  { sprite: 'doormat', x: 25, y: 3, w: 1, h: 1, flat: true },
  { sprite: 'rug', x: 20, y: 5, w: 3, h: 2, flat: true },
  { sprite: 'tvUnit', x: 20, y: 3, w: 2, h: 1 },
  { sprite: 'table', x: 20, y: 5, w: 2, h: 1 },
  { sprite: 'sofa', x: 20, y: 7, w: 2, h: 1 },
  { sprite: 'cushion', x: 24, y: 5, w: 1, h: 1 },
  { sprite: 'armchair', x: 23, y: 5, w: 1, h: 1 },
  { sprite: 'sideboard', x: 25, y: 6, w: 2, h: 1 },
  { sprite: 'fern', x: 26, y: 3, w: 1, h: 1 },
  { sprite: 'palm', x: 26, y: 8, w: 1, h: 1 },
  { sprite: 'bushyPlant', x: 19, y: 8, w: 1, h: 1 },
  { sprite: 'frameA', x: 25, y: 2, w: 1, h: 1 },
  // kitchen
  { sprite: 'window', x: 15, y: 2, w: 2, h: 1 },
  { sprite: 'fridge', x: 12, y: 3, w: 1, h: 1 },
  { sprite: 'cabinet', x: 13, y: 3, w: 2, h: 1 },
  { sprite: 'sink', x: 15, y: 3, w: 2, h: 1 },
  { sprite: 'stove', x: 17, y: 3, w: 1, h: 1 },
  { sprite: 'kitchenRug', x: 14, y: 5, w: 2, h: 2, flat: true },
  { sprite: 'dining', x: 14, y: 5, w: 2, h: 2 },
  { sprite: 'chair', x: 13, y: 6, w: 1, h: 1 },
  { sprite: 'chairLeft', x: 16, y: 6, w: 1, h: 1 },
  { sprite: 'smallPlant', x: 18, y: 3, w: 1, h: 1 },
  // laundry
  { sprite: 'washer', x: 7, y: 3, w: 1, h: 1 },
  { sprite: 'washer', x: 8, y: 3, w: 1, h: 1 },
  { sprite: 'shelf', x: 9, y: 3, w: 2, h: 1 },
  { sprite: 'washing', x: 10, y: 8, w: 1, h: 1 },
  { sprite: 'bucket', x: 7, y: 8, w: 1, h: 1 },
  // garage
  { sprite: 'bench', x: 1, y: 3, w: 3, h: 1 },
  { sprite: 'rods', x: 4, y: 3, w: 2, h: 1 },
  { sprite: 'pingPong', x: 1, y: 5, w: 2, h: 3 },
  { sprite: 'boxes', x: 1, y: 8, w: 1, h: 1 },
  { sprite: 'esky', x: 2, y: 8, w: 1, h: 1 },
  // hall
  { sprite: 'fern', x: 1, y: 12, w: 1, h: 1 },
  { sprite: 'landscape', x: 6, y: 11, w: 1, h: 1 },
  { sprite: 'hallBench', x: 11, y: 12, w: 2, h: 1 },
  { sprite: 'rug', x: 18, y: 12, w: 3, h: 2, flat: true },
  { sprite: 'frameB', x: 13, y: 11, w: 1, h: 1 },
  { sprite: 'frameC', x: 14, y: 11, w: 1, h: 1 },
  { sprite: 'sideboard', x: 25, y: 12, w: 2, h: 1 },
  { sprite: 'shoes', x: 24, y: 12, w: 1, h: 1, flat: true },
  { sprite: 'smallPlant', x: 26, y: 13, w: 1, h: 1 },
  // main bedroom
  { sprite: 'curtains', x: 1, y: 16, w: 2, h: 1 },
  { sprite: 'greenRug', x: 3, y: 20, w: 2, h: 2, flat: true },
  { sprite: 'nightstand', x: 1, y: 17, w: 1, h: 1 },
  { sprite: 'bed', x: 2, y: 17, w: 2, h: 2 },
  { sprite: 'wardrobe', x: 6, y: 17, w: 2, h: 1 },
  { sprite: 'dresser', x: 7, y: 19, w: 1, h: 1 },
  { sprite: 'basket', x: 1, y: 21, w: 1, h: 1 },
  { sprite: 'standMirror', x: 7, y: 21, w: 1, h: 1 },
  // bathroom
  { sprite: 'bathMat', x: 9, y: 20, w: 2, h: 1, flat: true },
  { sprite: 'hangingPlant', x: 9, y: 16, w: 1, h: 1 },
  { sprite: 'toilet', x: 9, y: 17, w: 1, h: 1 },
  { sprite: 'towels', x: 12, y: 17, w: 1, h: 1 },
  { sprite: 'tub', x: 11, y: 20, w: 2, h: 2 },
  { sprite: 'dresser', x: 9, y: 21, w: 1, h: 1 },
  // study
  { sprite: 'rug', x: 16, y: 19, w: 3, h: 2, flat: true },
  { sprite: 'desk', x: 14, y: 17, w: 2, h: 1 },
  { sprite: 'officeChair', x: 15, y: 18, w: 1, h: 1 },
  { sprite: 'bookshelf', x: 18, y: 17, w: 2, h: 1 },
  { sprite: 'sideboard', x: 14, y: 21, w: 2, h: 1 },
  { sprite: 'globe', x: 19, y: 21, w: 1, h: 1 },
  { sprite: 'landscape', x: 19, y: 16, w: 1, h: 1 },
  // second bedroom
  { sprite: 'worldMap', x: 25, y: 16, w: 2, h: 1 },
  { sprite: 'kidRug', x: 22, y: 19, w: 2, h: 2, flat: true },
  { sprite: 'singleBed', x: 21, y: 17, w: 1, h: 2 },
  { sprite: 'nightstand', x: 22, y: 17, w: 1, h: 1 },
  { sprite: 'dresser', x: 25, y: 17, w: 1, h: 1 },
  { sprite: 'drum', x: 26, y: 21, w: 1, h: 1 },
  { sprite: 'teddy', x: 21, y: 21, w: 1, h: 1 },
  { sprite: 'toyCar', x: 24, y: 21, w: 1, h: 1, flat: true },
];
