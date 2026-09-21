// E7 — the opening film. Thirty seconds outside, drawn here in code because the
// art pack holds no outdoors: a home among gum trees as a bushfire arrives and
// grows into a firestorm, while the published facts appear over it one by one.
// Then ten seconds inside the same house the game is played in, drawn by the
// game's own renderer, so the minute starts in that room with no break.
// Everything is worked out from the time alone (no stored particles), so any
// moment can also be drawn as a still picture when the phone asks for less motion.

import { DRILL_FACTS } from '../../core/copy';
import { SPAWN } from '../../core/drill-house';
import { UP } from '../../core/drill-play';
import { drawSprite, type Art, type Scene, type View } from './render';

export const OUTSIDE_SECONDS = 30;
export const POWER_OFF_AT = 36;
export const CUTSCENE_SECONDS = 40;
const FACT_SECONDS = OUTSIDE_SECONDS / DRILL_FACTS.length;

/** Which line is on screen: a fact while outside, then the two lines inside. */
export const beatAt = (t: number): number =>
  t < OUTSIDE_SECONDS ? Math.floor(t / FACT_SECONDS) : t < POWER_OFF_AT ? DRILL_FACTS.length : DRILL_FACTS.length + 1;
export const BEATS = DRILL_FACTS.length + 2;
/** When each beat begins. Next jumps here. */
export const beatStart = (beat: number): number =>
  beat < DRILL_FACTS.length ? beat * FACT_SECONDS : beat === DRILL_FACTS.length ? OUTSIDE_SECONDS : POWER_OFF_AT;
/** The moment shown for each beat as a still picture under reduced motion. */
export const stillAt = (beat: number): number =>
  beat < DRILL_FACTS.length ? (beat + 0.8) * FACT_SECONDS : beat === DRILL_FACTS.length ? 33 : 37.5;

type Colour = [number, number, number];
// The sky from top to horizon, at four stages: calm, smoke, fire, firestorm.
const SKIES: Colour[][] = [
  [[104, 170, 222], [140, 196, 232], [186, 222, 240], [232, 238, 226]],
  [[150, 104, 70], [206, 130, 60], [240, 160, 64], [250, 200, 110]],
  [[38, 14, 16], [86, 22, 18], [160, 44, 20], [236, 110, 30]],
  [[8, 4, 6], [30, 8, 8], [96, 20, 10], [214, 72, 16]],
];
const CHAR: Colour = [22, 12, 14];

const mix = (a: Colour, b: Colour, t: number): Colour => [
  a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t,
];
const rgb = (c: Colour, alpha = 1) => `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${alpha})`;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
/** A steady pseudo random number from 0 to 1 for any seed. */
const chance = (seed: number) => Math.abs(Math.sin(seed * 127.1) * 43758.5453) % 1;

/** A filled circle made of whole pixel rows, so it stays pixel art. */
function blob(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const radius = Math.round(size);
  for (let row = -radius; row <= radius; row++) {
    const half = Math.round(Math.sqrt(radius * radius - row * row));
    ctx.fillRect(Math.round(x) - half, Math.round(y) + row, half * 2, 1);
  }
}

/** A row of flame tongues standing on `base`, yellow at the root, red at the tip. */
function flames(ctx: CanvasRenderingContext2D, from: number, to: number, base: number, height: number, t: number, seed: number): void {
  if (height <= 0) return;
  for (let x = Math.round(from); x < to; x += 2) {
    const flicker = 0.55 + 0.45 * Math.sin(t * 11 + x * 0.9 + seed) * Math.sin(t * 7 + x * 0.37);
    const tall = Math.max(2, height * flicker * (0.6 + 0.4 * chance(x + seed)));
    ctx.fillStyle = '#d8341c';
    ctx.fillRect(x, base - tall, 2, tall);
    ctx.fillStyle = '#f08a24';
    ctx.fillRect(x, base - tall * 0.66, 2, tall * 0.66);
    ctx.fillStyle = '#fbd65a';
    ctx.fillRect(x, base - tall * 0.3, 2, tall * 0.3);
  }
}

function gumTree(ctx: CanvasRenderingContext2D, x: number, ground: number, size: number, sway: number, leaf: Colour, burn: number, t: number): void {
  ctx.fillStyle = rgb(mix([214, 204, 188], CHAR, burn));
  ctx.fillRect(Math.round(x) - 1, ground - size * 2.2, 3, size * 2.2);
  ctx.fillRect(Math.round(x) + 1, ground - size * 1.6, size * 0.6, 2);
  ctx.fillStyle = rgb(leaf);
  blob(ctx, x + sway, ground - size * 2.6, size * 0.9);
  blob(ctx, x - size * 0.7 + sway, ground - size * 2.1, size * 0.6);
  blob(ctx, x + size * 0.8 + sway, ground - size * 2.0, size * 0.65);
  // The crown catches: flames stand on the canopy and grow with the burn.
  if (burn > 0.45) flames(ctx, x - size * 1.3, x + size * 1.4, ground - size * 2.4, size * 2.6 * (burn - 0.35), t, x);
}

/** A low brick house with a steel roof, a verandah and a water tank. */
function house(ctx: CanvasRenderingContext2D, x: number, ground: number, shade: number, glow: number): void {
  const dim = (c: Colour) => rgb(mix(c, CHAR, shade));
  ctx.fillStyle = dim([120, 132, 140]); // water tank
  ctx.fillRect(x - 20, ground - 22, 16, 22);
  ctx.fillStyle = dim([150, 162, 170]);
  ctx.fillRect(x - 20, ground - 24, 16, 3);
  ctx.fillStyle = dim([222, 206, 182]); // brick wall
  ctx.fillRect(x, ground - 30, 84, 30);
  ctx.fillStyle = dim([92, 108, 122]); // steel roof
  for (let step = 0; step < 7; step++) ctx.fillRect(x - 6 + step * 3, ground - 32 - step * 2, 96 - step * 6, 2);
  ctx.fillStyle = dim([70, 84, 96]);
  ctx.fillRect(x - 6, ground - 31, 96, 2);
  ctx.fillStyle = dim([168, 118, 78]); // door
  ctx.fillRect(x + 38, ground - 22, 11, 22);
  ctx.fillStyle = dim([250, 244, 232]); // verandah posts
  for (const post of [4, 30, 56, 80]) ctx.fillRect(x + post, ground - 30, 2, 30);
  for (const pane of [10, 60]) {
    ctx.fillStyle = dim([70, 58, 52]);
    ctx.fillRect(x + pane - 1, ground - 23, 18, 13);
    ctx.fillStyle = rgb(mix([168, 210, 232], [255, 138, 40], glow));
    ctx.fillRect(x + pane, ground - 22, 16, 11);
    ctx.fillStyle = dim([70, 58, 52]);
    ctx.fillRect(x + pane + 7, ground - 22, 1, 11);
  }
}

/** The neighbour's place on the rise: it burns first, then its roof falls in. */
function neighbour(ctx: CanvasRenderingContext2D, x: number, base: number, burn: number, t: number): void {
  const fallen = burn > 0.75;
  ctx.fillStyle = rgb(mix([196, 180, 160], CHAR, clamp01(burn * 1.5)));
  ctx.fillRect(x, base - 12, 26, 12);
  ctx.fillStyle = rgb(mix([120, 84, 70], CHAR, clamp01(burn * 1.5)));
  if (!fallen) for (let step = 0; step < 4; step++) ctx.fillRect(x - 2 + step * 3, base - 14 - step * 2, 30 - step * 6, 2);
  ctx.fillStyle = rgb(mix([168, 210, 232], [255, 150, 40], clamp01(burn * 3)));
  ctx.fillRect(x + 4, base - 9, 6, 5);
  ctx.fillRect(x + 16, base - 9, 6, 5);
  flames(ctx, x - 2, x + 28, base - (fallen ? 6 : 14), 34 * burn, t, 21);
}

/** A power pole and its wire. The wire sparks once the fire is among the houses. */
function powerPole(ctx: CanvasRenderingContext2D, x: number, ground: number, width: number, shade: number, sparks: number, t: number): void {
  ctx.fillStyle = rgb(mix([96, 74, 58], CHAR, shade));
  ctx.fillRect(x, ground - 58, 3, 58);
  ctx.fillRect(x - 7, ground - 54, 17, 2);
  for (let wire = x + 3; wire < width; wire += 2) ctx.fillRect(wire, ground - 53 + Math.round(((wire - x) / width) * 10), 2, 1);
  if (sparks <= 0 || Math.sin(t * 23) < 0.2) return;
  ctx.fillStyle = '#fff4b0';
  for (let i = 0; i < 6; i++) ctx.fillRect(x + 1 + Math.round((chance(i + Math.floor(t * 12)) - 0.5) * 16), ground - 56 + Math.round(chance(i * 3 + Math.floor(t * 12)) * 12), 1, 1);
}

/** The outside of the home at second `t` of the opening, 0 to OUTSIDE_SECONDS. */
export function drawOutside(view: View, art: Art, t: number, calm: boolean): void {
  const { ctx, width, height, scale } = view;
  const smoke = clamp01((t - 3) / 6); // the sky browns and columns rise
  const fire = clamp01((t - 9) / 8); // the front comes over the ridge
  const storm = clamp01((t - 16) / 10); // spot fires, the neighbour's place, crowning trees
  const end = clamp01((t - 24) / 6); // flames close in and the light goes
  const wind = calm ? 0 : t;
  const ground = Math.round(height * 0.74);

  // A slow push in on the house, and a shudder once the storm arrives.
  const zoom = 1 + 0.16 * (t / OUTSIDE_SECONDS);
  const shakeX = calm ? 0 : Math.sin(t * 37) * storm * 1.5;
  ctx.setTransform(scale * zoom, 0, 0, scale * zoom, (-(zoom - 1) * width * 0.45 + shakeX) * scale, -(zoom - 1) * ground * 0.9 * scale);

  // The sky in flat bands, as pixel art skies are: twelve of them, blended
  // from the four stops of each stage, so a tall phone gets a smooth sky.
  const bands = 12;
  const band = Math.ceil(ground / bands);
  const stage = (stops: Colour[], at: number) => {
    const i = Math.min(2, Math.floor(at * 3));
    return mix(stops[i], stops[i + 1], at * 3 - i);
  };
  for (let i = 0; i < bands; i++) {
    const at = i / (bands - 1);
    const sky = mix(mix(mix(stage(SKIES[0], at), stage(SKIES[1], at), smoke), stage(SKIES[2], at), fire), stage(SKIES[3], at), storm);
    ctx.fillStyle = rgb(sky);
    ctx.fillRect(-8, i * band, width + 16, band);
  }
  ctx.fillStyle = rgb(mix([255, 246, 200], [226, 60, 30], smoke), 1 - fire * 0.7 - storm * 0.3);
  blob(ctx, width * 0.76, height * 0.14, 9);

  // Far hills, the glow behind them, then the front coming over the ridge.
  const ridge = (x: number) => ground - 40 - Math.sin(x * 0.045) * 10 - Math.sin(x * 0.11 + 2) * 4;
  if (smoke > 0) {
    ctx.fillStyle = rgb([255, 150, 40], 0.5 * smoke);
    ctx.fillRect(-8, ground - 90, width + 16, 56);
    for (let x = -8; x < width + 8; x += 8) flames(ctx, x, x + 8, ridge(x) + 2, 8 * smoke + 40 * fire + 46 * storm, wind, 3);
  }
  ctx.fillStyle = rgb(mix(mix([108, 142, 96], [84, 80, 60], smoke), CHAR, clamp01(fire + storm)));
  for (let x = -8; x < width + 8; x += 2) ctx.fillRect(x, ridge(x), 2, ground - ridge(x));
  neighbour(ctx, Math.round(width * 0.68), Math.round(ridge(width * 0.74)) + 8, storm, wind);

  // Smoke columns rising off the ridge and leaning with the wind.
  for (let column = 0; column < 5; column++) {
    for (let puff = 0; puff < 8; puff++) {
      const rise = (wind * (0.3 + 0.2 * storm) + puff / 8 + column * 0.13) % 1;
      const x = width * (0.04 + column * 0.22) + rise * (46 + 40 * storm);
      const y = ridge(x) - rise * ground * 0.9;
      ctx.fillStyle = rgb(mix([196, 186, 176], [34, 26, 28], clamp01(fire + storm)), smoke * (1 - rise) * 0.85);
      blob(ctx, x, y, 5 + Math.round(rise * (12 + 8 * storm)));
    }
  }

  // Dry grass, the pole, the trees and the house.
  ctx.fillStyle = rgb(mix(mix([196, 178, 96], [170, 140, 78], smoke), [44, 24, 18], clamp01(fire * 0.8 + storm * 0.4)));
  ctx.fillRect(-8, ground, width + 16, height - ground + 40);
  ctx.fillStyle = rgb(mix([226, 214, 170], [80, 46, 30], fire));
  for (let x = 0; x < width; x += 5) ctx.fillRect(x, ground + 2 + ((x * 7) % 9), 2, 1);
  powerPole(ctx, Math.round(width * 0.04), ground + 4, width, clamp01(fire), storm - 0.35, wind);
  const leaf = mix(mix([104, 138, 92], [96, 104, 66], smoke), [34, 22, 20], fire);
  const sway = Math.round(Math.sin(wind * (2 + smoke * 4 + storm * 5)) * (1 + smoke * 2 + storm * 2));
  gumTree(ctx, width * 0.12, ground + 2, 13, sway, leaf, clamp01(fire * 0.5 + storm), wind);
  gumTree(ctx, width * 0.92, ground + 6, 16, sway, leaf, clamp01(fire * 0.4 + storm * 0.9), wind);
  const houseX = Math.round(width * 0.27);
  house(ctx, houseX, ground + 8, clamp01(fire * 0.45 + storm * 0.3), clamp01(smoke * 0.4 + fire));
  gumTree(ctx, width * 0.24, ground + 1, 9, sway, leaf, clamp01(fire * 0.6 + storm * 1.2), wind);
  // Embers land on the roof and in the gutters and take hold.
  if (end > 0) flames(ctx, houseX + 10, houseX + 10 + 60 * end, ground - 28, 10 * end, wind, 5);

  // Spot fires start in the yard ahead of the front, one after another.
  for (let spot = 0; spot < 14; spot++) {
    const lit = clamp01(storm * 14 - spot);
    if (lit <= 0) continue;
    const x = chance(spot + 0.7) * width;
    const y = ground + 10 + chance(spot + 0.2) * (height - ground - 8);
    flames(ctx, x - 5 - 6 * end, x + 5 + 6 * end, y, (6 + 10 * end) * lit, wind, spot);
  }
  // The fence along the front, then flames closing in from both sides.
  ctx.fillStyle = rgb(mix([232, 224, 206], CHAR, clamp01(storm * 1.4)));
  for (let x = 0; x < width; x += 6) ctx.fillRect(x, height - 16, 3, 12);
  ctx.fillRect(-8, height - 12, width + 16, 2);
  flames(ctx, -8, width + 8, height + 2, 10 * fire + 26 * end, wind, 9);
  flames(ctx, -8, width * 0.16 * end, height - 4, 70 * end, wind, 13);
  flames(ctx, width - width * 0.16 * end, width + 8, height - 4, 70 * end, wind, 17);

  // The person watches it come, then runs for the door. From the art pack.
  const run = clamp01((t - 19) / 3);
  if (run < 1) {
    const fromX = width * 0.62;
    const x = fromX + (houseX + 43 - fromX) * run;
    const frame = run > 0 && !calm ? Math.floor(t * 10) % 6 : calm ? 0 : Math.floor(t * 4) % 6;
    drawSprite(view, art, run > 0 ? 'walk' : 'idle', x, ground + 24 - 12 * run, UP * 6 + frame);
  }

  // Embers on the wind, then ash: more of them, and faster, as the fire nears.
  const embers = Math.round(60 * clamp01(smoke * 0.4 + fire) + 120 * storm);
  for (let i = 0; i < embers; i++) {
    const speed = (40 + chance(i) * 70) * (1 + storm);
    const x = (chance(i + 0.5) * width + wind * speed) % width;
    const y = (chance(i + 0.25) * height + wind * speed * 0.35 + Math.sin(wind * 3 + i) * 6) % height;
    ctx.fillStyle = i % 3 === 0 ? '#fbd65a' : '#f0641e';
    ctx.fillRect(Math.round(x), Math.round(y), i % 5 === 0 ? 2 : 1, 1);
  }
  ctx.fillStyle = 'rgba(190, 186, 180, 0.8)';
  for (let i = 0; i < 50 * end; i++) {
    ctx.fillRect(Math.round((chance(i + 9.5) * width + Math.sin(wind + i) * 8) % width), Math.round((chance(i + 4.25) * height + wind * 14) % height), 1, 1);
  }

  // The light goes: a red wash, then the dark closing in from the edges.
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = rgb([120, 30, 10], 0.22 * fire + 0.1 * storm);
  ctx.fillRect(0, 0, width, height);
  const dark = ctx.createRadialGradient(width / 2, height * 0.6, height * 0.2, width / 2, height * 0.6, height * 0.8);
  dark.addColorStop(0, 'rgba(6, 2, 4, 0)');
  dark.addColorStop(1, `rgba(6, 2, 4, ${0.35 * fire + 0.5 * storm})`);
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, width, height);
}

/** The inside of the house at second `t`: the news on, the window light
 *  turning, the power going, then the picture settling on the start. */
export function insideScene(t: number, calm: boolean): Scene {
  const inside = t - OUTSIDE_SECONDS;
  const settle = clamp01((t - POWER_OFF_AT) / (CUTSCENE_SECONDS - POWER_OFF_AT));
  const ease = settle * settle * (3 - 2 * settle);
  const powered = t < POWER_OFF_AT;
  return {
    time: t,
    // From the television and the window, across to where the figure stands.
    camX: SPAWN.x - 2 + 2 * ease,
    camY: SPAWN.y - 2 + 3 * ease,
    figure: { x: SPAWN.x, y: SPAWN.y, facing: UP, pose: 'idle', poseTime: t },
    packed: [],
    packedAt: 0,
    near: null,
    powered,
    glow: clamp01(0.5 + inside / 8),
    smoke: 0.14 * clamp01(inside / 6),
    dark: powered ? 0 : 0.2,
    door: 0,
    late: false,
    doorArrow: false,
    showBag: false,
    outlines: false,
    calm,
  };
}
