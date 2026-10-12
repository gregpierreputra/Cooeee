// Adds the drill twists' hand drawn things (scripts/drill-twist-sprites.mjs)
// to the drill's sprite sheet, below the pack's own frames, and their places
// to src/core/drill-atlas.ts. It needs no art pack, so it runs on any machine,
// and it can run again: any twist sprite already on the sheet is replaced.
// build-drill-art.mjs runs it after a full rebuild, so they are never lost.
// Run: npm run build:drill:twist-art

import { readFileSync, writeFileSync } from 'node:fs';
import { ATLAS, SHEET } from '../src/core/drill-atlas.ts';
import { decodePng, drawRows, encodePng, picture } from './pixel-png.mjs';
import { PALETTE, SPRITES } from './drill-twist-sprites.mjs';

const sheetUrl = new URL('../public/drill/sprites.png', import.meta.url);
const atlasUrl = new URL('../src/core/drill-atlas.ts', import.meta.url);

// The pack's own frames, without any twist sprite from a run before.
const kept = Object.entries(ATLAS).filter(([key]) => !(key in SPRITES));
const base = Math.max(...kept.map(([, [, y, , h]]) => y + h + 2));
const before = decodePng(readFileSync(sheetUrl));
if (before.width !== SHEET[0] || before.height !== SHEET[1]) throw new Error('sprites.png and drill-atlas.ts disagree; rebuild the drill art first');

const width = Math.max(before.width, ...Object.values(SPRITES).map((rows) => rows[0].length + 2));
const height = Object.values(SPRITES).reduce((sum, rows) => sum + rows.length + 2, base);
const sheet = picture(width, height);
sheet.blit(before, 0, 0, before.width, Math.min(base, before.height), 0, 0);

const atlas = Object.fromEntries(kept);
let top = base;
for (const [key, rows] of Object.entries(SPRITES)) {
  rows.forEach((row, j) => {
    if (row.length !== rows[0].length) throw new Error(`${key}: row ${j} is ${row.length} wide`);
  });
  drawRows(sheet, rows, PALETTE, 1, top);
  atlas[key] = [1, top, rows[0].length, rows.length];
  top += rows.length + 2;
}

const bytes = encodePng(width, height, sheet.rgba);
if (bytes.length >= 1024 * 1024) throw new Error(`sprites.png is ${bytes.length} bytes, too large to precache`);
writeFileSync(sheetUrl, bytes);

// The atlas file keeps its header; only the entries and the sheet size change.
const source = readFileSync(atlasUrl, 'utf8');
const head = source.slice(0, source.indexOf('export const ATLAS'));
const lines = Object.entries(atlas).map(([key, frame]) => `  ${key}: [${frame.join(', ')}],`);
writeFileSync(
  atlasUrl,
  `${head.replace('Do not edit by hand.', 'Do not edit by hand.\n// The twists\' own things are added by scripts/drill-twist-art.mjs.').replace(/\n\/\/ The twists' own things are added by scripts\/drill-twist-art\.mjs\.(?=\n\/\/ The twists')/, '')}export const ATLAS: Record<string, Frame> = {
${lines.join('\n')}
};

/** The size of the whole sheet, for drawing one sprite as a css background. */
export const SHEET = [${width}, ${height}] as const;
`,
);
console.log('public/drill/sprites.png', bytes.length, 'bytes;', Object.keys(SPRITES).length, 'twist sprites from y', base);
