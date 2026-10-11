// Draws every sprite in one sprite module side by side, four times size, on
// the ground it will stand on, so a drawing can be checked by eye.
// Run: node scripts/block-art/preview-sprites.mjs scripts/block-art/sprites-yard.mjs out.png

import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { drawRows, encodePng, picture } from '../pixel-png.mjs';
import { PALETTE } from './palette.mjs';

const [, , modulePath, out = 'preview.png'] = process.argv;
if (!modulePath) throw new Error('usage: preview-sprites.mjs <sprite module> [out.png]');
const { SPRITES } = await import(pathToFileURL(resolve(modulePath)).href);

const GROUNDS = { lawn: [112, 176, 86], roof: [112, 122, 138], wall: [236, 224, 196], deck: [196, 150, 98], concrete: [204, 198, 184] };
const SCALE = 4;
const PAD = 4;
const entries = Object.entries(SPRITES);
const width = entries.reduce((sum, [, s]) => sum + s.rows[0].length + PAD, PAD);
const height = Math.max(...entries.map(([, s]) => s.rows.length)) + PAD * 2;
const sheet = picture(width, height);
let x = PAD;
for (const [key, sprite] of entries) {
  const w = sprite.rows[0].length;
  const h = sprite.rows.length;
  sprite.rows.forEach((row, j) => {
    if (row.length !== w) throw new Error(`${key}: row ${j} is ${row.length} wide, not ${w}`);
  });
  const ground = GROUNDS[sprite.ground ?? 'lawn'];
  for (let j = -2; j < h + 2; j++) for (let i = -2; i < w + 2; i++) sheet.set(x + i, PAD + j, ground);
  drawRows(sheet, sprite.rows, PALETTE, x, PAD);
  console.log(`${key}: ${w}x${h} at x ${x * SCALE}`);
  x += w + PAD;
}
const big = picture(width * SCALE, height * SCALE);
for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
  const colour = sheet.get(i, j);
  if (!colour[3]) continue;
  for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) big.set(i * SCALE + dx, j * SCALE + dy, colour);
}
writeFileSync(out, encodePng(big.width, big.height, big.rgba));
console.log(`wrote ${out}`);
