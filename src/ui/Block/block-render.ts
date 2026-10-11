// Ready the Block — draws the yard on a canvas. The ground is one baked
// picture; the scenery, the day's risks, the things dealt with and the
// harmless things are drawn over it from back to front, so a thing behind the
// tree is hidden by it. All drawing is in source pixels (16 to a tile), at a
// whole number of device pixels to each, so every pixel stays square.

import { BLOCK_ATLAS } from '../../core/block-atlas';
import { BLOCK_SCENERY, BLOCK_TILE, type Placed } from '../../core/block-layout';
import type { Camera } from '../../core/block-view';

export type BlockArt = { yard: HTMLImageElement; sprites: HTMLImageElement };

const loadImage = (name: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    // Same origin, shipped with the app and stored ahead by the service worker.
    image.src = `${import.meta.env.BASE_URL}block/${name}.png`;
  });

export const loadBlockArt = async (): Promise<BlockArt> => {
  const [yard, sprites] = await Promise.all([loadImage('yard'), loadImage('sprites')]);
  return { yard, sprites };
};

/** A mark left by a tap: a found risk's ring, or a cross where a tap missed. */
export type Mark = { kind: 'found' | 'wrong'; x: number; y: number; w: number; h: number; at: number };

export type BlockScene = {
  /** Seconds since the game opened. Every animation is worked out from it. */
  time: number;
  camera: Camera;
  /** What stands in the yard today, the scenery aside. */
  things: Placed[];
  marks: Mark[];
  /** A hint's ring, in tiles, or null. */
  hint: { x: number; y: number; radius: number } | null;
  /** The phone asked for less motion: nothing pulses or fades. */
  calm: boolean;
};

function drawSprite(ctx: CanvasRenderingContext2D, art: BlockArt, key: string, x: number, y: number): void {
  const [sx, sy, w, h] = BLOCK_ATLAS[key];
  ctx.drawImage(art.sprites, sx, sy, w, h, Math.round(x * BLOCK_TILE - w / 2), Math.round(y * BLOCK_TILE - h), w, h);
}

/** A ring round a found risk, with a tick, in green, and a white rim so it
 *  shows on grass and roof alike. */
function drawFound(ctx: CanvasRenderingContext2D, mark: Mark): void {
  const cx = mark.x;
  const cy = mark.y - mark.h / 2;
  const radius = Math.max(mark.w, mark.h) / 2 + 3;
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#2fbf5b';
  ctx.stroke();
  // The tick, in a small green disc at the ring's upper right.
  const tx = cx + radius * 0.7;
  const ty = cy - radius * 0.7;
  ctx.fillStyle = '#2fbf5b';
  ctx.beginPath();
  ctx.arc(tx, ty, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(tx - 2.4, ty);
  ctx.lineTo(tx - 0.6, ty + 1.8);
  ctx.lineTo(tx + 2.6, ty - 1.8);
  ctx.stroke();
}

/** A cross where a wrong tap landed, fading over a second. */
function drawWrong(ctx: CanvasRenderingContext2D, mark: Mark, time: number, calm: boolean): void {
  const age = time - mark.at;
  const fade = calm ? (age < 1.2 ? 1 : 0) : Math.max(0, 1 - age / 1.2);
  if (fade <= 0) return;
  ctx.globalAlpha = fade;
  ctx.lineCap = 'round';
  for (const [width, colour] of [[4, '#ffffff'], [2, '#d8402e']] as const) {
    ctx.lineWidth = width;
    ctx.strokeStyle = colour;
    ctx.beginPath();
    ctx.moveTo(mark.x - 5, mark.y - 5);
    ctx.lineTo(mark.x + 5, mark.y + 5);
    ctx.moveTo(mark.x + 5, mark.y - 5);
    ctx.lineTo(mark.x - 5, mark.y + 5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** One whole frame. The canvas is in device pixels; the camera says where
 *  the picture starts over the yard and how many device pixels a source
 *  pixel covers. */
export function drawBlock(canvas: HTMLCanvasElement, art: BlockArt, scene: BlockScene): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { left, top, scale } = scene.camera;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#2b4a2a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, Math.round(-left * scale), Math.round(-top * scale));
  ctx.drawImage(art.yard, 0, 0);

  const standing = [...BLOCK_SCENERY, ...scene.things].sort((a, b) => a.y - b.y);
  for (const thing of standing) drawSprite(ctx, art, thing.sprite, thing.x, thing.y);

  for (const mark of scene.marks) {
    if (mark.kind === 'found') drawFound(ctx, mark);
    else drawWrong(ctx, mark, scene.time, scene.calm);
  }

  if (scene.hint) {
    const pulse = scene.calm ? 1 : 0.75 + 0.25 * Math.sin(scene.time * 5);
    const radius = scene.hint.radius * BLOCK_TILE;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = `rgba(255, 211, 77, ${pulse})`;
    ctx.beginPath();
    ctx.arc(scene.hint.x * BLOCK_TILE, scene.hint.y * BLOCK_TILE, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
