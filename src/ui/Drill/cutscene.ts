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
// The sky from the top down to the horizon at each stage: a calm afternoon,
// smoke, the fire front, and the firestorm.
const SKIES: Colour[][] = [
  [[92, 156, 214], [150, 198, 232], [226, 236, 228]],
  [[128, 92, 72], [206, 132, 66], [248, 196, 112]],
  [[40, 16, 18], [120, 34, 20], [236, 108, 34]],
  [[10, 5, 7], [52, 12, 10], [210, 70, 18]],
];
const CHAR: Colour = [24, 14, 16];

const mix = (a: Colour, b: Colour, t: number): Colour => [
  a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t,
];
const rgb = (c: Colour, alpha = 1) => `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${alpha})`;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
/** A steady pseudo random number from 0 to 1 for any seed. */
const chance = (seed: number) => Math.abs(Math.sin(seed * 127.1) * 43758.5453) % 1;

/** The four stages of the fire, each easing from 0 to 1 at its own time. */
type Stage = { smoke: number; fire: number; storm: number; end: number };
const stageAt = (t: number): Stage => ({
  smoke: clamp01((t - 2) / 6), // the sky browns and smoke rises
  fire: clamp01((t - 8) / 8), // the front comes over the ridge
  storm: clamp01((t - 15) / 9), // spot fires, the neighbour's place, crowning trees
  end: clamp01((t - 23) / 7), // flames close in and the light goes
});
const tint = (stops: Colour[][], row: number, s: Stage): Colour =>
  mix(mix(mix(stops[0][row], stops[1][row], s.smoke), stops[2][row], s.fire), stops[3][row], s.storm);

/** A soft round puff: solid in the middle, fading to nothing at the edge. */
function puff(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, colour: Colour, alpha: number): void {
  if (alpha <= 0.01 || radius <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, rgb(colour, alpha));
  g.addColorStop(0.55, rgb(colour, alpha * 0.7));
  g.addColorStop(1, rgb(colour, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

/** One flame: a tapering tongue, white hot at the root and red at the tip. */
function tongue(ctx: CanvasRenderingContext2D, x: number, base: number, w: number, h: number, lean: number): void {
  const g = ctx.createLinearGradient(0, base, 0, base - h);
  g.addColorStop(0, 'rgba(255, 238, 170, 0.95)');
  g.addColorStop(0.3, 'rgba(255, 164, 48, 0.92)');
  g.addColorStop(0.7, 'rgba(222, 58, 22, 0.75)');
  g.addColorStop(1, 'rgba(150, 20, 10, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, base);
  ctx.quadraticCurveTo(x - w * 0.6, base - h * 0.45, x + lean, base - h);
  ctx.quadraticCurveTo(x + w * 0.6, base - h * 0.45, x + w / 2, base);
  ctx.closePath();
  ctx.fill();
}

/** A line of flame from `from` to `to`, standing on `baseAt(x)`, with the
 *  glow it throws above it. Every tongue flickers on its own rhythm. */
function fireLine(ctx: CanvasRenderingContext2D, from: number, to: number, baseAt: (x: number) => number, height: number, t: number, seed: number, spacing = 5): void {
  if (height < 0.5) return;
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createLinearGradient(0, baseAt((from + to) / 2), 0, baseAt((from + to) / 2) - height * 2.2);
  glow.addColorStop(0, 'rgba(255, 110, 30, 0.35)');
  glow.addColorStop(1, 'rgba(255, 110, 30, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(from, baseAt((from + to) / 2) - height * 2.2, to - from, height * 2.2);
  ctx.globalCompositeOperation = 'source-over';
  for (let x = from; x < to; x += spacing) {
    const k = x * 0.37 + seed;
    const flicker = 0.62 + 0.38 * Math.sin(t * 9 + k * 3) * Math.sin(t * 5.3 + k);
    const tall = height * flicker * (0.55 + 0.45 * chance(Math.floor(x) + seed));
    tongue(ctx, x, baseAt(x) + 1, spacing * 2.3, tall, Math.sin(t * 6 + k) * tall * 0.16);
  }
}

/** A gum tree: a pale tapering trunk, a loose crown of soft leaf clumps, and
 *  a crown fire once it has caught. */
function gumTree(ctx: CanvasRenderingContext2D, x: number, ground: number, size: number, sway: number, leaf: Colour, burn: number, t: number): void {
  const bark = mix([222, 212, 196], CHAR, burn);
  ctx.fillStyle = rgb(bark);
  ctx.beginPath();
  ctx.moveTo(x - size * 0.16, ground);
  ctx.quadraticCurveTo(x - size * 0.08, ground - size * 1.2, x + sway * 0.4 - size * 0.05, ground - size * 2.2);
  ctx.lineTo(x + sway * 0.4 + size * 0.05, ground - size * 2.2);
  ctx.quadraticCurveTo(x + size * 0.1, ground - size * 1.2, x + size * 0.16, ground);
  ctx.fill();
  const clumps = [[-0.75, 2.05, 0.62], [0.7, 1.95, 0.6], [0, 2.55, 0.8], [-0.35, 2.9, 0.55], [0.45, 2.85, 0.55]];
  for (const [dx, dy, r] of clumps) {
    const cx = x + dx * size + sway;
    const cy = ground - dy * size;
    const g = ctx.createRadialGradient(cx - r * size * 0.3, cy - r * size * 0.4, r * size * 0.1, cx, cy, r * size);
    g.addColorStop(0, rgb(mix(leaf, [255, 255, 220], 0.18 * (1 - burn))));
    g.addColorStop(1, rgb(mix(leaf, [0, 0, 0], 0.25)));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * size, r * size * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (burn > 0.45) fireLine(ctx, x - size * 1.2 + sway, x + size * 1.2 + sway, () => ground - size * 2.2, size * 2.4 * (burn - 0.35), t, x, 3);
}

/** A brick home with a hipped steel roof, a verandah and a water tank. */
function house(ctx: CanvasRenderingContext2D, x: number, ground: number, u: number, shade: number, glow: number, flicker: number): void {
  const dim = (c: Colour) => rgb(mix(c, CHAR, shade));
  const w = 84 * u;
  const wallH = 24 * u;
  // the water tank, a corrugated cylinder
  ctx.fillStyle = dim([128, 140, 148]);
  ctx.fillRect(x - 20 * u, ground - 20 * u, 15 * u, 20 * u);
  ctx.fillStyle = dim([160, 172, 180]);
  ctx.beginPath();
  ctx.ellipse(x - 12.5 * u, ground - 20 * u, 7.5 * u, 2 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dim([104, 116, 124]);
  for (let ring = 1; ring < 5; ring++) ctx.fillRect(x - 20 * u, ground - ring * 4 * u, 15 * u, 0.6 * u);
  // the walls
  ctx.fillStyle = dim([214, 190, 160]);
  ctx.fillRect(x, ground - wallH, w, wallH);
  ctx.fillStyle = dim([188, 160, 128]);
  for (let row = 1; row < 6; row++) ctx.fillRect(x, ground - row * 4 * u, w, 0.5 * u);
  // the hipped roof
  const roof = ctx.createLinearGradient(0, ground - wallH - 16 * u, 0, ground - wallH);
  roof.addColorStop(0, rgb(mix([120, 138, 154], CHAR, shade)));
  roof.addColorStop(1, rgb(mix([78, 92, 106], CHAR, shade)));
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x - 6 * u, ground - wallH);
  ctx.lineTo(x + 16 * u, ground - wallH - 16 * u);
  ctx.lineTo(x + w - 16 * u, ground - wallH - 16 * u);
  ctx.lineTo(x + w + 6 * u, ground - wallH);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = dim([60, 70, 80]);
  ctx.fillRect(x - 6 * u, ground - wallH - 1 * u, w + 12 * u, 1.6 * u);
  // the verandah roof and posts
  ctx.fillStyle = dim([236, 230, 218]);
  for (const post of [3, 29, 55, 79]) ctx.fillRect(x + post * u, ground - wallH + 1 * u, 1.6 * u, wallH - 1 * u);
  // the windows, glowing as the fire nears, and the door
  for (const pane of [9, 58]) {
    ctx.fillStyle = dim([70, 58, 52]);
    ctx.fillRect(x + pane * u - u, ground - 19 * u, 19 * u, 12 * u);
    const lit = mix([176, 212, 232], [255, 150, 50], glow);
    ctx.fillStyle = rgb(mix(lit, [255, 200, 90], glow * flicker * 0.3));
    ctx.fillRect(x + pane * u, ground - 18 * u, 17 * u, 10 * u);
    ctx.fillStyle = dim([70, 58, 52]);
    ctx.fillRect(x + pane * u + 8 * u, ground - 18 * u, 0.8 * u, 10 * u);
  }
  ctx.fillStyle = dim([150, 100, 64]);
  ctx.fillRect(x + 38 * u, ground - 19 * u, 11 * u, 19 * u);
  ctx.fillStyle = dim([230, 196, 120]);
  ctx.fillRect(x + 46 * u, ground - 10 * u, 1.4 * u, 1.4 * u);
}

/** The neighbour's place on the rise: it catches first, then its roof falls in. */
function neighbour(ctx: CanvasRenderingContext2D, x: number, base: number, u: number, burn: number, t: number): void {
  const fallen = burn > 0.75;
  ctx.fillStyle = rgb(mix([200, 184, 162], CHAR, clamp01(burn * 1.5)));
  ctx.fillRect(x, base - 10 * u, 26 * u, 10 * u);
  if (!fallen) {
    ctx.fillStyle = rgb(mix([126, 90, 76], CHAR, clamp01(burn * 1.5)));
    ctx.beginPath();
    ctx.moveTo(x - 2 * u, base - 10 * u);
    ctx.lineTo(x + 6 * u, base - 16 * u);
    ctx.lineTo(x + 20 * u, base - 16 * u);
    ctx.lineTo(x + 28 * u, base - 10 * u);
    ctx.fill();
  }
  ctx.fillStyle = rgb(mix([176, 212, 232], [255, 160, 50], clamp01(burn * 3)));
  ctx.fillRect(x + 4 * u, base - 8 * u, 6 * u, 4 * u);
  ctx.fillRect(x + 16 * u, base - 8 * u, 6 * u, 4 * u);
  fireLine(ctx, x - 2 * u, x + 28 * u, () => base - (fallen ? 4 : 12) * u, 30 * u * burn, t, 21, 3);
}

/** A timber power pole and its sagging line, sparking once the fire arrives. */
function powerPole(ctx: CanvasRenderingContext2D, x: number, ground: number, u: number, width: number, shade: number, sparks: number, t: number): void {
  ctx.strokeStyle = rgb(mix([96, 76, 60], CHAR, shade));
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.4 * u;
  ctx.beginPath();
  ctx.moveTo(x, ground);
  ctx.lineTo(x, ground - 60 * u);
  ctx.moveTo(x - 7 * u, ground - 55 * u);
  ctx.lineTo(x + 7 * u, ground - 55 * u);
  ctx.stroke();
  ctx.lineWidth = 0.7 * u;
  ctx.strokeStyle = rgb(mix([60, 60, 66], CHAR, shade), 0.9);
  for (const dy of [0, 3]) {
    ctx.beginPath();
    ctx.moveTo(x + 6 * u, ground - (55 - dy) * u);
    ctx.quadraticCurveTo((x + width) / 2, ground - (40 - dy) * u, width + 4, ground - (50 - dy) * u);
    ctx.stroke();
  }
  if (sparks <= 0 || Math.sin(t * 23) < 0.25) return;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const seed = i + Math.floor(t * 12);
    puff(ctx, x + 6 * u + (chance(seed) - 0.3) * 14 * u, ground - 55 * u + chance(seed * 3) * 10 * u, 1.6 * u, [255, 244, 190], 0.9);
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** The outside of the home at second `t` of the opening, 0 to OUTSIDE_SECONDS.
 *  Drawn with smooth shapes and soft light, in the picture's own units. */
export function drawOutside(view: View, art: Art, t: number, calm: boolean): void {
  const { ctx, width: W, height: H, scale } = view;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const s = stageAt(t);
  const wind = calm ? 0 : t;
  // One unit keeps the scene in proportion from a tall phone to a wide screen.
  const u = Math.min(W, H * 0.8) / 190;
  const horizon = H * 0.54;
  const ground = H * 0.64;

  // The sky, one smooth gradient, and the sun turning red behind the smoke.
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, rgb(tint(SKIES, 0, s)));
  sky.addColorStop(0.6, rgb(tint(SKIES, 1, s)));
  sky.addColorStop(1, rgb(tint(SKIES, 2, s)));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon + 2);
  const sunColour = mix([255, 246, 210], [230, 64, 30], s.smoke);
  puff(ctx, W * 0.74, H * 0.13, 22 * u, sunColour, 0.35 * (1 - s.storm));
  ctx.fillStyle = rgb(sunColour, 1 - s.fire * 0.6 - s.storm * 0.35);
  ctx.beginPath();
  ctx.arc(W * 0.74, H * 0.13, 8 * u, 0, Math.PI * 2);
  ctx.fill();

  // The smoke plume: soft puffs rising from behind the ridge and leaning with
  // the wind, pale at first, then brown, then black.
  const smokeColour = mix(mix([214, 206, 196], [120, 96, 84], s.fire), [30, 22, 24], s.storm);
  for (let column = 0; column < 5; column++) {
    for (let p = 0; p < 9; p++) {
      const rise = (wind * (0.028 + 0.015 * s.storm) + p / 9 + column * 0.17) % 1;
      const x = W * (0.02 + column * 0.24) + rise * (40 + 50 * s.storm) * u + Math.sin(wind * 0.7 + p + column) * 3 * u;
      const y = horizon - rise * H * 0.62;
      puff(ctx, x, y, (10 + rise * 26 + 10 * s.storm) * u, smokeColour, s.smoke * (1 - rise * 0.8) * 0.55);
    }
  }

  // The far ridge with the fire glowing behind it, then the front over its crest.
  const ridge = (x: number) => horizon - 6 * u - Math.sin(x * 0.03 / u) * 7 * u - Math.sin(x * 0.083 / u + 2) * 3 * u;
  const behind = ctx.createLinearGradient(0, horizon - 60 * u, 0, horizon);
  behind.addColorStop(0, 'rgba(255, 120, 30, 0)');
  behind.addColorStop(1, `rgba(255, 130, 40, ${0.7 * s.smoke})`);
  ctx.fillStyle = behind;
  ctx.fillRect(0, horizon - 60 * u, W, 60 * u);
  fireLine(ctx, -4, W + 4, ridge, (4 * s.smoke + 26 * s.fire + 30 * s.storm) * u, wind, 3);
  ctx.fillStyle = rgb(mix(mix([112, 138, 100], [92, 86, 66], s.smoke), CHAR, clamp01(s.fire + s.storm * 0.5)));
  ctx.beginPath();
  ctx.moveTo(0, ground);
  for (let x = 0; x <= W; x += 2) ctx.lineTo(x, ridge(x));
  ctx.lineTo(W, ground);
  ctx.fill();
  neighbour(ctx, W * 0.72, ridge(W * 0.78) + 5 * u, u, s.storm, wind);

  // The paddock: dry grass that scorches as the fire runs through it.
  const grass = ctx.createLinearGradient(0, horizon, 0, H);
  grass.addColorStop(0, rgb(mix(mix([200, 180, 104], [176, 144, 80], s.smoke), [60, 30, 20], s.fire * 0.7 + s.storm * 0.3)));
  grass.addColorStop(1, rgb(mix(mix([168, 148, 78], [140, 110, 60], s.smoke), [34, 18, 14], s.fire * 0.6 + s.storm * 0.4)));
  ctx.fillStyle = grass;
  ctx.fillRect(0, ground - 1, W, H - ground + 1);
  ctx.fillStyle = rgb(mix([230, 216, 170], [96, 54, 34], s.fire), 0.6);
  for (let i = 0; i < 40; i++) ctx.fillRect(chance(i + 0.3) * W, ground + chance(i + 0.8) * (H - ground), 2 * u, 0.7 * u);

  // The pole, the trees and the home.
  const leaf = mix(mix([96, 132, 86], [98, 104, 68], s.smoke), [34, 22, 20], s.fire * 0.7 + s.storm * 0.3);
  const sway = Math.sin(wind * (1.6 + s.smoke * 3 + s.storm * 4)) * (0.5 + s.smoke + s.storm * 2) * u;
  const homeX = W * 0.5 - 38 * u;
  powerPole(ctx, W * 0.06, ground + 4 * u, u, W, s.fire, s.storm - 0.35, wind);
  gumTree(ctx, W * 0.1, ground + 3 * u, 13 * u, sway, leaf, clamp01(s.fire * 0.5 + s.storm), wind);
  gumTree(ctx, W * 0.92, ground + 6 * u, 15 * u, sway, leaf, clamp01(s.fire * 0.4 + s.storm * 0.9), wind);
  const flicker = calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 13);
  house(ctx, homeX, ground + 10 * u, u, clamp01(s.fire * 0.4 + s.storm * 0.3), clamp01(s.smoke * 0.4 + s.fire), flicker);
  gumTree(ctx, homeX - 4 * u, ground + 11 * u, 9 * u, sway, leaf, clamp01(s.fire * 0.6 + s.storm * 1.2), wind);
  // Embers land in the gutters and take hold along the roof.
  fireLine(ctx, homeX, homeX + 84 * u * s.end, () => ground + 10 * u - 24 * u, 12 * u * s.end, wind, 5, 3);

  // The person watches it come, then runs for the front door. From the art pack.
  const run = clamp01((t - 19) / 3);
  if (run < 1) {
    const standX = W * 0.76;
    const doorX = homeX + 43.5 * u;
    const x = standX + (doorX - standX) * run;
    const feet = ground + 30 * u - 20 * u * run;
    const frame = calm ? 0 : Math.floor(t * (run > 0 ? 10 : 4)) % 6;
    ctx.save();
    ctx.translate(x, feet);
    ctx.scale(u, u);
    drawSprite(view, art, run > 0 ? 'walk' : 'idle', 0, 0, UP * 6 + frame);
    ctx.restore();
  }

  // Spot fires start in the yard ahead of the front, one after another.
  for (let spot = 0; spot < 10; spot++) {
    const lit = clamp01(s.storm * 10 - spot);
    if (lit <= 0) continue;
    const x = chance(spot + 0.7) * W;
    const y = ground + 16 * u + chance(spot + 0.2) * (H - ground - 20 * u);
    fireLine(ctx, x - (5 + 6 * s.end) * u, x + (5 + 6 * s.end) * u, () => y, (6 + 10 * s.end) * u * lit, wind, spot, 3);
  }
  // The front fence, then flames closing in from both sides.
  ctx.fillStyle = rgb(mix([236, 228, 210], CHAR, clamp01(s.storm * 1.4)));
  const fence = ground + 44 * u;
  for (let x = 0; x < W; x += 6 * u) ctx.fillRect(x, fence - 9 * u, 2.2 * u, 9 * u);
  ctx.fillRect(0, fence - 7 * u, W, 1.4 * u);
  fireLine(ctx, -4, W + 4, () => H + 2, (8 * s.fire + 24 * s.end) * u, wind, 9);
  fireLine(ctx, -4, W * 0.18 * s.end, () => H - 2, 60 * u * s.end, wind, 13);
  fireLine(ctx, W - W * 0.18 * s.end, W + 4, () => H - 2, 60 * u * s.end, wind, 17);

  // Embers on the wind, with short glowing trails; then ash as the light goes.
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const embers = Math.round(50 * clamp01(s.smoke * 0.4 + s.fire) + 90 * s.storm);
  for (let i = 0; i < embers; i++) {
    const speed = (26 + chance(i) * 44) * (1 + s.storm) * u;
    const x = (chance(i + 0.5) * W + wind * speed) % W;
    const y = (chance(i + 0.25) * H + wind * speed * 0.3 + Math.sin(wind * 3 + i) * 5 * u) % H;
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(255, 220, 120, 0.9)' : 'rgba(255, 110, 40, 0.85)';
    ctx.lineWidth = (i % 4 === 0 ? 1.2 : 0.8) * u;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - (calm ? 0 : 3 * u), y - (calm ? 0 : 1 * u));
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(200, 196, 190, 0.75)';
  for (let i = 0; i < 60 * s.end; i++) {
    ctx.beginPath();
    ctx.arc((chance(i + 9.5) * W + Math.sin(wind + i) * 8 * u) % W, (chance(i + 4.25) * H + wind * 12 * u) % H, 0.7 * u, 0, Math.PI * 2);
    ctx.fill();
  }

  // The light goes: a red wash, then the dark closing in from the edges.
  ctx.fillStyle = `rgba(130, 30, 10, ${0.18 * s.fire + 0.1 * s.storm})`;
  ctx.fillRect(0, 0, W, H);
  const dark = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.18, W / 2, H * 0.55, H * 0.85);
  dark.addColorStop(0, 'rgba(6, 2, 4, 0)');
  dark.addColorStop(1, `rgba(6, 2, 4, ${0.3 * s.fire + 0.45 * s.storm})`);
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, W, H);
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
    dark: powered ? 0 : 0.5 * clamp01((t - POWER_OFF_AT) / 1.5),
    door: 0,
    late: false,
    doorArrow: false,
    showBag: false,
    outlines: false,
    matHold: 0,
    calm,
  };
}
