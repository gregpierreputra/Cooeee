// E7 — draws the drill house on a canvas. The floor and walls are one baked
// picture. Furniture, the things to pack and the figure are drawn over it from
// back to front, so a person behind the fridge is hidden by it and a person in
// front is not. All drawing is in source pixels (16 to a tile), scaled up by a
// whole number so every pixel of the art stays square.

import { BAG_LIMIT, DRILL_ITEMS, itemById, type DrillItem } from '../../core/drill-items';
import { MAT_CENTRE } from '../../core/drill-house';
import { FURNITURE, GRID, MAT, TILE } from '../../core/drill-layout';
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
  /** The phone asked for less motion: nothing pulses, shakes or drifts. */
  calm: boolean;
};

/** At least this many tiles fit across and down the picture, whatever the
 *  screen: a tall phone sees more of the house below, a wide desktop more beside. */
const TILES_ACROSS = 11;
const TILES_DOWN = 13;
/** Room kept clear at the top of the picture for the clock, and at the
 *  bottom for the thumb controls, in css pixels. Arrows stay out of both. */
const HUD_HEIGHT = 64;
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
  const outline = document.createElement('canvas');
  outline.width = sprites.width;
  outline.height = sprites.height;
  const ctx = outline.getContext('2d');
  if (!ctx) throw new Error('no 2d canvas');
  ctx.drawImage(sprites, 0, 0);
  // Keep each sprite's shape and replace its colour.
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#ffd34d';
  ctx.fillRect(0, 0, outline.width, outline.height);
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

/** A one pixel yellow line round a thing that can be packed: its yellow shape
 *  drawn a pixel up, down, left and right, under the thing itself. */
function drawOutline(view: View, art: Art, key: string, x: number, y: number, strength: number): void {
  view.ctx.globalAlpha = strength;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawSprite(view, art, key, x + dx, y + dy, 0, 0, art.outline);
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
  // Every thing that can be packed is outlined, and the one in reach glows.
  if (scene.outlines) {
    const inReach = scene.near?.id === item.id;
    const glow = inReach && !scene.calm ? 0.8 + 0.2 * Math.sin(scene.time * 8) : inReach ? 1 : 0.85;
    drawOutline(view, art, item.id, item.x * TILE, item.y * TILE, glow);
  }
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
      draw: () => drawSprite(view, art, piece.sprite, (piece.x + piece.w / 2) * TILE, (piece.y + piece.h) * TILE, frame),
    });
  }
  for (const item of DRILL_ITEMS) {
    if (scene.packed.includes(item.id)) continue;
    // A thing sorts one tile lower than it stands, so it shows on top of the
    // bench it sits on, yet still behind a person standing in front of it.
    things.push({ order: item.y + 1, draw: () => drawItem(view, art, item, scene) });
    if (item.id === 'pet') {
      const frame = scene.calm ? 0 : Math.floor(scene.time * 6) % (ATLAS.cat[4] ?? 1);
      things.push({ order: item.y + 1, draw: () => drawSprite(view, art, 'cat', (item.x + 1.2) * TILE, item.y * TILE, frame) });
    }
  }
  const figure = scene.figure;
  if (figure) things.push({ order: figure.y, draw: () => drawFigure(view, art, figure) });
  things.sort((a, b) => a.order - b.order);
  for (const thing of things) thing.draw();
}

/** Orange at every window and spilling onto the floor under it. */
function drawGlow(view: View, glow: number, time: number, calm: boolean): void {
  if (glow <= 0) return;
  const { ctx } = view;
  const flicker = calm ? 1 : 0.85 + 0.15 * Math.sin(time * 9);
  ctx.globalCompositeOperation = 'lighter';
  for (const piece of WINDOWS) {
    const x = (piece.x + piece.w / 2) * TILE;
    const y = (piece.y + piece.h) * TILE;
    ctx.fillStyle = `rgba(255, 110, 20, ${0.55 * glow * flicker})`;
    ctx.fillRect(x - 11, y - 18, 22, 16);
    const spill = ctx.createRadialGradient(x, y, 4, x, y, 56);
    spill.addColorStop(0, `rgba(255, 120, 30, ${0.4 * glow * flicker})`);
    spill.addColorStop(1, 'rgba(255, 120, 30, 0)');
    ctx.fillStyle = spill;
    ctx.fillRect(x - 56, y, 112, 56);
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** A soft pulse on the door mat, so it is the one bright thing on the floor. */
function drawMat(view: View, scene: Scene): void {
  const pulse = scene.calm ? 0.35 : 0.25 + 0.2 * Math.sin(scene.time * 4);
  view.ctx.fillStyle = `rgba(255, 224, 130, ${pulse})`;
  GRID.forEach((row, y) => [...row].forEach((cell, x) => cell === MAT && view.ctx.fillRect(x * TILE, y * TILE, TILE, TILE)));
}

/** A bobbing arrow over the thing in reach. Drawn over the smoke and the dark,
 *  so what can be packed is never lost in them. */
function drawNearArrow(view: View, art: Art, scene: Scene, left: number, top: number): void {
  if (!scene.near) return;
  const bob = scene.calm ? 0 : Math.round(Math.sin(scene.time * 6) * 2);
  const itemTop = scene.near.y * TILE - ATLAS[scene.near.id][3];
  drawSprite(view, art, 'arrow', scene.near.x * TILE - left, itemTop - top - 2 + bob);
}

/** Smoke over the whole picture, then the dark, with a pool of light round a
 *  person who packed the torch. */
function drawHaze(view: View, scene: Scene, figureX: number, figureY: number): void {
  const { ctx, width, height } = view;
  if (scene.smoke > 0) {
    ctx.fillStyle = `rgba(120, 104, 96, ${scene.smoke})`;
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 4; i++) {
      const drift = scene.calm ? 0 : scene.time * (5 + i * 2);
      const x = ((i * 67 + drift) % (width + 120)) - 60;
      const y = height * (0.15 + 0.22 * i) + (scene.calm ? 0 : Math.sin(scene.time * 0.6 + i) * 6);
      const wisp = ctx.createRadialGradient(x, y, 0, x, y, 60);
      wisp.addColorStop(0, `rgba(200, 190, 180, ${scene.smoke * 0.8})`);
      wisp.addColorStop(1, 'rgba(200, 190, 180, 0)');
      ctx.fillStyle = wisp;
      ctx.fillRect(x - 60, y - 60, 120, 120);
    }
  }
  if (scene.dark > 0) {
    const dark = `rgba(6, 8, 20, ${scene.dark})`;
    if (scene.figure && scene.packed.includes('torch')) {
      const pool = ctx.createRadialGradient(figureX, figureY, 14, figureX, figureY, 64);
      pool.addColorStop(0, 'rgba(6, 8, 20, 0)');
      pool.addColorStop(1, dark);
      ctx.fillStyle = pool;
    } else {
      ctx.fillStyle = dark;
    }
    ctx.fillRect(0, 0, width, height);
  }
  if (scene.late) {
    const beat = scene.calm ? 0.4 : 0.35 + 0.15 * Math.sin(scene.time * 7);
    const red = ctx.createRadialGradient(width / 2, height / 2, height * 0.3, width / 2, height / 2, height * 0.75);
    red.addColorStop(0, 'rgba(200, 30, 20, 0)');
    red.addColorStop(1, `rgba(200, 30, 20, ${beat})`);
    ctx.fillStyle = red;
    ctx.fillRect(0, 0, width, height);
  }
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

/** An arrow to the front door: over the mat when it is in view, otherwise at
 *  the edge of the picture pointing the way. */
function drawDoorArrow(view: View, art: Art, scene: Scene, left: number, top: number): void {
  const { ctx, width, height } = view;
  const matX = MAT_CENTRE.x * TILE - left;
  const matY = MAT_CENTRE.y * TILE - top;
  const bob = scene.calm ? 0 : Math.sin(scene.time * 8) * 2;
  const inset = 14;
  const x = clamp(matX, inset, width - inset);
  const toSource = view.ratio / view.scale;
  const y = clamp(matY - 10, HUD_HEIGHT * toSource + 10, height - CONTROLS_HEIGHT * toSource - BAG_STRIP);
  const onScreen = x === matX && y === matY - 10;
  ctx.save();
  ctx.translate(x, y + (onScreen ? bob : 0));
  // The arrow sprite points down. Turn it to point from here to the mat.
  if (!onScreen) ctx.rotate(Math.atan2(matY - y, matX - x) - Math.PI / 2);
  ctx.scale(1.5, 1.5);
  drawSprite(view, art, 'arrow', 0, ATLAS.arrow[3] / 2);
  ctx.restore();
}

/** One whole frame of the house. */
export function drawScene(view: View, art: Art, scene: Scene): void {
  const { ctx, width, height, scale } = view;
  const shake = scene.late && !scene.calm ? Math.sin(scene.time * 40) * 0.5 : 0;
  const toSource = view.ratio / scale;
  const left = edge(scene.camX * TILE + shake, width, HOUSE_WIDTH, scale);
  const top = edge(scene.camY * TILE, height, HOUSE_HEIGHT, scale, HUD_HEIGHT * toSource, CONTROLS_HEIGHT * toSource + BAG_STRIP);

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = '#e4dcc8';
  ctx.fillRect(0, 0, width, height);
  ctx.translate(-left, -top);
  ctx.drawImage(art.house, 0, 0);
  drawMat(view, scene);
  drawStanding(view, art, scene);
  drawGlow(view, scene.glow, scene.time, scene.calm);

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const figure = scene.figure;
  drawHaze(view, scene, figure ? figure.x * TILE - left : 0, figure ? figure.y * TILE - top - 8 : 0);
  drawNearArrow(view, art, scene, left, top);
  if (scene.doorArrow) drawDoorArrow(view, art, scene, left, top);
  if (scene.showBag) drawBag(view, art, scene, left, top);
}
