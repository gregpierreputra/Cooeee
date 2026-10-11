// Bakes Ready the Block's pictures from the hand drawn sprites beside this
// script and the yard's layout. No art pack is needed: every pixel is drawn
// here or in the sprite modules, in the LimeZu manner.
// Writes public/block/yard.png (the ground, painted from BLOCK_GRID),
// public/block/sprites.png (every sprite, one row each) and
// src/core/block-atlas.ts (where each sprite sits). Run: npm run build:block:art
// Add a folder to also get preview-hazards.png and preview-cleared.png: the
// whole yard with every risk out, and with every risk dealt with.
//   node scripts/block-art/build-block-art.mjs /tmp/somewhere

import { mkdirSync, writeFileSync } from 'node:fs';
import { BLOCK_DECOYS, BLOCK_HAZARDS } from '../../src/core/block-hazards.ts';
import { BLOCK_GRID, BLOCK_SCENERY, BLOCK_TILE } from '../../src/core/block-layout.ts';
import { drawRows, encodePng, picture } from '../pixel-png.mjs';
import { PALETTE } from './palette.mjs';
import { SPRITES as HOUSE } from './sprites-house.mjs';
import { SPRITES as PROPS } from './sprites-props.mjs';
import { SPRITES as YARD } from './sprites-yard.mjs';

const SPRITES = { ...HOUSE, ...YARD, ...PROPS };
const TILE = BLOCK_TILE;
const ROWS = BLOCK_GRID.length;
const COLS = BLOCK_GRID[0].length;
const P = PALETTE;

// Every sprite the game names must be drawn, and drawn square.
const needed = new Set([
  ...BLOCK_HAZARDS.flatMap((hazard) => [hazard.sprite, hazard.cleared].filter(Boolean)),
  ...BLOCK_DECOYS.map((decoy) => decoy.sprite),
  ...BLOCK_SCENERY.map((piece) => piece.sprite),
]);
for (const key of needed) if (!SPRITES[key]) throw new Error(`no sprite drawn for ${key}`);
for (const [key, sprite] of Object.entries(SPRITES)) {
  const width = sprite.rows[0].length;
  sprite.rows.forEach((row, j) => {
    if (row.length !== width) throw new Error(`${key}: row ${j} is ${row.length} wide, not ${width}`);
  });
}

// ── the ground ──────────────────────────────────────────────────────────────

/** A steady pseudo random number, 0 to 1, for a pixel: so the grass and the
 *  gravel are speckled the same way every time the picture is baked. */
const noise = (x, y, salt = 0) => {
  let h = (x * 374761393 + y * 668265263 + salt * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const cell = (x, y) => BLOCK_GRID[y]?.[x] ?? ' ';

const yard = picture(COLS * TILE, ROWS * TILE);
const px = (x, y, colour) => yard.set(x, y, colour);

/** Paint one tile's pixels with `paint(i, j)` returning a colour, where (i, j)
 *  is the pixel inside the tile and (gx, gy) the pixel in the whole yard. */
const paintTile = (tx, ty, paint) => {
  for (let j = 0; j < TILE; j++) {
    for (let i = 0; i < TILE; i++) {
      const gx = tx * TILE + i;
      const gy = ty * TILE + j;
      px(gx, gy, paint(i, j, gx, gy));
    }
  }
};

const LAWN_LIGHT = [128, 188, 98];
const TILES = {
  // lawn: green, with darker blades and a few lighter tufts
  g: (i, j, gx, gy) => {
    const n = noise(gx, gy, 1);
    return n < 0.07 ? P.e : n > 0.96 ? LAWN_LIGHT : P.E;
  },
  // concrete, with a joint every two tiles and a few specks
  d: (i, j, gx, gy) => (gx % 32 === 0 || gy % 32 === 0 ? P.c : noise(gx, gy, 2) < 0.04 ? P.c : P.C),
  f: (i, j, gx, gy) => (gx % 24 === 0 || j === 0 ? P.c : noise(gx, gy, 3) < 0.03 ? P.c : P.C),
  // gravel: a pale bed with a few grey stones, quiet beside the house
  v: (i, j, gx, gy) => {
    const n = noise(gx >> 1, gy >> 1, 4);
    return n < 0.12 ? P.g : n < 0.2 ? P.w : P.C;
  },
  // garden bed: soil with darker clods
  b: (i, j, gx, gy) => (noise(gx >> 1, gy >> 1, 5) < 0.3 ? P.s : P.S),
  // pavers: 8 px squares, grout between
  p: (i, j) => (i % 8 === 0 || j % 8 === 0 ? P.c : P.C),
  // road: asphalt with specks
  r: (i, j, gx, gy) => (noise(gx, gy, 6) < 0.08 ? P.g : P.G),
};

for (let ty = 0; ty < ROWS; ty++) {
  for (let tx = 0; tx < COLS; tx++) {
    const letter = cell(tx, ty);
    if (TILES[letter]) paintTile(tx, ty, TILES[letter]);
  }
}

// The road's centre line, dashed, along the top of its second row.
for (let x = 0; x < COLS * TILE; x++) {
  if (x % 24 < 12) {
    px(x, 27 * TILE - 1, P.W);
    px(x, 27 * TILE, P.W);
  }
}

// The kerb: a concrete lip over the gutter of the road.
const driveway = (tx) => cell(tx, 23) === 'd';
for (let tx = 0; tx < COLS; tx++) {
  if (cell(tx, 25) !== 'c') continue;
  // Where the driveway meets the road the kerb dips: a paler, lower lip.
  paintTile(tx, 25, (i, j) => (driveway(tx) ? (j < 3 ? P.C : j === 3 ? P.c : P.G) : j < 5 ? (j === 4 ? P.O : P.C) : j < 7 ? P.c : P.G));
}
// The footpath crossing the driveway: concrete a shade darker, edged.
for (let tx = 0; tx < COLS; tx++) {
  if (!driveway(tx) || cell(tx, 24) !== 'f') continue;
  paintTile(tx, 24, (i, j, gx, gy) => (j === 0 ? P.O : gx % 32 === 0 ? P.c : noise(gx, gy, 7) < 0.05 ? P.C : P.c));
}

// The fence: timber palings with a darker cap, round the back and the sides.
for (let ty = 0; ty < ROWS; ty++) {
  for (let tx = 0; tx < COLS; tx++) {
    if (cell(tx, ty) !== 'F') continue;
    const side = tx === 0 || tx === COLS - 1;
    paintTile(tx, ty, (i, j) => {
      if (side) return i === 0 || i === 15 ? P.O : i % 4 === 0 ? P.t : P.T;
      return j === 0 || j === 15 ? P.O : j < 3 ? P.B : i % 4 === 0 ? P.t : P.T;
    });
  }
}

/** The house roof: terracotta tiles in courses, the back eave and its gutter
 *  along the top, a ridge cap, and the front gutter along the bottom. */
const roofTop = BLOCK_GRID.findIndex((row) => row.includes('R'));
const roofBottom = BLOCK_GRID.findLastIndex((row) => row.includes('R'));
const roofLeft = BLOCK_GRID[roofTop].indexOf('R');
const roofRight = BLOCK_GRID[roofTop].lastIndexOf('R');
const ridge = roofTop * TILE + 3 * TILE + 8;
for (let gy = roofTop * TILE; gy < (roofBottom + 1) * TILE; gy++) {
  for (let gx = roofLeft * TILE; gx < (roofRight + 1) * TILE; gx++) {
    const course = Math.floor((gy - roofTop * TILE) / 5);
    const across = (gx + (course % 2) * 4) % 8;
    // Charcoal tiles, so dry leaves, branches and vents stand out against them.
    let colour = (gy - roofTop * TILE) % 5 === 4 ? P.j : across === 0 ? P.j : P.J;
    if (Math.abs(gy - ridge) <= 2) colour = gy - ridge === 2 ? P.O : P.j; // the ridge cap
    px(gx, gy, colour);
  }
}
for (let gx = roofLeft * TILE; gx < (roofRight + 1) * TILE; gx++) {
  // back gutter
  px(gx, roofTop * TILE, P.O);
  px(gx, roofTop * TILE + 1, P.M);
  px(gx, roofTop * TILE + 2, P.m);
  // front gutter
  const bottom = (roofBottom + 1) * TILE;
  px(gx, bottom - 4, P.O);
  px(gx, bottom - 3, P.M);
  px(gx, bottom - 2, P.M);
  px(gx, bottom - 1, P.m);
}
for (let gy = roofTop * TILE; gy < (roofBottom + 1) * TILE; gy++) {
  px(roofLeft * TILE, gy, P.O);
  px(roofLeft * TILE + 1, gy, P.j);
  px((roofRight + 1) * TILE - 2, gy, P.j);
  px((roofRight + 1) * TILE - 1, gy, P.O);
}

/** The house's front wall: cream weatherboards, shade under the eaves, a
 *  skirting at the foot. */
for (let ty = 0; ty < ROWS; ty++) {
  for (let tx = 0; tx < COLS; tx++) {
    if (cell(tx, ty) !== 'W') continue;
    const top = cell(tx, ty - 1) !== 'W';
    const foot = cell(tx, ty + 1) !== 'W';
    paintTile(tx, ty, (i, j) => {
      if (top && j < 3) return P.q;
      if (foot && j === 15) return P.O;
      if (foot && j >= 13) return P.G;
      if ((tx === roofLeft && i === 0) || (tx === roofRight && i === 15)) return P.O;
      return j % 4 === 3 ? P.q : P.Q;
    });
  }
}

/** The deck: timber boards running across, the front edge darker. */
for (let ty = 0; ty < ROWS; ty++) {
  for (let tx = 0; tx < COLS; tx++) {
    if (cell(tx, ty) !== 'k') continue;
    const front = cell(tx, ty + 1) !== 'k';
    paintTile(tx, ty, (i, j, gx) => {
      if (front && j === 15) return P.O;
      if (front && j >= 13) return P.t;
      if (j % 4 === 3) return P.t;
      return (gx + j * 7) % 37 === 0 ? P.t : P.T;
    });
  }
}

/** The shed: a grey corrugated roof with its gutter, and a ribbed wall. */
for (let ty = 0; ty < ROWS; ty++) {
  for (let tx = 0; tx < COLS; tx++) {
    const letter = cell(tx, ty);
    if (letter === 'S') {
      const top = cell(tx, ty - 1) !== 'S';
      const bottom = cell(tx, ty + 1) !== 'S';
      paintTile(tx, ty, (i, j, gx) => {
        if (top && j === 0) return P.O;
        if (bottom && j === 15) return P.O;
        if (bottom && j >= 13) return P.m;
        if ((cell(tx - 1, ty) !== 'S' && i === 0) || (cell(tx + 1, ty) !== 'S' && i === 15)) return P.O;
        return gx % 3 === 0 ? P.m : P.M;
      });
    } else if (letter === 'T') {
      const foot = cell(tx, ty + 1) !== 'T';
      paintTile(tx, ty, (i, j, gx) => {
        if (foot && j === 15) return P.O;
        if ((cell(tx - 1, ty) !== 'T' && i === 0) || (cell(tx + 1, ty) !== 'T' && i === 15)) return P.O;
        return gx % 3 === 0 ? P.G : P.m;
      });
    }
  }
}

// ── the sprites, one row each, with room between so outlines never touch ──

const keys = Object.keys(SPRITES).sort();
const sheetWidth = Math.max(...keys.map((key) => SPRITES[key].rows[0].length)) + 2;
const sheetHeight = keys.reduce((sum, key) => sum + SPRITES[key].rows.length + 2, 1);
const sheet = picture(sheetWidth, sheetHeight);
const atlas = {};
let top = 1;
for (const key of keys) {
  const { rows } = SPRITES[key];
  drawRows(sheet, rows, PALETTE, 1, top);
  atlas[key] = [1, top, rows[0].length, rows.length];
  top += rows.length + 2;
}

const write = (path, image) => {
  const bytes = encodePng(image.width, image.height, image.rgba);
  // The service worker leaves out any file over 2 MiB without saying so, and
  // the game must open with no signal. Half of that is the ceiling here.
  if (bytes.length >= 1024 * 1024) throw new Error(`${path} is ${bytes.length} bytes, too large to precache`);
  writeFileSync(path, bytes);
  console.log(path instanceof URL ? path.pathname : path, bytes.length, 'bytes');
};

const outDir = new URL('../../public/block/', import.meta.url);
mkdirSync(outDir, { recursive: true });
write(new URL('yard.png', outDir), yard);
write(new URL('sprites.png', outDir), sheet);

const lines = keys.map((key) => `  ${key}: [${atlas[key].join(', ')}],`);
writeFileSync(
  new URL('../../src/core/block-atlas.ts', import.meta.url),
  `// GENERATED by scripts/block-art/build-block-art.mjs. Do not edit by hand.
// Where each of Ready the Block's sprites sits on public/block/sprites.png:
// [x, y, width, height], in source pixels.

export type BlockFrame = readonly [number, number, number, number];

export const BLOCK_ATLAS: Record<string, BlockFrame> = {
${lines.join('\n')}
};

export const BLOCK_SHEET = [${sheetWidth}, ${sheetHeight}] as const;
`,
);
console.log('src/core/block-atlas.ts', keys.length, 'sprites');

// ── the previews: the yard as the game composes it ──
const previewDir = process.argv[2];
if (previewDir) {
  mkdirSync(previewDir, { recursive: true });
  for (const variant of ['hazards', 'cleared']) {
    const scene = picture(yard.width, yard.height);
    scene.rgba.set(yard.rgba);
    const things = [
      ...BLOCK_SCENERY,
      ...BLOCK_DECOYS,
      ...BLOCK_HAZARDS.map((hazard) => ({ ...hazard, sprite: variant === 'hazards' ? hazard.sprite : hazard.cleared })).filter((thing) => thing.sprite),
    ].sort((a, b) => a.y - b.y);
    for (const thing of things) {
      const [sx, sy, w, h] = atlas[thing.sprite];
      scene.blit({ width: sheetWidth, rgba: sheet.rgba }, sx, sy, w, h, Math.round(thing.x * TILE - w / 2), Math.round(thing.y * TILE - h));
    }
    const big = picture(scene.width * 2, scene.height * 2);
    for (let y = 0; y < big.height; y++) for (let x = 0; x < big.width; x++) big.set(x, y, scene.get(x >> 1, y >> 1));
    writeFileSync(`${previewDir}/preview-${variant}.png`, encodePng(big.width, big.height, big.rgba));
    console.log(`${previewDir}/preview-${variant}.png`);
  }
}
