import { expect, test } from '@playwright/test';
import { magneticDeclinationDeg } from '../src/core/geo';
import { acknowledgeFirstOpen } from './helpers';

// The dial turns with the phone: the compass hook writes the heading to the
// document root once per frame, and the pin's CSS rotates by bearing minus
// heading. A vague fix still draws it, with its error stated beside it.
// (BS_Enhancement-AC1 replaced the arrows list with one dial; every behaviour
// this spec held for the arrows is held here for the pin.)
test('the dial turns with the phone and stays drawn from a vague fix', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: -37.817939, longitude: 145.36594, accuracy: 350 });
  // A controllable clock, running in real time until the last step pauses it.
  await page.clock.install();
  await acknowledgeFirstOpen(page);
  await page.goto('/');
  // The site list is copied into IndexedDB on app start, and BlackSky reads it
  // once, on arrival: wait for the copy itself rather than for a fixed time.
  await expect.poll(() => page.evaluate(async () => {
    // Opening a database the app has not made yet would make an empty one.
    if (!(await indexedDB.databases()).some((db) => db.name === 'cooeee')) return false;
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('cooeee');
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    try {
      if (!database.objectStoreNames.contains('snapshots')) return false;
      const count = database.transaction('snapshots').objectStore('snapshots').count();
      return await new Promise<boolean>((resolve, reject) => {
        count.onsuccess = () => resolve(count.result > 0);
        count.onerror = () => reject(count.error);
      });
    } finally {
      database.close();
    }
  })).toBe(true);
  // A typed address opens BlackSky only for a visit that never ended.
  await page.evaluate(() => localStorage.setItem('cooeee.blacksky.v1', 'latched'));
  await page.goto('/blacksky');

  await expect(page.getByText('NEAREST PLACE OF LAST RESORT', { exact: true })).toBeVisible();
  // The bottom bar is on every other screen; BlackSky's only exit is its own.
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
  // No living background in BlackSky: every pixel that can stay off does.
  await expect(page.locator('canvas.particles')).toHaveCount(0);
  await expect(page.getByText(/GPS ± 350 m here/)).toBeVisible();
  // UAT: the figure is named, and its meaning opens behind the ring.
  await expect(page.getByText('Your position ± 350 m')).toBeVisible();
  await page.getByRole('button', { name: 'About your position' }).click();
  await expect(page.getByText(/places you within 350 m/)).toBeVisible();
  await expect(page.getByText('North up', { exact: true })).toBeVisible();

  const pin = page.locator('.blacksky-dial-pin');
  const bearing = Number(await pin.evaluate((el: SVGElement) => el.style.getPropertyValue('--bearing')));
  const rotation = () =>
    pin.evaluate((el) => {
      const m = new DOMMatrix(getComputedStyle(el).transform);
      return Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI);
    });
  const norm = (deg: number) => ((Math.round(deg) % 360) + 360) % 360;
  expect(norm(await rotation())).toBe(norm(bearing));

  // Facing magnetic east (Android reports alpha 270), which is true east plus
  // the local declination: the pin for a place at bearing B now sits at
  // B − (90 + declination) on the screen.
  await page.evaluate(() =>
    window.dispatchEvent(
      new DeviceOrientationEvent('deviceorientationabsolute', { alpha: 270, absolute: true }),
    ),
  );
  await expect(page.getByText('North up', { exact: true })).toBeHidden();
  const declination = magneticDeclinationDeg({ lat: -37.817939, lon: 145.36594 });
  // The text renders on the reading; the heading lands on the next display
  // frame, so wait for the frame rather than sample the transform at once.
  await expect.poll(async () => norm(await rotation())).toBe(norm(bearing - 90 - declination));

  // The figure follows the phone: a fix from two kilometres further north
  // changes the distance at once. The clock is paused first, so the one-second
  // tick cannot be what moves it; only the immediate path for a move of
  // FIX_PUBLISH_M or more can.
  const figure = page.locator('.blacksky-figure-main').first();
  const before = (await figure.textContent()) ?? '';
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
  await context.setGeolocation({ latitude: -37.8, longitude: 145.36594, accuracy: 350 });
  await expect(figure).not.toHaveText(before, { timeout: 2_000 });
});
