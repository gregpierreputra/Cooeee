import { describe, expect, it } from 'vitest';
import { BLOCK_HEIGHT, BLOCK_WIDTH } from '../../src/core/block-layout';
import { centredOn, clampCamera, isTap, panBy, pinchScale, screenToYard, zoomAbout, zoomLevels } from '../../src/core/block-view';

const PHONE = { width: 1080, height: 2100 };

describe('the camera over the yard', () => {
  it('offers zooms from the whole yard to close up, starting about fourteen tiles across', () => {
    const levels = zoomLevels(PHONE);
    expect(levels.min).toBe(1);
    expect(levels.start).toBe(5);
    expect(levels.max).toBeGreaterThanOrEqual(levels.start);
    expect(zoomLevels({ width: 4000, height: 3000 }).min).toBe(6);
  });

  it('keeps the yard on screen, and centres a side smaller than the view', () => {
    const far = clampCamera({ left: 9999, top: -50, scale: 5 }, PHONE);
    expect(far.left).toBe(BLOCK_WIDTH - PHONE.width / 5);
    expect(far.top).toBe(0);
    const whole = clampCamera({ left: 0, top: 0, scale: 1 }, PHONE);
    expect(whole.left).toBe(-(PHONE.width - BLOCK_WIDTH) / 2);
    expect(whole.top).toBe(-(PHONE.height - BLOCK_HEIGHT) / 2);
  });

  it('keeps the point under the fingers where it is when zooming', () => {
    const camera = centredOn(280, 200, 4, PHONE);
    const before = screenToYard(500, 900, camera);
    const after = screenToYard(500, 900, zoomAbout(camera, 5, 500, 900, PHONE));
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('moves the picture with a drag', () => {
    const camera = centredOn(280, 200, 4, PHONE);
    const moved = panBy(camera, 40, 0, PHONE);
    expect(moved.left).toBeCloseTo(camera.left - 10);
  });

  it('turns a pinch into a whole zoom within the levels', () => {
    expect(pinchScale(4, 1.6, { min: 1, max: 9 })).toBe(6);
    expect(pinchScale(4, 10, { min: 1, max: 9 })).toBe(9);
    expect(pinchScale(4, 0.01, { min: 1, max: 9 })).toBe(1);
  });

  it('tells a tap from a drag', () => {
    expect(isTap(3, 120, 10)).toBe(true);
    expect(isTap(30, 120, 10)).toBe(false);
    expect(isTap(3, 2000, 10)).toBe(false);
  });
});
