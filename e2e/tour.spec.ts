import { expect, test, type Page } from '@playwright/test';
import {
  ABOUT_BLACKSKY,
  ABOUT_COOEEE,
  ACKNOWLEDGE_CHECKBOX,
  BLACKSKY_INFO_LINES,
  CONTINUE,
  COOEEE_INFO_LINES,
  SEE_HOW_IT_WORKS,
  SKIP_TOUR,
  TOUR_BACK,
  TOUR_HINT,
  TOUR_NEXT,
  TOUR_STEPS,
  WELCOME_SAY,
} from '../src/core/copy';
import { acknowledgeFirstOpen, passGate } from './helpers';

// The guided tour on the real bundle: it starts once, right after the
// first-open acknowledgement, with a welcome, then walks across screens and
// can be skipped; a returning user starts it from the ring and can leave it
// with Escape.
const N = TOUR_STEPS.length + 1;
const count = (n: number) => `${n}/${N}`;
// The grey never lifts: at every moment the layer either dims the screen
// itself or holds the spotlight whose shadow dims it.
const dimmed = (page: Page) => expect(page.locator('.tour.tour-dim, .tour:has(.tour-spot)')).toHaveCount(1);
const box = async (page: Page, selector: string) => (await page.locator(selector).boundingBox())!;

// UAT: the feature must never sit under the panel or the bars above it.
async function inTheClear(page: Page) {
  const spot = await box(page, '.tour-spot');
  const panel = await box(page, '.tour-panel');
  const header = await box(page, '.app-header');
  expect(spot.y + spot.height).toBeLessThanOrEqual(panel.y + 1);
  expect(spot.y).toBeGreaterThanOrEqual(header.y + header.height - 9);
}

test('opens on a welcome, steps across screens with the controls held still, and skips', async ({ page }) => {
  await passGate(page);
  await page.goto('/');
  await page.getByRole('button', { name: SEE_HOW_IT_WORKS }).click();
  await page.getByRole('checkbox', { name: ACKNOWLEDGE_CHECKBOX }).check();
  await page.getByRole('button', { name: CONTINUE }).click();

  // The welcome: the name, how it is said, and the old About lines behind a toggle.
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(count(1));
  await expect(dialog).toContainText(WELCOME_SAY);
  await expect(page.locator('.tour-spot')).toHaveCount(0);
  await expect(dialog.getByText(COOEEE_INFO_LINES[0].text)).toBeHidden();
  await dialog.getByText(ABOUT_COOEEE).click();
  await expect(dialog.getByText(COOEEE_INFO_LINES[0].text)).toBeVisible();
  // Back has nothing to do yet, but keeps its room.
  await expect(dialog.getByRole('button', { name: TOUR_BACK })).toBeHidden();

  const next = dialog.getByRole('button', { name: TOUR_NEXT });
  await next.click();
  await dimmed(page);
  await expect(dialog).toContainText(count(2));
  await expect(page.locator('.tour-spot')).toBeVisible();
  await inTheClear(page);
  // UAT: Next does not move from stop to stop.
  const nextAt = (await next.boundingBox())!;

  await dialog.getByRole('button', { name: TOUR_BACK }).click();
  await dimmed(page);
  await expect(dialog).toContainText(count(1));
  await next.click();

  // Stop eight is the address search: the tour moves there itself.
  for (let i = 2; i < 8; i += 1) {
    await next.click();
    await dimmed(page);
  }
  await expect(dialog).toContainText(count(8));
  await expect(page).toHaveURL(/\/packs\/new$/);
  await expect(page.locator('.tour-spot')).toBeVisible();
  await inTheClear(page);
  expect((await next.boundingBox())!.y).toBeCloseTo(nextAt.y, 0);

  // The page still scrolls beneath the tour, and the spotlight follows it.
  // Scrolled whichever way has room: bringing the feature into view may
  // already have taken the page to its foot.
  const before = await box(page, '.tour-spot');
  const atTop = await page.evaluate(() => window.scrollY === 0);
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.wheel(0, atTop ? 200 : -200);
  await expect.poll(async () => Math.round((await box(page, '.tour-spot')).y)).not.toBe(Math.round(before.y));

  // Stop ten is Rehearse: with no pack saved it lands on the entry screen.
  await next.click();
  await dimmed(page);
  await next.click();
  await dimmed(page);
  await expect(dialog).toContainText(count(10));
  await expect(page).toHaveURL(/\/rehearse$/);
  await expect(page.locator('.tour-spot')).toBeVisible();

  await dialog.getByRole('button', { name: SKIP_TOUR }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});

test('never starts on a later open; the ring starts it and Escape ends it', async ({ page }) => {
  await acknowledgeFirstOpen(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: TOUR_HINT })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: TOUR_HINT }).click();
  await expect(page.getByRole('dialog')).toContainText(count(1));
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

// UAT: on a phone, every stop's feature is brought clear of the panel and the
// bars, the fixed bars themselves excepted, which are always in view. A
// screen's stop also rings the tab that opens it.
test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('every stop shows its feature in the clear', async ({ page }) => {
    await acknowledgeFirstOpen(page);
    await page.goto('/');
    await page.getByRole('button', { name: TOUR_HINT }).click();
    const dialog = page.getByRole('dialog');
    for (let stop = 2; stop <= N; stop += 1) {
      await dialog.getByRole('button', { name: TOUR_NEXT }).click();
      await expect(dialog).toContainText(count(stop));
      await expect(page.locator('.tour-spot')).toBeVisible();
      // The header, the bottom bar and the compass in it are fixed bars, in
      // view by design, so only the features on the page are checked.
      if (!['.app-header-inner', '.bottom-nav-inner', '.nav-blacksky'].includes(TOUR_STEPS[stop - 2].target)) await inTheClear(page);
      // Nearby, Rehearse and Recover also ring their tab in the bottom bar.
      await expect(page.locator('.tour-tab-spot')).toHaveCount('tab' in TOUR_STEPS[stop - 2] ? 1 : 0);
      if (stop === N) break;
    }
  });
});

// BlackSky's stop points at the compass in the tab bar, and carries what the
// mode does behind its own toggle.
test('the BlackSky stop rings the compass and opens what BlackSky does', async ({ page }) => {
  await acknowledgeFirstOpen(page);
  await page.goto('/');
  await page.getByRole('button', { name: TOUR_HINT }).click();
  const dialog = page.getByRole('dialog');
  const stop = TOUR_STEPS.findIndex((step) => step.target === '.nav-blacksky') + 2;
  for (let n = 2; n <= stop; n += 1) await dialog.getByRole('button', { name: TOUR_NEXT }).click();
  await expect(dialog).toContainText(count(stop));
  const spot = (await page.locator('.tour-spot').boundingBox())!;
  const compass = (await page.locator('.nav-blacksky').boundingBox())!;
  expect(Math.abs(spot.x + spot.width / 2 - (compass.x + compass.width / 2))).toBeLessThan(2);
  await dialog.getByText(ABOUT_BLACKSKY).click();
  await expect(dialog.getByText(BLACKSKY_INFO_LINES[0].text)).toBeVisible();
});
