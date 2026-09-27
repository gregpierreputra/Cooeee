import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { HOLD_LEAVE_MARGIN_PX, HOLD_MS } from '../src/core/constants';
import { HOLD_FOR_BLACKSKY, HOLD_TO_ENTER } from '../src/core/copy';
import { acknowledgeFirstOpen } from './helpers';

// The hold under a real finger. A mouse sits perfectly still and never
// long-presses, so the mouse specs could not see what a phone does: a finger
// rolls a few pixels in two seconds, and a long press raises the context menu.
// These specs drive the browser's own touch input (not synthetic DOM events),
// so the pointer is a true touch pointer: it is captured, it obeys
// touch-action, and the browser may cancel it, exactly as on a phone. Against
// the real bundle, on Home, where the bug was seen.
//
// The viewport is short on purpose. On a phone the browser's own bars leave
// Home taller than the screen, so the page can scroll; and only a page that can
// scroll lets the browser take a small finger movement for the start of a pan
// and cancel the pointer. A tall viewport would hide the very thing under test.

test.use({ hasTouch: true, viewport: { width: 390, height: 520 } });

const FULL_HOLD = HOLD_MS + 600;
const hold = (page: Page) => page.getByRole('button', { name: HOLD_FOR_BLACKSKY });

type Point = { x: number; y: number };

/** A finger, through the browser's input pipeline. */
async function finger(page: Page) {
  const cdp: CDPSession = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', at?: Point) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: at ? [{ x: at.x, y: at.y }] : [] });
  return {
    down: (at: Point) => touch('touchStart', at),
    move: (at: Point) => touch('touchMove', at),
    up: () => touch('touchEnd'),
  };
}

async function openHome(page: Page) {
  await acknowledgeFirstOpen(page);
  await page.goto('/');
  await hold(page).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(true);
  const box = (await hold(page).boundingBox())!;
  return { box, centre: { x: box.x + box.width / 2, y: box.y + box.height / 2 } };
}

test('a touch hold with the small movement of a real finger completes', async ({ page }) => {
  const { centre } = await openHome(page);
  const touch = await finger(page);

  // The finger rolls and drifts for the whole hold, always on the button, by
  // more than the few pixels a browser allows before it calls a touch a pan.
  await touch.down(centre);
  for (let i = 1; i <= 8; i += 1) {
    await page.waitForTimeout(FULL_HOLD / 8);
    if (page.url().endsWith('/blacksky')) break;
    await touch.move({ x: centre.x + (i % 2 ? 9 : -6), y: centre.y + Math.min(3 * i, 20) });
  }
  await expect(page).toHaveURL('/blacksky');
  await touch.up();
});

test('a touch hold that slips just past the edge, inside the margin, still completes', async ({ page }) => {
  const { box, centre } = await openHome(page);
  const touch = await finger(page);

  await touch.down({ x: centre.x, y: box.y + box.height - 4 });
  await page.waitForTimeout(400);
  await touch.move({ x: centre.x, y: box.y + box.height + HOLD_LEAVE_MARGIN_PX - 4 });
  await expect(page).toHaveURL('/blacksky', { timeout: 5_000 });
  await touch.up();
  await expect(page.getByText(HOLD_TO_ENTER)).toHaveCount(0);
});

test('a touch hold that moves well off the button cancels and shows the hint', async ({ page }) => {
  const { box, centre } = await openHome(page);
  const touch = await finger(page);

  await touch.down(centre);
  await page.waitForTimeout(400);
  await touch.move({ x: centre.x, y: box.y - HOLD_LEAVE_MARGIN_PX - 40 });
  await expect(page.getByText(HOLD_TO_ENTER)).toBeVisible();

  // Coming back onto the button does not revive the hold: it was cancelled.
  await touch.move(centre);
  await page.waitForTimeout(FULL_HOLD);
  await touch.up();
  await expect(page).toHaveURL('/');
});

test('the long-press menu of a touch does not cancel the hold, and never opens', async ({ page }) => {
  const { centre } = await openHome(page);
  const touch = await finger(page);

  await touch.down(centre);
  await page.waitForTimeout(600); // about when a phone raises its long-press menu
  const prevented = await hold(page).evaluate((button, at) => {
    const menu = new PointerEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
      clientX: at.x,
      clientY: at.y,
    });
    button.dispatchEvent(menu);
    return menu.defaultPrevented;
  }, centre);
  expect(prevented).toBe(true);
  await expect(page.getByText(HOLD_TO_ENTER)).toHaveCount(0);

  await expect(page).toHaveURL('/blacksky', { timeout: 5_000 });
  await touch.up();
});

test.describe('a mouse', () => {
  test.use({ hasTouch: false });

  test('a right click never enters, however long it is held', async ({ page }) => {
    const { centre } = await openHome(page);
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down({ button: 'right' });
    await page.waitForTimeout(FULL_HOLD);
    await page.mouse.up({ button: 'right' });
    await expect(page).toHaveURL('/');
  });

  test('a menu opened during a left-button hold still cancels it', async ({ page }) => {
    const { centre } = await openHome(page);
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    await page.waitForTimeout(400);
    // The menu swallows the pointerup, so the hold must end here or it would
    // run on with no finger on it.
    const prevented = await hold(page).evaluate((button) => {
      const menu = new PointerEvent('contextmenu', { bubbles: true, cancelable: true, pointerType: 'mouse' });
      button.dispatchEvent(menu);
      return menu.defaultPrevented;
    });
    expect(prevented).toBe(false);
    await expect(page.getByText(HOLD_TO_ENTER)).toBeVisible();
    await page.waitForTimeout(FULL_HOLD);
    await page.mouse.up();
    await expect(page).toHaveURL('/');
  });

  test('a wobble inside the margin does not cancel, and moving well off does', async ({ page }) => {
    const { box, centre } = await openHome(page);
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    await page.mouse.move(centre.x + 12, box.y - HOLD_LEAVE_MARGIN_PX + 6);
    await page.waitForTimeout(300);
    await expect(page.getByText(HOLD_TO_ENTER)).toHaveCount(0);
    await page.mouse.move(centre.x, box.y - HOLD_LEAVE_MARGIN_PX - 40);
    await expect(page.getByText(HOLD_TO_ENTER)).toBeVisible();
    await page.waitForTimeout(FULL_HOLD);
    await page.mouse.up();
    await expect(page).toHaveURL('/');
  });
});
