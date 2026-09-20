import { expect, test, type Page } from '@playwright/test';
import { relativeBearing } from '../src/core/blacksky-dial';
import { COMPASS_SILENT_MS, FIX_STALE_MS, TICK_MS } from '../src/core/constants';
import { MARK_AT_SAVED_PLACE, TURN_ON_COMPASS } from '../src/core/copy';
import { magneticDeclinationDeg } from '../src/core/geo';
import { titleCase } from '../src/core/home';
import {
  AT_FERNY_CREEK,
  drawnAngle,
  openDial,
  pushPosition,
  turnPhone,
} from './blacksky-position';

// BS_Enhancement-AC2: say plainly when position or heading cannot be trusted.
// One test for the card's Normal state and one for each honest drawing: an old
// position, a position from a mark, no compass, a silent compass, and movement.
// (The card's Unavailable state, no position at all, is the no-fix reference
// screen, covered in blacksky-dial.spec.ts.)

const bar = (page: Page) => page.getByRole('status').filter({ hasText: 'GPS signal lost' });
const tag = (page: Page) => page.getByText('North up', { exact: true });
const figures = (page: Page) => page.locator('.blacksky-dial-figures');
const centre = (page: Page) => page.locator('.blacksky-dial');
const heading = (page: Page) =>
  page.evaluate(() => document.documentElement.style.getPropertyValue('--heading'));
const colour = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => getComputedStyle(el).color);

// True north is magnetic north plus the local declination; the pin and the ring
// are asserted against the same rule the stylesheet applies.
const DECLINATION = magneticDeclinationDeg({ lat: AT_FERNY_CREEK.latitude, lon: AT_FERNY_CREEK.longitude });
const FACING_EAST = 270; // Android's alpha when the top of the phone points east
const norm = (deg: number) => ((Math.round(deg) % 360) + 360) % 360;

test('Normal: a fresh position and a live heading show no bar and no tag', async ({ page }) => {
  await openDial(page, 'pack');
  await pushPosition(page, AT_FERNY_CREEK);
  await turnPhone(page, FACING_EAST);

  await expect(tag(page)).toBeHidden();
  // Never a bar saying GPS signal lost while the position is fresh.
  await expect(bar(page)).toHaveCount(0);
  await expect(page.getByText('about', { exact: true })).toHaveCount(0);
  await expect(figures(page)).toHaveAttribute('data-about', 'false');
  await expect(centre(page)).toHaveAttribute('data-centre', 'arrow');

  // The ring has turned against the heading, and the pin (due north) sits where
  // the rule puts it: to the left of a person facing east.
  const east = 90 + DECLINATION;
  await expect.poll(() => drawnAngle(page, '.blacksky-dial-ring')).toBe(norm(-east));
  expect(await drawnAngle(page, '.blacksky-dial-pin')).toBe(norm(relativeBearing(0, east)));
});

test('an old position shows the bar and a dimmed about distance, and a fresh one removes both', async ({
  page,
}) => {
  await page.clock.install();
  await openDial(page, 'pack');
  await pushPosition(page, AT_FERNY_CREEK);
  await expect(page.locator('.blacksky-figure-main')).toHaveText('2.60 km');
  const fullStrength = await colour(page, '.blacksky-figure-main');

  // Location goes quiet. Past the stale limit, at the next tick, the bar is up.
  await page.clock.fastForward(FIX_STALE_MS + TICK_MS);
  await expect(page.getByText('GPS signal lost', { exact: true })).toBeVisible();
  // WCAG 4.1.3: the words are a status, so they are announced without a move
  // of focus; the age beside them changes every tick and is outside the status.
  await expect(bar(page)).toHaveText('GPS signal lost');
  await expect(page.locator('.blacksky-bar')).toContainText(/last position \d+ s ago/);
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);

  await expect(page.getByText('about', { exact: true })).toBeVisible();
  await expect(figures(page)).toHaveAttribute('data-about', 'true');
  expect(await colour(page, '.blacksky-figure-main')).not.toBe(fullStrength);

  // The dial keeps turning on an old position, with the arrow drawn hollow.
  await turnPhone(page, FACING_EAST);
  await expect(centre(page)).toHaveAttribute('data-centre', 'outline');
  await expect.poll(() => drawnAngle(page, '.blacksky-dial-ring')).toBe(norm(-(90 + DECLINATION)));

  // Location comes back: the bar goes and the distance returns to full
  // strength, with no reload.
  await pushPosition(page, { ...AT_FERNY_CREEK, latitude: -37.879 });
  await expect(bar(page)).toHaveCount(0);
  await expect(page.getByText('about', { exact: true })).toHaveCount(0);
  await expect(figures(page)).toHaveAttribute('data-about', 'false');
  expect(await colour(page, '.blacksky-figure-main')).toBe(fullStrength);
});

test('a vague position is prefixed about, with no bar while it is fresh', async ({ page }) => {
  await openDial(page, 'pack');
  await pushPosition(page, { ...AT_FERNY_CREEK, accuracy: 100 });
  await expect(figures(page)).toHaveAttribute('data-about', 'false');

  await pushPosition(page, { ...AT_FERNY_CREEK, latitude: -37.879, accuracy: 101 });
  await expect(page.getByText('about', { exact: true })).toBeVisible();
  await expect(bar(page)).toHaveCount(0);
});

test('a position from a mark shows the bar with from your saved place, and the saved-place glyph', async ({
  page,
}) => {
  await openDial(page, 'pack');
  await page
    .getByRole('button', { name: MARK_AT_SAVED_PLACE(titleCase('10 OLD ROAD FERNY CREEK 3786')) })
    .click();

  await expect(page.getByText('GPS signal lost', { exact: true })).toBeVisible();
  await expect(page.locator('.blacksky-bar')).toContainText('from your saved place');
  await expect(centre(page)).toHaveAttribute('data-centre', 'saved-place');
  await expect(page.getByText('about', { exact: true })).toBeVisible();
  // E3-US1-AC4's own words stay: always ESTIMATE, the uncertainty growing.
  await expect(page.getByText(/^ESTIMATE from your marked position, ± \d+ m and growing$/)).toBeVisible();

  // A real fix always beats the mark: the bar and the glyph go.
  await pushPosition(page, AT_FERNY_CREEK);
  await expect(bar(page)).toHaveCount(0);
  await expect(centre(page)).not.toHaveAttribute('data-centre', 'saved-place');
});

test('with no compass the dial is north up, with a dot and the tag', async ({ page }) => {
  await openDial(page, 'pack');
  await pushPosition(page, AT_FERNY_CREEK);

  await expect(tag(page)).toBeVisible();
  await expect(centre(page)).toHaveAttribute('data-centre', 'dot');
  expect(await heading(page)).toBe('');
  expect(await drawnAngle(page, '.blacksky-dial-ring')).toBe(0);
  // This browser hands the sensor over without asking, so no button is offered.
  await expect(page.getByRole('button', { name: TURN_ON_COMPASS })).toHaveCount(0);
});

test('with compass permission refused the dial stays north up, with a dot and the tag', async ({ page }) => {
  // An iPhone: the sensor is only handed over after a tap, and may be refused.
  await page.addInitScript(() => {
    (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission =
      async () => 'denied';
  });
  await openDial(page, 'pack');
  await pushPosition(page, AT_FERNY_CREEK);

  const turnOn = page.getByRole('button', { name: TURN_ON_COMPASS });
  await expect(turnOn).toBeVisible();
  const box = (await turnOn.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  await turnOn.click();

  // Refused: a reading that arrives anyway is not listened to.
  await turnPhone(page, FACING_EAST);
  await expect(tag(page)).toBeVisible();
  await expect(centre(page)).toHaveAttribute('data-centre', 'dot');
  expect(await heading(page)).toBe('');
  await expect(turnOn).toBeVisible();
});

test('a compass that goes silent for 3 seconds stops turning the dial', async ({ page }) => {
  await openDial(page, 'pack');
  await pushPosition(page, AT_FERNY_CREEK);
  await turnPhone(page, FACING_EAST);
  await expect(tag(page)).toBeHidden();
  await expect(centre(page)).toHaveAttribute('data-centre', 'arrow');
  expect(await heading(page)).not.toBe('');

  // No further reading. Never a turning dial once the sensor has been silent
  // for COMPASS_SILENT_MS: north up, a dot, the tag.
  await expect(tag(page)).toBeVisible({ timeout: COMPASS_SILENT_MS + 3_000 });
  await expect(centre(page)).toHaveAttribute('data-centre', 'dot');
  expect(await heading(page)).toBe('');
  expect(await drawnAngle(page, '.blacksky-dial-ring')).toBe(0);

  // A reading arrives again and the dial turns again.
  await turnPhone(page, FACING_EAST);
  await expect(tag(page)).toBeHidden();
});

test('at 9.9 km/h the compass drives the dial; at 10.1 km/h with a GPS heading, movement does', async ({
  page,
}) => {
  await openDial(page, 'pack');
  const kmh = (n: number) => n / 3.6;
  const compassHeading = String((90 + DECLINATION + 360) % 360);

  await pushPosition(page, { ...AT_FERNY_CREEK, heading: 200, speed: kmh(9.9) });
  await turnPhone(page, FACING_EAST);
  await expect.poll(() => heading(page)).toBe(compassHeading);

  // Faster than 10 km/h: the direction of movement, already true north.
  await pushPosition(page, { ...AT_FERNY_CREEK, heading: 200, speed: kmh(10.1) });
  await expect.poll(() => heading(page)).toBe('200');
  expect(await drawnAngle(page, '.blacksky-dial-ring')).toBe(norm(-200));
  await expect(centre(page)).toHaveAttribute('data-centre', 'arrow');

  // Fast, but the position sensor gives no heading: back to the compass.
  await turnPhone(page, FACING_EAST);
  await pushPosition(page, { ...AT_FERNY_CREEK, heading: null, speed: kmh(60) });
  await expect.poll(() => heading(page)).toBe(compassHeading);
});

test('movement turns the dial even where the compass was never allowed', async ({ page }) => {
  await page.addInitScript(() => {
    (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission =
      async () => 'denied';
  });
  await openDial(page, 'pack');
  await pushPosition(page, { ...AT_FERNY_CREEK, heading: 45, speed: 15 });

  await expect.poll(() => heading(page)).toBe('45');
  await expect(tag(page)).toBeHidden();
});
