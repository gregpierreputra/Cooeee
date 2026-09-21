// E7 — draws the drill house on a canvas. The floor and walls are one baked
// picture. Furniture, the things to pack and the figure are drawn over it from
// back to front, so a person behind the fridge is hidden by it and a person in
// front is not. All drawing is in source pixels (16 to a tile), scaled up by a
// whole number so every pixel of the art stays square.

import { EXIT_LABEL } from '../../core/copy';
import { BAG_LIMIT, DRILL_ITEMS, itemById, type DrillItem } from '../../core/drill-items';
import { MAT_CENTRE, restingOrder } from '../../core/drill-house';
import { FURNITURE, GRID, MAT, TILE, wallLift } from '../../core/drill-layout';
import { ATLAS } from './atlas';

/** The two baked pictures, and a copy of the sprite sheet with every pixel
 *  turned yellow: the outline drawn round each thing that can be packed. */
export type Art = { house: HTMLImageElement; sprites: HTMLImageElement; outline: HTMLCanvasElement };
/** A canvas ready to draw on: its size in source pixels and the scale up. */
export type View = { ctx: CanvasRenderingContext2D; width: number; height: number; scale: number; ratio: number };

export type Figure = { x: number; y: number; facing: number; pose: 'idle' | 'walk' | 'pick'; poseTime: number };

export type Scene = {
  /** Seconds since the screen opened. Every animation is worked out from it. */
  time: number;
  /** The middle of the picture, in tiles. */
  camX: number;
  camY: number;
  figure: Figure | null;
  packed: string[];
  /** When the newest thing was packed, and where from, for its flight to the bag. */
  packedAt: number;
  near: DrillItem | null;
  /** The power is on: the television plays. Off: it is dark. */
  powered: boolean;
  /** 0 to 1: the orange at the windows, the smoke, the dark, the open door. */
  glow: number;
  smoke: number;
  dark: number;
  door: number;
  /** The last seconds: a red edge, and an arrow to the door. */
  late: boolean;
  doorArrow: boolean;
  showBag: boolean;
  /** A yellow line round every thing that can be packed. Off in the film. */
  outlines: boolean;
  /** 0 to 1: how far the wait on the mat has gone towards leaving early. */
  matHold: number;
  /** The phone asked for less motion: nothing pulses, shakes or drifts. */
  calm: boolean;
};

/** At least this many tiles fit across and down the picture, whatever the
 *  screen: a tall phone sees more of the house below, a wide desktop more beside. */
const TILES_ACROSS = 11;
const TILES_DOWN = 13;
/** Room kept clear at the top of the picture for the clock, and at the
 *  bottom for the thumb controls, in css pixels. Arrows stay out of both. */
const HUD_HEIGHT = 110;
const CONTROLS_HEIGHT = 140;
const HOUSE_WIDTH = GRID[0].length * TILE;
const HOUSE_HEIGHT = GRID.length * TILE;
const FRAMES_PER_FACING = { idle: 6, walk: 6, pick: 12 };
const FRAMES_PER_SECOND = { idle: 5, walk: 10, pick: 30 };
const WINDOWS = FURNITURE.filter((piece) => piece.sprite === 'window');
const STANDING = FURNITURE.filter((piece) => !piece.flat);
const SLOT = 16;
/** The height of the bag strip along the bottom of the picture, in source pixels. */
export const BAG_STRIP = SLOT + 8;

const loadImage = (name: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    // Same origin, shipped with the app and stored ahead by the service worker.
    image.src = `${import.meta.env.BASE_URL}drill/${name}.png`;
  });

export const loadArt = async (): Promise<Art> => {
  const [house, sprites] = await Promise.all([loadImage('house'), loadImage('sprites')]);
  // The outline sheet: every sprite's shape grown by one pixel each way, less
  // the shape itself, in yellow. What is left is a one pixel rim.
  const outline = document.createElement('canvas');
  outline.width = sprites.width;
  outline.height = sprites.height;
  const ctx = outline.getContext('2d');
  if (!ctx) throw new Error('no 2d canvas');
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(sprites, dx, dy);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#ffd34d';
  ctx.fillRect(0, 0, outline.width, outline.height);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(sprites, 0, 0);
  return { house, sprites, outline };
};

/** Size the canvas to its box on screen, at most three device pixels to one
 *  and never past 2048 a side, and pick the whole number scale. */
export function fitCanvas(canvas: HTMLCanvasElement): View | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  // One ratio for both sides, so a size cap never stretches the picture.
  const ratio = Math.min(window.devicePixelRatio || 1, 3, 2048 / Math.max(1, canvas.clientWidth), 2048 / Math.max(1, canvas.clientHeight));
  const width = Math.round(canvas.clientWidth * ratio);
  const height = Math.round(canvas.clientHeight * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const scale = Math.max(1, Math.round(Math.min(width / (TILES_ACROSS * TILE), height / (TILES_DOWN * TILE))));
  ctx.imageSmoothingEnabled = false;
  return { ctx, width: width / scale, height: height / scale, scale, ratio };
}

/** Draw one sprite with the middle of its bottom edge at (x, y). */
export function drawSprite(view: View, art: Art, key: string, x: number, y: number, frame = 0, fit = 0, sheet: CanvasImageSource = art.sprites): void {
  const [sx, sy, w, h] = ATLAS[key];
  const shrink = fit ? Math.min(1, fit / w, fit / h) : 1;
  view.ctx.drawImage(
    sheet, sx + frame * w, sy, w, h,
    Math.round(x - (w * shrink) / 2), Math.round(y - h * shrink), w * shrink, h * shrink,
  );
}

/** A one pixel yellow line round a thing that can be packed. */
function drawOutline(view: View, art: Art, key: string, x: number, y: number, strength: number): void {
  view.ctx.globalAlpha = strength;
  drawSprite(view, art, key, x, y, 0, 0, art.outline);
  view.ctx.globalAlpha = 1;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** Where the picture starts over the house along one side: follow `centre`,
 *  keep it in the middle of the open stretch between `near` and `far` (the
 *  parts covered by the clock and the thumb controls), and never scroll past
 *  the edge of the house. A house shorter than the open stretch is centred in it. */
function edge(centre: number, view: number, house: number, scale: number, near = 0, far = 0): number {
  const open = view - near - far;
  const start = house <= open ? -near - (open - house) / 2 : clamp(centre - near - open / 2, -near, house - near - open);
  return Math.round(start * scale) / scale;
}

function drawFigure(view: View, art: Art, figure: Figure): void {
  const perFacing = FRAMES_PER_FACING[figure.pose];
  const frame = Math.floor(figure.poseTime * FRAMES_PER_SECOND[figure.pose]) % perFacing;
  drawSprite(view, art, figure.pose, figure.x * TILE, figure.y * TILE + 3, figure.facing * perFacing + frame);
}

function drawItem(view: View, art: Art, item: DrillItem, scene: Scene): void {
  if (item.id !== 'television') {
    drawSprite(view, art, item.id, item.x * TILE, item.y * TILE);
    return;
  }
  // The television plays the news until the power goes, then it is a dark screen.
  const frames = ATLAS.television[4] ?? 1;
  drawSprite(view, art, item.id, item.x * TILE, item.y * TILE, scene.powered ? Math.floor(scene.time * 8) % frames : 0);
  if (!scene.powered) {
    view.ctx.fillStyle = 'rgba(14, 16, 28, 0.9)';
    view.ctx.fillRect(item.x * TILE - 21, item.y * TILE - 20, 42, 17);
  }
}

/** Furniture, things and the figure, sorted so the nearer one is drawn last. */
function drawStanding(view: View, art: Art, scene: Scene): void {
  const things: { order: number; draw: () => void }[] = [];
  for (const piece of STANDING) {
    const frame = piece.sprite === 'door' ? Math.round(scene.door * 4) : 0;
    things.push({
      order: piece.y + piece.h,
      draw: () => drawSprite(view, art, piece.sprite, (piece.x + piece.w / 2) * TILE + (piece.nudge ?? 0), (piece.y + piece.h) * TILE - (piece.wall ? wallLift(ATLAS[piece.sprite][3]) : 0), frame),
    });
  }
  for (const item of DRILL_ITEMS) {
    if (scene.packed.includes(item.id)) continue;
    things.push({ order: restingOrder(item.x, item.y), draw: () => drawItem(view, art, item, scene) });
    if (item.id === 'pet') {
      const frame = scene.calm ? 0 : Math.floor(scene.time * 6) % (ATLAS.cat[4] ?? 1);
      things.push({ order: item.y, draw: () => drawSprite(view, art, 'cat', (item.x + 1.5) * TILE, item.y * TILE, frame) });
    }
  }
  const figure = scene.figure;
  if (figure) things.push({ order: figure.y, draw: () => drawFigure(view, art, figure) });
  things.sort((a, b) => a.order - b.order);
  for (const thing of things) thing.draw();
}

/** Fire light at every window, pulsing, and spilling onto the floor under
 *  it. Drawn after the dark, so it is the brightest thing in a dark room. */
function drawGlow(view: View, glow: number, time: number, calm: boolean): void {
  if (glow <= 0) return;
  const { ctx } = view;
  ctx.globalCompositeOperation = 'lighter';
  WINDOWS.forEach((piece, i) => {
    const flicker = calm ? 0.85 : 0.7 + 0.3 * Math.sin(time * 9 + i) * Math.sin(time * 3.7 + i * 2);
    const x = (piece.x + piece.w / 2) * TILE;
    const y = (piece.y + piece.h) * TILE - wallLift(ATLAS[piece.sprite][3]);
    ctx.fillStyle = `rgba(255, 110, 20, ${0.9 * glow * flicker})`;
    ctx.fillRect(x - 11, y - 18, 22, 16);
    const spill = ctx.createRadialGradient(x, y, 4, x, y, 80);
    spill.addColorStop(0, `rgba(255, 120, 30, ${0.75 * glow * flicker})`);
    spill.addColorStop(1, 'rgba(255, 120, 30, 0)');
    ctx.fillStyle = spill;
    ctx.fillRect(x - 80, y - 8, 160, 88);
  });
  ctx.globalCompositeOperation = 'source-over';
}

/** A soft pulse on the door mat, so it is the one bright thing on the floor. */
function drawMat(view: View, scene: Scene): void {
  const pulse = scene.calm ? 0.35 : 0.25 + 0.2 * Math.sin(scene.time * 4);
  // Green, like the exit arrow, once the arrow is showing the way.
  view.ctx.fillStyle = scene.doorArrow ? `rgba(91, 227, 138, ${pulse + 0.2})` : `rgba(255, 224, 130, ${pulse})`;
  GRID.forEach((row, y) => [...row].forEach((cell, x) => cell === MAT && view.ctx.fillRect(x * TILE, y * TILE, TILE, TILE)));
}

/** A ring filling round the door mat while a ready person waits on it, so
 *  they can see the drill is about to end, and why. */
function drawMatHold(view: View, hold: number): void {
  const { ctx } = view;
  const x = MAT_CENTRE.x * TILE;
  const y = MAT_CENTRE.y * TILE;
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#5be38a';
  ctx.beginPath();
  ctx.arc(x, y, 20, -Math.PI / 2, -Math.PI / 2 + Math.min(1, hold) * Math.PI * 2);
  ctx.stroke();
}

/** A bobbing arrow over the thing in reach. Drawn over the smoke and the dark,
 *  so what can be packed is never lost in them. */
function drawNearArrow(view: View, art: Art, scene: Scene, left: number, top: number): void {
  if (!scene.near) return;
  const bob = scene.calm ? 0 : Math.round(Math.sin(scene.time * 6) * 2);
  const itemTop = scene.near.y * TILE - ATLAS[scene.near.id][3];
  drawSprite(view, art, 'arrow', scene.near.x * TILE - left, itemTop - top - 2 + bob);
}

/** Smoke over the whole picture and rolling under the ceiling, then the
 *  dark, with a pool of sight round the person: wider for one carrying the
 *  torch. The last seconds redden the edges. */
function drawHaze(view: View, scene: Scene, figureX: number, figureY: number): void {
  const { ctx, width, height } = view;
  const drift = scene.calm ? 0 : scene.time;
  if (scene.smoke > 0) {
    ctx.fillStyle = `rgba(96, 76, 70, ${scene.smoke * 0.6})`;
    ctx.fillRect(0, 0, width, height);
    const ceiling = ctx.createLinearGradient(0, 0, 0, height * 0.45);
    ceiling.addColorStop(0, `rgba(58, 46, 46, ${0.3 + scene.smoke})`);
    ceiling.addColorStop(1, 'rgba(58, 46, 46, 0)');
    ctx.fillStyle = ceiling;
    ctx.fillRect(0, 0, width, height * 0.45);
    for (let i = 0; i < 7; i++) {
      const x = ((i * 53 + drift * (6 + i)) % (width + 120)) - 60;
      const y = height * (0.05 + 0.05 * (i % 3)) + Math.sin(drift * 0.5 + i) * 6;
      const wisp = ctx.createRadialGradient(x, y, 0, x, y, 54);
      wisp.addColorStop(0, `rgba(84, 70, 68, ${0.25 + scene.smoke})`);
      wisp.addColorStop(1, 'rgba(84, 70, 68, 0)');
      ctx.fillStyle = wisp;
      ctx.fillRect(x - 54, y - 54, 108, 108);
    }
  }
  if (scene.dark > 0) {
    const torch = scene.packed.includes('torch');
    const flicker = scene.calm ? 1 : 1 + 0.04 * Math.sin(scene.time * 11);
    const inner = (torch ? 34 : 16) * flicker;
    const outer = (torch ? 100 : 58) * flicker;
    const dark = `rgba(4, 5, 14, ${scene.dark})`;
    // With the lights on the room dims evenly; once they fail, sight shrinks
    // to a pool round the person.
    if (scene.figure && !scene.powered) {
      const pool = ctx.createRadialGradient(figureX, figureY, inner, figureX, figureY, outer);
      pool.addColorStop(0, 'rgba(4, 5, 14, 0)');
      pool.addColorStop(1, dark);
      ctx.fillStyle = pool;
    } else {
      ctx.fillStyle = dark;
    }
    ctx.fillRect(0, 0, width, height);
  }
}

/** Embers that got in, drifting across the room with short glowing trails. */
function drawEmbers(view: View, scene: Scene): void {
  const { ctx, width, height } = view;
  const count = scene.calm ? 8 : Math.round(12 + 30 * scene.smoke);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.9;
  for (let i = 0; i < count; i++) {
    const seed = Math.abs(Math.sin(i * 127.1) * 43758.5453) % 1;
    const speed = 10 + seed * 18;
    const t = scene.calm ? 0 : scene.time;
    const x = (seed * 997 + t * speed) % (width + 20) - 10;
    const y = ((seed * 571 + t * speed * 0.45) % (height + 20)) - 10 + Math.sin(t * 2 + i) * 4;
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(255, 220, 120, 0.9)' : 'rgba(255, 120, 40, 0.8)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 2.5, y - 1.2);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** The last seconds: the edges redden and beat. */
function drawLate(view: View, scene: Scene): void {
  const { ctx, width, height } = view;
  const beat = scene.calm ? 0.4 : 0.35 + 0.15 * Math.sin(scene.time * 7);
  const red = ctx.createRadialGradient(width / 2, height / 2, height * 0.3, width / 2, height / 2, height * 0.75);
  red.addColorStop(0, 'rgba(200, 30, 20, 0)');
  red.addColorStop(1, `rgba(200, 30, 20, ${beat})`);
  ctx.fillStyle = red;
  ctx.fillRect(0, 0, width, height);
}

/** Ten slots along the bottom holding what is packed. The newest thing flies
 *  in from where it was picked up. */
function drawBag(view: View, art: Art, scene: Scene, left: number, top: number): void {
  const { ctx, width, height } = view;
  const startX = Math.round((width - BAG_LIMIT * SLOT) / 2);
  const y = height - SLOT - 4;
  for (let slot = 0; slot < BAG_LIMIT; slot++) {
    const x = startX + slot * SLOT;
    ctx.fillStyle = 'rgba(16, 18, 30, 0.72)';
    ctx.fillRect(x, y, SLOT - 1, SLOT - 1);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1 / view.scale;
    ctx.strokeRect(x, y, SLOT - 1, SLOT - 1);
    const item = itemById(scene.packed[slot] ?? '');
    if (!item) continue;
    const newest = slot === scene.packed.length - 1;
    const flight = newest && !scene.calm ? clamp((scene.time - scene.packedAt) / 0.25, 0, 1) : 1;
    const fromX = item.x * TILE - left;
    const fromY = item.y * TILE - top;
    const toX = x + (SLOT - 1) / 2;
    const toY = y + SLOT - 3;
    drawSprite(view, art, item.id, fromX + (toX - fromX) * flight, fromY + (toY - fromY) * flight, 0, flight === 1 ? 13 : 0);
  }
}

/** A large green arrow to the front door, with EXIT beside it: bouncing
 *  over the mat when it is in view, otherwise at the edge of the picture,
 *  turned to point the way. Kept clear of the clock and the thumb controls. */
function drawDoorArrow(view: View, scene: Scene, left: number, top: number): void {
  const { ctx, width, height } = view;
  const toSource = view.ratio / view.scale;
  const matX = MAT_CENTRE.x * TILE - left;
  const matY = MAT_CENTRE.y * TILE - top - 8;
  const pad = 30;
  const x = clamp(matX, pad, width - pad);
  const y = clamp(matY, HUD_HEIGHT * toSource + pad + 14, height - CONTROLS_HEIGHT * toSource - BAG_STRIP - pad);
  const onScreen = x === matX && y === matY;
  const angle = onScreen ? 0 : Math.atan2(matY - y, matX - x) - Math.PI / 2;
  const pulse = scene.calm ? 1 : 1 + 0.12 * Math.sin(scene.time * 6);
  const bob = onScreen && !scene.calm ? Math.sin(scene.time * 6) * 3 - 3 : 0;

  // The arrow: a shaft and a head pointing down, tip at the origin.
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(angle);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = 'rgba(91, 227, 138, 0.9)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#5be38a';
  ctx.strokeStyle = '#0b2a16';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-5, -36);
  ctx.lineTo(5, -36);
  ctx.lineTo(5, -16);
  ctx.lineTo(13, -16);
  ctx.lineTo(0, 0);
  ctx.lineTo(-13, -16);
  ctx.lineTo(-5, -16);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  ctx.restore();

  // EXIT past the tail of the arrow, always upright.
  const labelX = clamp(x + 47 * Math.sin(angle), 16, width - 16);
  const labelY = clamp(y + bob - 47 * Math.cos(angle) + 3, HUD_HEIGHT * toSource + 10, height - BAG_STRIP - 4);
  ctx.save();
  ctx.font = '800 10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0b2a16';
  ctx.fillStyle = '#ffffff';
  ctx.strokeText(EXIT_LABEL, labelX, labelY);
  ctx.fillText(EXIT_LABEL, labelX, labelY);
  ctx.restore();
}

/** One whole frame of the house. */
export function drawScene(view: View, art: Art, scene: Scene): void {
  const { ctx, width, height, scale } = view;
  const shake = scene.late && !scene.calm ? Math.sin(scene.time * 40) : 0;
  const toSource = view.ratio / scale;
  const left = edge(scene.camX * TILE + shake, width, HOUSE_WIDTH, scale);
  const top = edge(scene.camY * TILE, height, HOUSE_HEIGHT, scale, HUD_HEIGHT * toSource, CONTROLS_HEIGHT * toSource + BAG_STRIP);
  const world = () => ctx.setTransform(scale, 0, 0, scale, -left * scale, -top * scale);
  const screen = () => ctx.setTransform(scale, 0, 0, scale, 0, 0);

  screen();
  ctx.fillStyle = '#e4dcc8';
  ctx.fillRect(0, 0, width, height);
  world();
  ctx.drawImage(art.house, 0, 0);
  drawMat(view, scene);
  drawStanding(view, art, scene);

  screen();
  const figure = scene.figure;
  drawHaze(view, scene, figure ? figure.x * TILE - left : 0, figure ? figure.y * TILE - top - 8 : 0);

  // Above the dark: the fire at the windows, the mat, and the yellow line
  // round every thing that can be packed, so none is lost in it.
  world();
  drawGlow(view, scene.glow, scene.time, scene.calm);
  if (scene.dark > 0) drawMat(view, scene);
  if (scene.matHold > 0) drawMatHold(view, scene.matHold);
  if (scene.outlines) {
    for (const item of DRILL_ITEMS) {
      if (scene.packed.includes(item.id)) continue;
      const inReach = scene.near?.id === item.id;
      const strength = inReach ? (scene.calm ? 1 : 0.8 + 0.2 * Math.sin(scene.time * 8)) : 0.75;
      drawOutline(view, art, item.id, item.x * TILE, item.y * TILE, strength);
    }
  }

  screen();
  if (scene.smoke > 0) drawEmbers(view, scene);
  if (scene.late) drawLate(view, scene);
  drawNearArrow(view, art, scene, left, top);
  if (scene.doorArrow) drawDoorArrow(view, scene, left, top);
  if (scene.showBag) drawBag(view, art, scene, left, top);
}
