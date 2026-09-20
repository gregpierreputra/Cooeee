import type { Page } from '@playwright/test';
import { HARNESS } from './helpers';

// The browser's own geolocation emulation gives a latitude, a longitude and an
// accuracy, and nothing else. The dial's honest states also need a direction of
// movement, a speed, and a sensor that goes quiet on demand, so these specs put
// their own position source under the screen: watchPosition only registers the
// callback, and a position arrives when the spec pushes one.

export type PushedPosition = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number | null;
  speed?: number | null;
};

declare global {
  interface Window {
    __pushPosition: (position: PushedPosition) => void;
    __watching: () => boolean;
  }
}

/** Ferny Creek, the centre of the harness pack: inside its area. */
export const AT_FERNY_CREEK = { latitude: -37.88, longitude: 145.34 };
/** Melbourne's centre: well outside the harness pack's 6 km area. */
export const AT_MELBOURNE = { latitude: -37.8136, longitude: 144.9631 };

/** A card's phone: 390 by 844. */
export const PHONE = { width: 390, height: 844 };

export async function stubPositions(page: Page) {
  await page.addInitScript(() => {
    const watchers = new Map<number, PositionCallback>();
    let nextId = 1;
    Geolocation.prototype.watchPosition = (onPosition) => {
      watchers.set(nextId, onPosition);
      return nextId++;
    };
    Geolocation.prototype.clearWatch = (id) => {
      watchers.delete(id);
    };
    window.__watching = () => watchers.size > 0;
    window.__pushPosition = ({ latitude, longitude, accuracy = 10, heading = null, speed = null }) => {
      const coords = { latitude, longitude, accuracy, heading, speed, altitude: null, altitudeAccuracy: null };
      for (const onPosition of [...watchers.values()])
        onPosition({ coords, timestamp: Date.now() } as GeolocationPosition);
    };
  });
}

/** Deliver one position. The screen registers its watch after its first
 *  render, so this waits for the watch rather than push into nothing. */
export async function pushPosition(page: Page, position: PushedPosition) {
  await page.waitForFunction(() => window.__watching());
  await page.evaluate((p) => window.__pushPosition(p), position);
}

/** Open the harness BlackSky in one of its dial modes (see e2e/harness). */
export async function openDial(page: Page, mode: 'pack' | 'no-pack' | 'empty' | 'pack-only') {
  await page.setViewportSize(PHONE);
  await stubPositions(page);
  await page.goto(`${HARNESS}/blacksky?dial=${mode}`);
}

/** One reading from the orientation sensor, as Chrome on Android reports it:
 *  alpha is the rotation away from magnetic north, so facing east is 270. */
export const turnPhone = (page: Page, alpha: number) =>
  page.evaluate(
    (a) =>
      window.dispatchEvent(
        new DeviceOrientationEvent('deviceorientationabsolute', { alpha: a, absolute: true }),
      ),
    alpha,
  );

/** The angle an element is drawn at on the screen, whole degrees, 0 to 359. */
export const drawnAngle = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return (Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI) + 360) % 360;
  });
