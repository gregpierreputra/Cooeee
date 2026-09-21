// Bakes the drill's pictures from the LimeZu Modern Interiors pack in
// game-assets/ (not in the repository: the licence forbids passing it on).
// Writes public/drill/house.png (floors and walls painted from the layout),
// public/drill/sprites.png (only the frames the game uses) and
// src/ui/Drill/atlas.ts (where each frame sits). Run: npm run build:drill:art
// Add a folder to also get preview.png, the whole house with its furniture:
//   node scripts/build-drill-art.mjs /tmp/somewhere

/* global Image, document -- the function given to page.evaluate runs in the browser */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { DRILL_ITEMS } from '../src/core/drill-items.ts';
import { FURNITURE, GRID, ROOM_OF, TILE, wallLift } from '../src/core/drill-layout.ts';

const pack = new URL('../game-assets/', import.meta.url);
if (!existsSync(pack)) throw new Error('game-assets/ is missing. The pack is bought from limezu.itch.io.');

const themes = '1_Interiors/16x16/Theme_Sorter_Shadowless/';
const SHEETS = {
  floors: '1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_Floors_16x16.png',
  walls: '1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_Walls_16x16.png',
  generic: `${themes}1_Generic_Shadowless.png`,
  living: `${themes}2_LivingRoom_Shadowless.png`,
  bathroom: `${themes}3_Bathroom_Shadowless.png`,
  bedroom: `${themes}4_Bedroom_Shadowless.png`,
  classroom: `${themes}5_Classroom_and_library_Shadowless.png`,
  music: `${themes}6_Music_and_sport_Shadowless.png`,
  fishing: `${themes}9_Fishing_Shadowless.png`,
  kitchen: `${themes}12_Kitchen_Shadowless.png`,
  conference: `${themes}13_Conference_Hall_Shadowless.png`,
  basement: `${themes}14_Basement_Shadowless.png`,
  grocery: `${themes}16_Grocery_store_Shadowless.png`,
  jail: `${themes}18_Jail_Shadowless.png`,
  hospital: `${themes}19_Hospital_Shadowless.png`,
  clothing: `${themes}21_Clothing_Store_Shadowless.png`,
  figure: '2_Characters/Character_Generator/0_Premade_Characters/16x16/Premade_Character_01.png',
  door: '3_Animated_objects/16x16/spritesheets/animated_door_big_1.png',
  report: '3_Animated_objects/16x16/spritesheets/animated_TV_reportage.png',
  cat: '3_Animated_objects/16x16/spritesheets/animated_cat.png',
  ui: '4_User_Interface_Elements/UI_16x16.png',
};

// Every sprite the game draws: [sheet, x, y, width, height, frames]. Frames
// run left to right on the sheet. The keys are the furniture sprite names in
// drill-layout.ts and the item ids in drill-items.ts.
const SOURCES = {
  // the figure: 6 frames for each of right, up, left, down (12 for pick up)
  idle: ['figure', 0, 32, 16, 32, 24],
  walk: ['figure', 0, 64, 16, 32, 24],
  pick: ['figure', 0, 288, 16, 32, 48],
  cat: ['cat', 0, 0, 48, 16, 12],
  arrow: ['ui', 48, 16, 16, 16],
  // furniture and the things that make a home look lived in
  door: ['door', 0, 0, 16, 48, 5],
  window: ['generic', 131, 695, 25, 20],
  landscape: ['generic', 5, 218, 21, 13],
  frameA: ['living', 2, 490, 13, 15],
  frameB: ['living', 2, 522, 13, 15],
  frameC: ['living', 34, 426, 13, 15],
  worldMap: ['living', 160, 361, 32, 19],
  hangingPlant: ['bathroom', 0, 22, 16, 18],
  rug: ['generic', 131, 211, 41, 28],
  greenRug: ['generic', 147, 499, 26, 28],
  kidRug: ['generic', 180, 169, 24, 18],
  kitchenRug: ['kitchen', 17, 433, 30, 30],
  bathMat: ['bathroom', 195, 59, 26, 15],
  doormat: ['conference', 224, 65, 16, 11],
  shoes: ['clothing', 202, 200, 12, 8],
  toyCar: ['bedroom', 99, 1205, 9, 7],
  tvUnit: ['living', 80, 245, 32, 21],
  table: ['basement', 20, 8, 24, 23],
  sofa: ['basement', 193, 182, 47, 20],
  armchair: ['basement', 43, 532, 19, 26],
  bookshelf: ['classroom', 131, 315, 25, 30],
  fern: ['living', 192, 8, 16, 30],
  palm: ['living', 213, 0, 23, 30],
  bushyPlant: ['living', 215, 360, 18, 15],
  smallPlant: ['living', 242, 360, 13, 17],
  basket: ['living', 1, 396, 15, 15],
  standMirror: ['living', 134, 360, 20, 31],
  globe: ['living', 193, 360, 13, 13],
  sideboard: ['living', 19, 245, 27, 23],
  nightstand: ['living', 16, 213, 16, 20],
  fridge: ['kitchen', 208, 602, 13, 37],
  cabinet: ['kitchen', 162, 118, 29, 14],
  sink: ['kitchen', 133, 113, 24, 14],
  stove: ['kitchen', 128, 178, 16, 28],
  dining: ['kitchen', 57, 240, 30, 41],
  chair: ['kitchen', 66, 177, 13, 21],
  chairLeft: ['kitchen', 65, 209, 13, 21],
  washer: ['bathroom', 198, 12, 20, 28],
  shelf: ['bathroom', 194, 151, 28, 33],
  washing: ['bathroom', 227, 53, 27, 26],
  bucket: ['fishing', 241, 25, 13, 13],
  toilet: ['bathroom', 161, 7, 14, 33],
  tub: ['bathroom', 99, 195, 25, 37],
  bench: ['fishing', 33, 180, 46, 24],
  rods: ['fishing', 152, 204, 32, 30],
  pingPong: ['basement', 7, 195, 33, 52],
  boxes: ['hospital', 32, 147, 15, 25],
  bed: ['generic', 124, 0, 40, 32],
  singleBed: ['generic', 176, 2, 16, 30],
  desk: ['generic', 85, 104, 38, 21],
  officeChair: ['jail', 162, 355, 12, 24],
  dresser: ['bedroom', 129, 1144, 14, 18],
  drum: ['music', 166, 188, 20, 19],
  teddy: ['bedroom', 1, 1050, 15, 15],
  // the thirty things, each the closest look alike the art set holds
  photos: ['living', 2, 458, 13, 15],
  television: ['report', 0, 0, 48, 23, 24],
  console: ['basement', 32, 754, 19, 16],
  painting: ['generic', 66, 219, 28, 13],
  boardgame: ['bedroom', 128, 1204, 16, 22],
  lamp: ['living', 176, 183, 15, 25],
  water: ['kitchen', 196, 217, 9, 17],
  kettle: ['kitchen', 197, 483, 11, 10],
  pet: ['bathroom', 230, 0, 18, 15],
  plant: ['living', 2, 86, 12, 14],
  blanket: ['bedroom', 70, 804, 16, 18],
  batteries: ['grocery', 144, 208, 13, 7],
  sanitiser: ['bedroom', 51, 1153, 9, 10],
  torch: ['jail', 0, 167, 10, 9],
  radio: ['fishing', 49, 26, 15, 13],
  toolbox: ['fishing', 1, 193, 30, 15],
  medicines: ['hospital', 132, 496, 11, 11],
  overnight: ['clothing', 225, 209, 14, 14],
  pillow: ['living', 233, 482, 13, 13],
  clothes: ['clothing', 98, 253, 13, 16],
  firstaid: ['jail', 225, 73, 14, 13],
  masks: ['bathroom', 51, 2, 11, 8],
  papers: ['hospital', 48, 41, 16, 12],
  laptop: ['jail', 144, 231, 15, 12],
  memorystick: ['hospital', 185, 501, 11, 10],
  books: ['classroom', 194, 246, 13, 11],
  cash: ['clothing', 195, 211, 10, 6],
  charger: ['generic', 167, 665, 16, 12],
  guitar: ['music', 112, 45, 15, 30],
  football: ['music', 178, 138, 11, 11],
};

// How each room is dressed: the top left tile of its floor swatch and of its
// wall style on the Room Builder sheets. This is art, not physics, so it stays
// here rather than in the layout.
const timber = { floor: [0, 12], wall: [0, 6] };
const STYLES = {
  l: timber, k: timber, h: timber, '+': timber, '@': timber,
  g: { floor: [4, 32], wall: [0, 30] },
  u: { floor: [12, 4], wall: [0, 4] },
  m: { floor: [4, 6], wall: [0, 8] },
  b: { floor: [8, 24], wall: [22, 14] },
  s: { floor: [4, 12], wall: [0, 12] },
  c: { floor: [12, 2], wall: [22, 8] },
};

for (const key of [...FURNITURE.map((piece) => piece.sprite), ...DRILL_ITEMS.map((item) => item.id)]) {
  if (!SOURCES[key]) throw new Error(`no source picture for "${key}"`);
}

const images = Object.fromEntries(
  Object.entries(SHEETS).map(([key, path]) => [
    key,
    `data:image/png;base64,${readFileSync(new URL(path, pack)).toString('base64')}`,
  ]),
);

const browser = await chromium.launch();
const page = await browser.newPage();
const baked = await page.evaluate(
  async ({ images, SOURCES, STYLES, GRID, ROOM_OF, FURNITURE, ITEMS, TILE, LIFTS }) => {
    const sheets = {};
    for (const [key, data] of Object.entries(images)) {
      sheets[key] = new Image();
      sheets[key].src = data;
      await sheets[key].decode();
    }
    const canvasOf = (width, height) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      return { canvas, ctx };
    };

    // ── the sprite sheet: one row per sprite, packed top to bottom ──
    // Two clear pixels round every row, so the game's one pixel outline of
    // one sprite never picks up the edge of the next.
    const width = Math.max(...Object.values(SOURCES).map(([, , , w, , frames = 1]) => w * frames)) + 2;
    const height = Object.values(SOURCES).reduce((sum, [, , , , h]) => sum + h + 2, 1);
    const sprites = canvasOf(width, height);
    const atlas = {};
    let top = 1;
    for (const [key, [sheet, x, y, w, h, frames = 1]] of Object.entries(SOURCES)) {
      sprites.ctx.drawImage(sheets[sheet], x, y, w * frames, h, 1, top, w * frames, h);
      atlas[key] = frames > 1 ? [1, top, w, h, frames] : [1, top, w, h];
      top += h + 2;
    }

    // ── the house: floors, wall faces, wall tops, then the flat rugs ──
    const rows = GRID.length;
    const cols = GRID[0].length;
    const cell = (x, y) => GRID[y]?.[x] ?? '#';
    const isFloor = (x, y) => cell(x, y) in ROOM_OF;
    // A wall cell shows a wall FACE when floor lies one or two cells below it.
    const faceOf = (x, y) => {
      if (isFloor(x, y)) return null;
      if (isFloor(x, y + 1)) return { room: cell(x, y + 1), row: 1 };
      if (!isFloor(x, y + 1) && isFloor(x, y + 2)) return { room: cell(x, y + 2), row: 0 };
      return null;
    };
    const house = canvasOf(cols * TILE, rows * TILE);
    const tile = (sheet, tx, ty, x, y) =>
      house.ctx.drawImage(sheets[sheet], tx * TILE, ty * TILE, TILE, TILE, x * TILE, y * TILE, TILE, TILE);
    house.ctx.fillStyle = '#1d2033';
    house.ctx.fillRect(0, 0, cols * TILE, rows * TILE);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (isFloor(x, y)) {
          // The swatch carries its own shadow tiles for under a wall and beside one.
          const [fx, fy] = STYLES[cell(x, y)].floor;
          tile('floors', fx + (isFloor(x - 1, y) ? 1 : 0), fy + (isFloor(x, y - 1) ? 1 : 0), x, y);
          continue;
        }
        const face = faceOf(x, y);
        if (face) {
          const [wx, wy] = STYLES[face.room].wall;
          const left = faceOf(x - 1, y)?.row !== face.row;
          const right = faceOf(x + 1, y)?.row !== face.row;
          tile('walls', wx + (left ? 0 : right ? 2 : 1), wy + face.row, x, y);
          continue;
        }
        // A wall TOP: cream where it borders a room, so rooms read as outlined.
        let bordersRoom = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (isFloor(x + dx, y + dy) || faceOf(x + dx, y + dy)) bordersRoom = true;
          }
        }
        if (bordersRoom) {
          house.ctx.fillStyle = '#e4dcc8';
          house.ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
      }
    }
    // A thin dark line where a wall top meets floor, as the pack's own rooms have.
    house.ctx.fillStyle = '#4a4560';
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (isFloor(x, y) || faceOf(x, y)) continue;
        if (isFloor(x + 1, y) || faceOf(x + 1, y)) house.ctx.fillRect((x + 1) * TILE - 1, y * TILE, 1, TILE);
        if (isFloor(x - 1, y) || faceOf(x - 1, y)) house.ctx.fillRect(x * TILE, y * TILE, 1, TILE);
        if (isFloor(x, y - 1)) house.ctx.fillRect(x * TILE, y * TILE, TILE, 1);
        if (faceOf(x, y + 1)) house.ctx.fillRect(x * TILE, (y + 1) * TILE - 1, TILE, 1);
      }
    }
    const place = (ctx, key, centreX, bottomY) => {
      const [x, y, w, h] = atlas[key];
      ctx.drawImage(sprites.canvas, x, y, w, h, Math.round(centreX - w / 2), Math.round(bottomY - h), w, h);
    };
    const drawPiece = (ctx, piece) =>
      place(ctx, piece.sprite, (piece.x + piece.w / 2) * TILE + (piece.nudge ?? 0), (piece.y + piece.h) * TILE - (piece.wall ? LIFTS[piece.sprite] : 0));
    for (const piece of FURNITURE) if (piece.flat) drawPiece(house.ctx, piece);

    // ── the preview: the house as the game will compose it ──
    const preview = canvasOf(cols * TILE * 2, rows * TILE * 2);
    const scratch = canvasOf(cols * TILE, rows * TILE);
    scratch.ctx.drawImage(house.canvas, 0, 0);
    const standing = [
      ...FURNITURE.filter((piece) => !piece.flat).map((piece) => ({ y: piece.y + piece.h, draw: () => drawPiece(scratch.ctx, piece) })),
      ...ITEMS.map((item) => ({ y: item.y + 1, draw: () => place(scratch.ctx, item.id, item.x * TILE, item.y * TILE) })),
    ].sort((a, b) => a.y - b.y);
    for (const thing of standing) thing.draw();
    preview.ctx.drawImage(scratch.canvas, 0, 0, cols * TILE * 2, rows * TILE * 2);

    return {
      atlas,
      sheet: [width, height],
      house: house.canvas.toDataURL('image/png'),
      sprites: sprites.canvas.toDataURL('image/png'),
      preview: preview.canvas.toDataURL('image/png'),
    };
  },
  { images, SOURCES, STYLES, GRID, ROOM_OF, FURNITURE, ITEMS: DRILL_ITEMS, TILE, LIFTS: Object.fromEntries(Object.entries(SOURCES).map(([key, source]) => [key, wallLift(source[4])])) },
);
await browser.close();

const bytesOf = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64');
const outDir = new URL('../public/drill/', import.meta.url);
mkdirSync(outDir, { recursive: true });
for (const name of ['house', 'sprites']) {
  const bytes = bytesOf(baked[name]);
  // The service worker leaves out any file over 2 MiB without saying so, and
  // the drill must open with no signal. Half of that is the ceiling here.
  if (bytes.length >= 1024 * 1024) throw new Error(`${name}.png is ${bytes.length} bytes, too large to precache`);
  writeFileSync(new URL(`${name}.png`, outDir), bytes);
  console.log(`public/drill/${name}.png`, bytes.length, 'bytes');
}

const lines = Object.entries(baked.atlas).map(([key, frame]) => `  ${key}: [${frame.join(', ')}],`);
writeFileSync(
  new URL('../src/ui/Drill/atlas.ts', import.meta.url),
  `// GENERATED by scripts/build-drill-art.mjs. Do not edit by hand.
// Where each picture sits on public/drill/sprites.png: [x, y, width, height]
// and, for a strip, how many frames run to the right of the first.
// Art: Modern Interiors by LimeZu, limezu.itch.io.
export type Frame = readonly [number, number, number, number, number?];

export const ATLAS: Record<string, Frame> = {
${lines.join('\n')}
};

/** The size of the whole sheet, for drawing one sprite as a css background. */
export const SHEET = [${baked.sheet.join(', ')}] as const;
`,
);
console.log('src/ui/Drill/atlas.ts', lines.length, 'sprites');

if (process.argv[2]) {
  writeFileSync(`${process.argv[2]}/preview.png`, bytesOf(baked.preview));
  console.log(`${process.argv[2]}/preview.png`);
}
