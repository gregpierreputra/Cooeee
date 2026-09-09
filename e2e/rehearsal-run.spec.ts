import { expect, test, type Page } from '@playwright/test';
import { deviceStorage } from './helpers';

const ORIGIN = 'http://127.0.0.1:4174';
const REHEARSABLE = `${ORIGIN}/rehearse?mode=rehearsable`;
const EMPTY = `${ORIGIN}/rehearse?mode=empty`;
const UNREADABLE = `${ORIGIN}/rehearse?mode=unreadable`;

const NO_DATA = 'No mobile data';
const NO_FIX = 'No location fix';
const CHOOSE_HEADING = 'What are we rehearsing without?';

const bar = (page: Page) => page.locator('.rehearsal-bar');

/** Start a run by choosing a condition, exactly as a user does. */
async function startRun(page: Page, condition: string) {
  await page.goto(REHEARSABLE);
  await expect(page.getByRole('heading', { name: CHOOSE_HEADING })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(condition) }).click();
  await expect(bar(page)).toBeVisible();
}

// E5-US1-AC2 — a rehearsal is never mistaken for the real thing.

test.describe('AC2 the bar marks the run', () => {
  // TC-5.1.2-A
  for (const condition of [NO_DATA, NO_FIX]) {
    test(`renders on the run and names "${condition}"`, async ({ page }) => {
      await startRun(page, condition);

      await expect(bar(page)).toContainText('Rehearsal');
      await expect(page.locator('.rehearsal-bar-condition')).toHaveText(condition);
      // The condition that was not chosen is not on the bar.
      const other = condition === NO_DATA ? NO_FIX : NO_DATA;
      await expect(bar(page)).not.toContainText(other);
    });
  }

  test('is the first thing on the page, and on screen without scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await startRun(page, NO_DATA);

    const box = await bar(page).boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeLessThan(640);
    // Sticky: it is still on screen after the page is scrolled.
    await page.evaluate(() => window.scrollTo(0, 2000));
    const after = await bar(page).boundingBox();
    expect(after!.y).toBeGreaterThanOrEqual(0);
    expect(after!.y).toBeLessThan(640);
    await expect(bar(page)).toContainText('Rehearsal');
  });

  // TC-5.1.2-C. Both facts are words, so removing every colour removes neither.
  test('reads as a rehearsal in greyscale', async ({ page }) => {
    await startRun(page, NO_FIX);
    await page.addStyleTag({ content: 'html { filter: grayscale(1) !important; }' });

    await expect(bar(page)).toContainText('Rehearsal');
    await expect(page.locator('.rehearsal-bar-condition')).toHaveText(NO_FIX);

    // Still legible, not merely still present: measured with the filter applied.
    const contrast = await page.evaluate(() => {
      const lum = (channels: number[]) => {
        const [r, g, b] = channels.map((value) => {
          const s = value / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const channels = (colour: string) => colour.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number);
      const el = document.querySelector('.rehearsal-bar') as HTMLElement;
      const fg = lum(channels(getComputedStyle(el).color));
      const bg = lum(channels(getComputedStyle(el).backgroundColor));
      return (
        Math.round(((Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)) * 100) / 100
      );
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  });

  // TC-5.1.2-D
  test('is absent everywhere that is not a running rehearsal', async ({ page }) => {
    for (const url of [EMPTY, UNREADABLE]) {
      await page.goto(url);
      await expect(page.locator('.card h2')).toBeVisible();
      await expect(bar(page)).toHaveCount(0);
    }

    await page.goto(REHEARSABLE);
    await expect(page.getByRole('heading', { name: CHOOSE_HEADING })).toBeVisible();
    // Not yet running: nothing has been chosen, so there is no condition to name.
    await expect(bar(page)).toHaveCount(0);
  });

  test('is removed when the rehearsal is left, and does not come back on its own', async ({ page }) => {
    await startRun(page, NO_DATA);
    await page.getByRole('button', { name: 'Leave the rehearsal' }).click();

    await expect(bar(page)).toHaveCount(0);
    await page.getByTestId('remount').click();
    await page.getByTestId('remount').click();
    await expect(page.getByRole('heading', { name: CHOOSE_HEADING })).toBeVisible();
    await expect(bar(page)).toHaveCount(0);
  });
});

// TC-5.1.2-B. The worst defect this product could ship is a rehearsal that
// really called or really messaged someone.
test.describe('AC2 nothing leaves the device during a run', () => {
  test('no request goes off-origin across choosing, running and leaving', async ({ page }) => {
    const offOrigin: string[] = [];
    page.on('request', (request) => {
      if (!request.url().startsWith(ORIGIN)) offOrigin.push(`${request.method()} ${request.url()}`);
    });

    await startRun(page, NO_DATA);
    await page.getByRole('button', { name: 'Leave the rehearsal' }).click();
    await expect(bar(page)).toHaveCount(0);

    expect(offOrigin).toEqual([]);
  });

  test('no control in the run can reach outside the phone', async ({ page }) => {
    await startRun(page, NO_FIX);

    // No dialler, no mail client, no message app, no share sheet, no new window.
    await expect(page.locator('a[href^="tel:"], a[href^="mailto:"], a[href^="sms:"]')).toHaveCount(0);
    await expect(page.locator('a[target="_blank"]')).toHaveCount(0);
    await expect(page.locator('form')).toHaveCount(0);
    // And nothing on screen claims anything was sent.
    await expect(page.locator('main')).not.toContainText('has been sent');
    await expect(page.locator('main')).not.toContainText('Message sent');
    await expect(page.getByText('Nothing is sent from this rehearsal. Nothing leaves this phone.')).toBeVisible();
  });
});

// E5-US1-AC3 — the rehearsal is interrupted.

test.describe('AC3 leaving and coming back', () => {
  // TC-5.1.3-A
  test('the run and its condition survive leaving the screen and returning', async ({ page }) => {
    await startRun(page, NO_FIX);

    await page.getByTestId('remount').click();
    await expect(bar(page)).toHaveCount(0);
    await page.getByTestId('remount').click();

    // Back to the rehearsal, not back to the choice.
    await expect(bar(page)).toBeVisible();
    await expect(page.locator('.rehearsal-bar-condition')).toHaveText(NO_FIX);
    await expect(page.getByRole('heading', { name: CHOOSE_HEADING })).toHaveCount(0);
  });

  test('the run survives the phone being locked and unlocked', async ({ page }) => {
    await startRun(page, NO_DATA);

    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));

    await expect(bar(page)).toBeVisible();
    await expect(page.locator('.rehearsal-bar-condition')).toHaveText(NO_DATA);
  });
});

test.describe('AC3 a cold start', () => {
  // TC-5.1.3-B
  test('leaves no bar, no partial result and no record', async ({ page }) => {
    await page.goto(REHEARSABLE);
    await expect(page.getByRole('heading', { name: CHOOSE_HEADING })).toBeVisible();
    const before = await deviceStorage(page);

    await page.getByRole('button', { name: new RegExp(NO_DATA) }).click();
    await expect(bar(page)).toBeVisible();

    // The app is closed and reopened.
    await page.reload();

    await expect(bar(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: CHOOSE_HEADING })).toBeVisible();
    // No partial result, and nothing announcing an interruption: there is
    // nothing to announce, because nothing was kept.
    await expect(page.locator('main')).not.toContainText('interrupted');
    await expect(page.locator('main')).not.toContainText('resume');
    await expect(page.locator('main')).not.toContainText('Rehearsal complete');
    await expect(page.locator('main')).not.toContainText(NO_DATA + ' rehearsal');

    // And nothing was written at any point of the run.
    expect(await deviceStorage(page)).toEqual(before);
  });

  test('never leaves a state where it is unclear whether a rehearsal is running', async ({ page }) => {
    await startRun(page, NO_FIX);
    await page.reload();

    // Exactly one of the two readings is on screen: the choice, or the run.
    // Polled rather than sampled once, so the reloaded page is given time to
    // settle — a count taken mid-render would read zero of both and call an
    // unfinished paint an ambiguous state.
    const readings = async () =>
      (await bar(page).count()) +
      (await page.getByRole('heading', { name: CHOOSE_HEADING }).count());
    await expect.poll(readings).toBe(1);

    // And the one on screen is the choice, not a rehearsal that outlived the
    // restart.
    expect(await bar(page).count()).toBe(0);
  });
});
