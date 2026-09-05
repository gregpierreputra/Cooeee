import { expect, test } from '@playwright/test';
import {
  BLACKSKY_SEPARATE_FROM_EVERYDAY,
  BLACKSKY_WORKS_WITHOUT_PACK,
  BUILD_A_PACK,
  CHECKED_DAYS_AGO,
  CONFIRM_DELETE_PACK,
  CONNECTION_ONLINE_LABEL,
  DELETE_PACK,
  DISMISS_NOTICE,
  HEADER_HOME_LABEL,
  HOLD_FOR_BLACKSKY,
  HOLD_TO_ENTER,
  NAV_HOME,
  NAV_LABEL,
  NAV_NEARBY,
  NO_PACK_SAVED,
  NOT_RECENTLY_VERIFIED_LABEL,
  OPEN_PACK,
  OFFLINE_NOTICE,
  ONLINE_NOTICE,
  OPENS_WITHOUT_SIGNAL,
  PREPARATION_LINES,
  PREPARATION_SOURCE,
  SAVED_DAYS_AGO,
} from '../src/core/copy';
import { titleCase as displayAddress } from '../src/core/home';
import { acknowledgeFirstOpen, HARNESS, storageCounts } from './helpers';

// E1-US2-AC6. The harness mounts the real header and the real home screen over
// a real IndexedDB, at a fixed instant, so the three header states are asserted
// as exact text rather than against the wall clock.
const home = (query: string) => `${HARNESS}/home${query}`;

test.describe('the header reports the saved pack age', () => {
  // TC-1.2.6-A
  test('states the age in days on the day the pack was saved', async ({ page }) => {
    await page.goto(home('?days=0'));
    await expect(page.getByText(CHECKED_DAYS_AGO(0), { exact: true })).toBeVisible();
  });

  // TC-1.2.6-B — the window is inclusive: day 30 is not yet labelled.
  test('still states the age at exactly 30 days, and carries no label', async ({ page }) => {
    await page.goto(home('?days=30'));
    await expect(page.getByText(CHECKED_DAYS_AGO(30), { exact: true })).toBeVisible();
    await expect(page.getByText(NOT_RECENTLY_VERIFIED_LABEL, { exact: true })).toHaveCount(0);
  });

  // TC-1.2.6-C
  test('carries the label from day 31', async ({ page }) => {
    await page.goto(home('?days=31'));
    await expect(page.getByText(NOT_RECENTLY_VERIFIED_LABEL, { exact: true })).toBeVisible();
    await expect(page.getByText('Checked')).toHaveCount(0);

    // Past the window the pack is labelled, never disabled: the way in is still
    // there and still tappable.
    await expect(page.getByRole('link', { name: OPEN_PACK })).toBeEnabled();
  });

  // TC-1.2.6-D
  test('shows no age at all when no pack is saved, and offers to build one', async ({ page }) => {
    await page.goto(home('?mode=none'));
    await expect(page.getByText(NO_PACK_SAVED)).toBeVisible();
    await expect(page.getByRole('link', { name: BUILD_A_PACK }).first()).toBeVisible();

    // No dash, no zero, no placeholder standing in for an age that does not exist.
    const header = page.locator('.app-header');
    await expect(header.getByText('Checked')).toHaveCount(0);
    await expect(header.getByText(NOT_RECENTLY_VERIFIED_LABEL)).toHaveCount(0);
    await expect(header.locator('.app-header-age')).toHaveCount(0);

    // The way into BlackSky is reachable with nothing saved.
    await expect(page.getByRole('button', { name: HOLD_FOR_BLACKSKY })).toBeVisible();
  });

  test('the age is real text a screen reader can read, not an image or a colour', async ({
    page,
  }) => {
    await page.goto(home('?days=12'));
    const age = page.locator('.app-header-age');
    await expect(age).toHaveText(CHECKED_DAYS_AGO(12));
    await expect(age.locator('img, svg')).toHaveCount(0);
  });
});

test.describe('the returning-user home screen', () => {
  test('carries the place, its age, the way in and the hold control without scrolling', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(home('?days=3'));

    await expect(page.getByRole('heading', { name: 'Ferny Creek' })).toBeVisible();
    // Title-cased for reading; the stored string keeps the custodian's capitals.
    await expect(page.getByText(displayAddress('10 OLD ROAD FERNY CREEK 3786'))).toBeVisible();
    await expect(
      page.getByText(SAVED_DAYS_AGO(3) + OPENS_WITHOUT_SIGNAL, { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: OPEN_PACK })).toBeVisible();
    await expect(page.getByRole('button', { name: HOLD_FOR_BLACKSKY })).toBeVisible();

    // Everything above is inside the viewport, with the page unscrolled.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    for (const box of await Promise.all(
      [
        page.getByRole('heading', { name: 'Ferny Creek' }),
        page.getByText(SAVED_DAYS_AGO(3) + OPENS_WITHOUT_SIGNAL, { exact: true }),
        page.getByRole('link', { name: OPEN_PACK }),
        page.getByRole('button', { name: HOLD_FOR_BLACKSKY }),
      ].map((locator) => locator.boundingBox()),
    )) {
      expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    }
  });

  test('shows one preparation line with its source named beside it', async ({ page }) => {
    await page.goto(home('?days=3'));
    const preparation = page.locator('.preparation');
    await expect(preparation.getByText(PREPARATION_SOURCE)).toBeVisible();

    // Exactly one of the eight, never none and never two.
    const text = (await preparation.textContent()) ?? '';
    expect(PREPARATION_LINES.filter((line) => text.includes(line.text))).toHaveLength(1);
    expect(PREPARATION_LINES.filter((line) => text.includes(line.context))).toHaveLength(1);
  });

  test('the preparation line does not change while the screen is open', async ({ page }) => {
    await page.goto(home('?days=3'));
    const first = await page.locator('.preparation p').first().textContent();
    await page.waitForTimeout(1_500);
    expect(await page.locator('.preparation p').first().textContent()).toBe(first);
  });

  // TC-1.2.6-E, in the harness. The full hold-and-enter is asserted against the
  // real production bundle in blacksky-offline.spec.ts.
  test('a press released before two seconds earns the hint, and does not enter', async ({
    page,
  }) => {
    await page.goto(home('?days=3'));
    await expect(page.getByText(HOLD_TO_ENTER)).toHaveCount(0);
    await page.getByRole('button', { name: HOLD_FOR_BLACKSKY }).click();
    await expect(page.getByText(HOLD_TO_ENTER)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ferny Creek' })).toBeVisible();
  });

  test('the hold control names what the mode is, and changes the line with no pack', async ({
    page,
  }) => {
    await page.goto(home('?days=3'));
    const hold = page.getByRole('button', { name: HOLD_FOR_BLACKSKY });
    await expect(hold).toContainText(BLACKSKY_SEPARATE_FROM_EVERYDAY);

    await page.goto(home('?mode=none'));
    await expect(page.getByRole('button', { name: HOLD_FOR_BLACKSKY })).toContainText(
      BLACKSKY_WORKS_WITHOUT_PACK,
    );
  });

  test('the pack card carries the offline fact under the age, not in place of it', async ({
    page,
  }) => {
    await page.goto(home('?days=3'));
    const footer = page.locator('.saved-place-footer');
    await expect(footer).toHaveText(SAVED_DAYS_AGO(3) + OPENS_WITHOUT_SIGNAL);
  });

  test('the hold control meets the 44px minimum target size', async ({ page }) => {
    await page.goto(home('?days=3'));
    const box = (await page.getByRole('button', { name: HOLD_FOR_BLACKSKY }).boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test('the bottom navigation names its destinations, and BlackSky is not one', async ({
    page,
  }) => {
    await page.goto(home('?days=3'));
    const nav = page.getByRole('navigation', { name: NAV_LABEL });
    await expect(nav.getByRole('link', { name: NAV_HOME })).toBeVisible();
    await expect(nav.getByRole('link', { name: NAV_NEARBY })).toBeVisible();
    await expect(nav.getByRole('link', { name: HOLD_FOR_BLACKSKY })).toHaveCount(0);
    expect((await nav.textContent()) ?? '').not.toContain('BlackSky');
  });

  test('the header returns home and never offers a way into BlackSky', async ({ page }) => {
    await page.goto(home('?days=3'));
    const header = page.locator('.app-header');
    await expect(header.getByRole('link', { name: HEADER_HOME_LABEL })).toBeVisible();
    expect((await header.textContent()) ?? '').not.toContain('BlackSky');
  });

  test('says nothing about conditions, incidents, or how prepared the user is', async ({
    page,
  }) => {
    await page.goto(home('?days=31'));
    const body = (await page.locator('body').textContent()) ?? '';
    expect(body).not.toMatch(/\bsafe\b|\ball clear\b|\bno risk\b|\bwarning\b|\balert\b/i);
    expect(body).not.toMatch(/well done|you are prepared|you should have|conditions today/i);
    await expect(page.locator('[role="progressbar"]')).toHaveCount(0);
  });
});

test.describe('the connection notice', () => {
  // The notice bar is mounted by the application shell, not the harness, so
  // this one runs against the real app.
  test('reports what the browser reports, and keeps its whole meaning when dismissed to a wordless strip', async ({
    page,
    context,
  }) => {
    await acknowledgeFirstOpen(page);
    await page.goto('/');
    await expect(page.locator('.notice-bar')).toContainText(ONLINE_NOTICE);

    await page.getByRole('button', { name: DISMISS_NOTICE }).click();
    const strip = page.getByRole('button', { name: CONNECTION_ONLINE_LABEL });
    await expect(strip).toBeVisible();
    await expect(strip).toHaveText('');

    await strip.click();
    await context.setOffline(true);
    await expect(page.locator('.notice-bar')).toContainText(OFFLINE_NOTICE);
    await context.setOffline(false);
  });

  test('never offers a way into BlackSky when the connection is lost', async ({ page, context }) => {
    await page.goto(home('?days=3'));
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));

    const header = page.locator('.app-header');
    expect((await header.textContent()) ?? '').not.toContain('BlackSky');
    // The age still reads: it is stored on the device, and losing the network
    // changes nothing about it.
    await expect(page.getByText(CHECKED_DAYS_AGO(3), { exact: true })).toBeVisible();

    await context.setOffline(false);
  });
});

// Deleting the pack takes two taps, and the second removes it from the device
// entirely: the card gives way to the no-pack state and the store holds nothing.
test('delete removes the pack from the device after the confirmation', async ({ page }) => {
  await page.goto(home('?days=3'));
  await page.getByRole('button', { name: DELETE_PACK }).click();
  await page.getByRole('button', { name: CONFIRM_DELETE_PACK }).click();
  await expect(page.getByText(NO_PACK_SAVED)).toBeVisible();
  expect(await storageCounts(page)).toMatchObject({
    packs: 0, layers: 0, destinations: 0, files: 0, notes: 0,
  });
});

