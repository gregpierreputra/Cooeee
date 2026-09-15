import { expect, test, type Page } from '@playwright/test';
import { deviceStorage, startJourney, storedRehearsals } from './helpers';

const ORIGIN = 'http://127.0.0.1:4174';
const REHEARSABLE = `${ORIGIN}/rehearse?mode=rehearsable`;
/** `keep=1` seeds once, so a reload finds what the last load kept. Without it
 *  every load starts from a clean device, which would wipe the kept rehearsal
 *  a cold start is now required to find. */
const KEEP_REHEARSABLE = `${REHEARSABLE}&keep=1`;
const ENDING_HEADING = 'How did this rehearsal end?';
const EMPTY = `${ORIGIN}/rehearse?mode=empty`;
const UNREADABLE = `${ORIGIN}/rehearse?mode=unreadable`;

const NO_DATA = 'No mobile data';
const NO_FIX = 'No location fix';
const CHOOSE_HEADING = 'What are we rehearsing without?';

const bar = (page: Page) => page.locator('.rehearsal-bar');

/** Start a run exactly as a user does: choose a condition, then go (E5-US1-AC5). */
async function startRun(page: Page, condition: string) {
  await startJourney(page, condition, REHEARSABLE);
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

    // Chosen and not yet gone on: setup, not a run (E5-US1-AC5), so still no bar.
    await page.getByRole('button', { name: new RegExp(NO_DATA) }).click();
    await expect(page.getByRole('heading', { name: 'Rehearse the way there' })).toBeVisible();
    await expect(bar(page)).toHaveCount(0);
  });

  test('is removed when the rehearsal is left, and does not come back on its own', async ({ page }) => {
    await startRun(page, NO_DATA);
    await page.getByRole('button', { name: 'Leave the rehearsal' }).click();

    await expect(bar(page)).toHaveCount(0);
    await page.getByTestId('remount').click();
    await page.getByTestId('remount').click();
    // E5-US1-AC5: leaving gave the rehearsal no ending, so coming back asks for
    // one. The bar does not come back with it, because nothing is running.
    await expect(page.getByRole('heading', { name: ENDING_HEADING })).toBeVisible();
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

/** Start a run on a device that keeps what it stores, wait until the start is
 *  kept, then close and reopen the app. */
async function coldStartMidRun(page: Page, condition: string) {
  await startJourney(page, condition, KEEP_REHEARSABLE);
  await expect.poll(async () => (await deviceStorage(page)).recordCounts.rehearsals).toBe(1);
  await page.reload();
}

// E5-US1-AC3, as amended by E5-US1-AC5. Two of TC-5.1.3-B's three rules stand:
// a cold start leaves no bar and no partial result. The third has flipped: a
// started rehearsal is now kept, unfinished, and asked about.
test.describe('AC3 a cold start', () => {
  // TC-5.1.3-B
  test('leaves no bar and no partial result, and keeps the started rehearsal unfinished', async ({
    page,
  }) => {
    await page.goto(KEEP_REHEARSABLE);
    await expect(page.getByRole('heading', { name: CHOOSE_HEADING })).toBeVisible();
    const before = await deviceStorage(page);
    expect(before.recordCounts.rehearsals).toBe(0);

    await page.getByRole('button', { name: new RegExp(NO_DATA) }).click();
    // Chosen, not gone: nothing is kept yet (E5-US1-AC5).
    await expect(page.getByRole('heading', { name: 'Rehearse the way there' })).toBeVisible();
    expect((await deviceStorage(page)).recordCounts.rehearsals).toBe(0);
    await page.getByRole('main').getByRole('button', { name: "I'm going now", exact: true }).click();
    await expect(bar(page)).toBeVisible();
    // Kept the moment she goes.
    await expect.poll(async () => (await deviceStorage(page)).recordCounts.rehearsals).toBe(1);

    // The app is closed and reopened.
    await page.reload();

    // No bar: after a cold start nothing is running. Asserted once the question
    // is up, so a count taken mid-render cannot pass for the wrong reason.
    await expect(page.getByRole('heading', { name: ENDING_HEADING })).toBeVisible();
    await expect(bar(page)).toHaveCount(0);
    // No partial result, no resumed screen, and nothing announcing an
    // interruption: the app does not know what happened, so it says nothing
    // about it and asks.
    await expect(page.getByRole('heading', { name: 'What this rehearsal found' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Nothing was missing in this rehearsal' })).toHaveCount(0);
    await expect(page.locator('.gap-row')).toHaveCount(0);
    await expect(page.getByText(/^Step \d of \d$/)).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText('interrupted');
    await expect(page.locator('main')).not.toContainText('resume');
    await expect(page.locator('main')).not.toContainText('Rehearsal complete');
    await expect(page.locator('main')).not.toContainText(NO_DATA + ' rehearsal');

    // Exactly one record was written across the whole run and the restart, and
    // nothing else changed on the device.
    expect(await deviceStorage(page)).toEqual({
      ...before,
      recordCounts: { ...before.recordCounts, rehearsals: 1 },
    });
    // And that record is the started rehearsal, unfinished: no finish, no gaps,
    // no ending. Nothing was guessed.
    const rows = await storedRehearsals(page);
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(['condition', 'id', 'packId', 'startedAt']);
    expect(rows[0]).toMatchObject({ packId: 'rehearse-pack', condition: 'no-data' });
  });

  test('never leaves a state where it is unclear whether a rehearsal is running', async ({ page }) => {
    await coldStartMidRun(page, NO_FIX);

    // Exactly one of the three readings is on screen: the choice, the run, or
    // the question. Polled rather than sampled once, so the reloaded page is
    // given time to settle — a count taken mid-render would read zero of all
    // three and call an unfinished paint an ambiguous state.
    const readings = async () =>
      (await bar(page).count()) +
      (await page.getByRole('heading', { name: CHOOSE_HEADING }).count()) +
      (await page.getByRole('heading', { name: ENDING_HEADING }).count());
    await expect.poll(readings).toBe(1);

    // And the one on screen is the question: not a rehearsal that outlived the
    // restart, and not a fresh choice that has forgotten the one she started.
    expect(await bar(page).count()).toBe(0);
    expect(await page.getByRole('heading', { name: CHOOSE_HEADING }).count()).toBe(0);
    await expect(page.getByRole('heading', { name: ENDING_HEADING })).toBeVisible();
  });
});

// E5-US1-AC5 — returning to a kept rehearsal asks which ending it had.
test.describe('AC5 returning asks how it ended', () => {
  test('offers both endings, chooses neither, and an unanswered question leaves it unfinished', async ({
    page,
  }) => {
    await coldStartMidRun(page, NO_FIX);
    await expect(page.getByRole('heading', { name: ENDING_HEADING })).toBeVisible();

    const endings = page.getByRole('main').getByRole('button');
    await expect(endings).toHaveCount(2);
    await expect(endings.nth(0)).toHaveAccessibleName(/^I went there/);
    await expect(endings.nth(1)).toHaveAccessibleName(/^I did not go, a dry run/);
    await expect(page.locator('[aria-pressed="true"], [aria-checked="true"], :checked')).toHaveCount(0);
    await expect(page.getByText('You started a rehearsal without a location fix on')).toBeVisible();

    // Left unanswered: away from the screen and back, then another cold start.
    await page.getByTestId('remount').click();
    await page.getByTestId('remount').click();
    await expect(page.getByRole('heading', { name: ENDING_HEADING })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: ENDING_HEADING })).toBeVisible();

    // Still exactly the started rehearsal, still with no ending.
    const rows = await storedRehearsals(page);
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(['condition', 'id', 'packId', 'startedAt']);
  });

  for (const [label, ending] of [
    ['I went there', 'walked'],
    ['I did not go, a dry run', 'dry-run'],
  ] as const) {
    test(`answering "${label}" reaches the existing result and records that ending, and only that`, async ({
      page,
    }) => {
      await coldStartMidRun(page, NO_FIX);
      await expect(page.getByRole('heading', { name: ENDING_HEADING })).toBeVisible();
      const [started] = await storedRehearsals(page);

      await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();

      // The existing result, finding the same gaps whichever ending she gave.
      await expect(page.getByRole('heading', { name: 'What this rehearsal found' })).toBeVisible();
      await expect(page.locator('.gap-row h3')).toHaveText(['Live direction and distance to your saved places']);
      await expect(bar(page)).toBeVisible();

      // The kept row became the finished one, with her ending.
      await expect.poll(async () => (await storedRehearsals(page))[0]?.ending).toBe(ending);
      const rows = await storedRehearsals(page);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: started.id,
        packId: 'rehearse-pack',
        condition: 'no-location-fix',
        startedAt: started.startedAt,
        ending,
      });
      expect(rows[0].finishedAt as number).toBeGreaterThanOrEqual(started.startedAt as number);
      // A walked rehearsal keeps the time between its start and her answer; a
      // dry run keeps none.
      if (ending === 'walked') {
        expect(rows[0].elapsedMs).toBe((rows[0].finishedAt as number) - (started.startedAt as number));
      } else {
        expect(rows[0]).not.toHaveProperty('elapsedMs');
      }

      // Answered, so it is not asked again.
      await page.reload();
      await expect(page.getByRole('heading', { name: CHOOSE_HEADING })).toBeVisible();
      await expect(page.getByRole('heading', { name: ENDING_HEADING })).toHaveCount(0);
    });
  }
});
