import { expect, test } from '@playwright/test';
import { TICK_MS } from '../src/core/constants';
import { magneticDeclinationDeg } from '../src/core/geo';
import { acknowledgeFirstOpen } from './helpers';

// The arrows turn with the phone: the compass hook writes the heading to the
// document root once per frame, and each arrow's CSS rotates by bearing minus
// heading. A vague fix still draws them, with its error stated beside them.
test('the arrows turn with the phone and stay drawn from a vague fix', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: -37.817939, longitude: 145.36594, accuracy: 350 });
  await acknowledgeFirstOpen(page);
  await page.goto('/');
  await page.waitForTimeout(1000); // the site list is copied into IndexedDB on app start
  await page.goto('/blacksky');

  await expect(page.getByText('Nearest official places of last resort')).toBeVisible();
  await expect(page.getByText(/GPS is only accurate to ± 350 m/)).toBeVisible();
  await expect(page.getByText('The arrow is drawn with north at the top of the screen.')).toBeVisible();

  const arrow = page.locator('.blacksky-arrow').first();
  const bearing = Number(await arrow.evaluate((el) => el.style.getPropertyValue('--bearing')));
  const rotation = () =>
    arrow.evaluate((el) => {
      const m = new DOMMatrix(getComputedStyle(el).transform);
      return Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI);
    });
  const norm = (deg: number) => ((Math.round(deg) % 360) + 360) % 360;
  expect(norm(await rotation())).toBe(norm(bearing));

  // Facing magnetic east (Android reports alpha 270), which is true east plus
  // the local declination: an arrow to a place at bearing B now sits at
  // B − (90 + declination) on the screen.
  await page.evaluate(() =>
    window.dispatchEvent(
      new DeviceOrientationEvent('deviceorientationabsolute', { alpha: 270, absolute: true }),
    ),
  );
  await expect(page.getByText('The arrow turns with your phone.')).toBeVisible();
  const declination = magneticDeclinationDeg({ lat: -37.817939, lon: 145.36594 });
  expect(norm(await rotation())).toBe(norm(bearing - 90 - declination));

  // The figure follows the phone: a fix from two kilometres further north
  // changes the distance within one tick.
  const figure = page.locator('.blacksky-figure-main').first();
  const before = (await figure.textContent()) ?? '';
  await context.setGeolocation({ latitude: -37.8, longitude: 145.36594, accuracy: 350 });
  await expect(figure).not.toHaveText(before, { timeout: TICK_MS + 5_000 });
});
