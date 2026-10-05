import { expect, test } from '@playwright/test';
import {
  BUILD_A_PACK,
  CHECKED_AGO,
  ITEM_DAYS_AGO,
  JUST_NOW,
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
  NAV_REHEARSE,
  NO_PACK_SAVED,
  OFFLINE_NOTICE,
  ONLINE_NOTICE,
  PACK_SETTINGS,
  PLACE_NAME_LABEL,
  RENAME_PACK,
  SAVE,
  CLOSE,
  PACK_NAME_TAKEN,
  CHANGE_ICON,
  PACK_ICON_NAMES,
  PREPARATION_LINES,
  PREPARATION_MORE,
  PREPARATION_SOURCE,
  SAVED_AGO,
} from '../src/core/copy';
import { NAV_HOLD_HINT_MS } from '../src/core/constants';
import { titleCase as displayAddress } from '../src/core/home';
import { acknowledgeFirstOpen, HARNESS, storageCounts } from './helpers';

// E1-US2-AC6. The harness mounts the real header and the real home screen over
// a real IndexedDB, at a fixed instant, so the three header states are asserted
// as exact text rather than against the wall clock.
const home = (query: string) => `${HARNESS}/home${query}`;

test.describe('the header reports the saved pack age', () => {
  // TC-1.2.6-A
  test('states the age in words on the day the pack was saved', async ({ page }) => {
    await page.goto(home('?days=0'));
    await expect(page.getByText(CHECKED_AGO(JUST_NOW), { exact: true })).toBeVisible();
  });

  // An old pack states its age plainly, with no old-data label, and stays usable.
  test('states the age plainly at day 31, and the pack stays usable', async ({ page }) => {
    await page.goto(home('?days=31'));
    await expect(page.getByText(CHECKED_AGO(ITEM_DAYS_AGO(31)), { exact: true })).toBeVisible();
    await expect(page.getByText(/not recently verified/i)).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Ferny Creek' })).toBeEnabled();
  });

  // TC-1.2.6-D
  test('shows no age at all when no pack is saved, and offers to build one', async ({ page }) => {
    await page.goto(home('?mode=none'));
    await expect(page.getByText(NO_PACK_SAVED)).toBeVisible();
    await expect(page.getByRole('link', { name: BUILD_A_PACK })).toBeVisible();

    // No dash, no zero, no placeholder standing in for an age that does not exist.
    const header = page.locator('.app-header');
    await expect(header.getByText('Checked')).toHaveCount(0);
    await expect(header.locator('.app-header-age')).toHaveCount(0);

    // The way into BlackSky is reachable with nothing saved.
    await expect(page.getByRole('button', { name: HOLD_FOR_BLACKSKY })).toBeVisible();
  });

  test('the age is real text a screen reader can read, not an image or a colour', async ({
    page,
  }) => {
    await page.goto(home('?days=12'));
    const age = page.locator('.app-header-age');
    await expect(age).toHaveText(CHECKED_AGO(ITEM_DAYS_AGO(12)));
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
      page.getByText(SAVED_AGO(ITEM_DAYS_AGO(3)), { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: BUILD_A_PACK })).toBeVisible();
    await expect(page.getByRole('button', { name: HOLD_FOR_BLACKSKY })).toBeVisible();

    // Everything above is inside the viewport, with the page unscrolled.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    for (const box of await Promise.all(
      [
        page.getByRole('heading', { name: 'Ferny Creek' }),
        page.getByText(SAVED_AGO(ITEM_DAYS_AGO(3)), { exact: true }),
        page.getByRole('link', { name: BUILD_A_PACK }),
        page.getByRole('button', { name: HOLD_FOR_BLACKSKY }),
      ].map((locator) => locator.boundingBox()),
    )) {
      expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    }
  });

  // Several saved packs: every one is a card, newest first, under one Build
  // control; deleting one leaves the other and its rows untouched.
  test('lists every saved pack newest first, and deletes one without touching the other', async ({
    page,
  }) => {
    await page.goto(home('?days=3&packs=2'));
    const cards = page.locator('.pack-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toContainText('Kalorama');
    await expect(cards.last()).toContainText('Ferny Creek');
    await expect(page.getByRole('link', { name: BUILD_A_PACK })).toBeVisible();

    // The ... opens the pack's settings; Delete this pack asks, Delete deletes.
    await cards.first().getByRole('button', { name: PACK_SETTINGS('Kalorama') }).click();
    await expect(page.getByRole('dialog', { name: 'Kalorama' })).toBeVisible();
    await page.getByRole('button', { name: DELETE_PACK }).click();
    await page.getByRole('button', { name: CONFIRM_DELETE_PACK, exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(cards).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Ferny Creek' })).toBeVisible();
    expect((await storageCounts(page)).packs).toBe(1);
  });

  test('shows one preparation line with its source named beside it', async ({ page }) => {
    await page.goto(home('?days=3'));
    const preparation = page.locator('.preparation');
    await expect(preparation.getByText(PREPARATION_SOURCE)).toBeVisible();

    // Exactly one of the eight, never none and never two. The line for a
    // reader it was not written for waits behind the ring.
    await preparation.getByRole('button', { name: PREPARATION_MORE }).click();
    const text = (await preparation.textContent()) ?? '';
    expect(PREPARATION_LINES.filter((line) => text.includes(line.text))).toHaveLength(1);
    expect(PREPARATION_LINES.filter((line) => text.includes(line.context))).toHaveLength(1);
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

  test('the compass in the tab bar is the way into BlackSky, with or without a pack', async ({ page }) => {
    for (const query of ['?days=3', '?mode=none']) {
      await page.goto(home(query));
      const nav = page.getByRole('navigation', { name: NAV_LABEL });
      await expect(nav.getByRole('button', { name: HOLD_FOR_BLACKSKY })).toBeVisible();
      await expect(page.locator('main').getByRole('button', { name: HOLD_FOR_BLACKSKY })).toHaveCount(0);
    }
  });

  // The bar is on every screen, so its hint goes again on its own.
  test('the compass hint fades after a few seconds', async ({ page }) => {
    await page.clock.install();
    await page.goto(home('?days=3'));
    await page.getByRole('button', { name: HOLD_FOR_BLACKSKY }).click();
    await expect(page.getByText(HOLD_TO_ENTER)).toBeVisible();
    await page.clock.fastForward(NAV_HOLD_HINT_MS);
    await expect(page.getByText(HOLD_TO_ENTER)).toHaveCount(0);
  });

  test('the pack card carries the age alone in its footer', async ({
    page,
  }) => {
    await page.goto(home('?days=3'));
    const footer = page.locator('.saved-place-footer');
    await expect(footer).toHaveText(SAVED_AGO(ITEM_DAYS_AGO(3)));
  });

  test('the hold control meets the 44px minimum target size', async ({ page }) => {
    await page.goto(home('?days=3'));
    const box = (await page.getByRole('button', { name: HOLD_FOR_BLACKSKY }).boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test('the bottom navigation names its destinations, and BlackSky is held, not a tab', async ({
    page,
  }) => {
    await page.goto(home('?days=3'));
    const nav = page.getByRole('navigation', { name: NAV_LABEL });
    await expect(nav.getByRole('link', { name: NAV_HOME })).toBeVisible();
    await expect(nav.getByRole('link', { name: NAV_NEARBY })).toBeVisible();
    await expect(nav.getByRole('link', { name: NAV_REHEARSE })).toBeVisible();
    await expect(nav.getByRole('link')).toHaveCount(4);
    // BlackSky is never a tab: the compass is a button that needs a hold.
    await expect(nav.getByRole('link', { name: /BlackSky/ })).toHaveCount(0);
    await expect(nav.getByRole('button', { name: HOLD_FOR_BLACKSKY })).toBeVisible();
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
    await expect(page.getByText(CHECKED_AGO(ITEM_DAYS_AGO(3)), { exact: true })).toBeVisible();

    await context.setOffline(false);
  });
});

// The pack's menu opens on its close cross, never on Delete, and Rename changes
// the name on the card and in the menu at once.
test('the pack menu opens on Close and renames the pack', async ({ page }) => {
  await page.goto(home('?days=3'));
  await page.getByRole('button', { name: PACK_SETTINGS('Ferny Creek') }).click();
  const menu = page.getByRole('dialog', { name: 'Ferny Creek' });
  await expect(menu.getByRole('button', { name: CLOSE })).toBeFocused();

  await menu.getByRole('button', { name: RENAME_PACK }).click();
  await expect(menu.getByLabel(PLACE_NAME_LABEL)).toBeFocused();
  await expect(menu.getByLabel(PLACE_NAME_LABEL)).toHaveValue('Ferny Creek');
  await menu.getByLabel(PLACE_NAME_LABEL).fill('  ');
  await expect(menu.getByRole('button', { name: SAVE, exact: true })).toBeDisabled();
  await menu.getByLabel(PLACE_NAME_LABEL).fill('Mum and Dad');
  await menu.getByRole('button', { name: SAVE, exact: true }).click();

  // A saved name closes the menu onto the card, shown exactly as typed, and
  // focus returns to its ..., now named for the new name.
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.pack-card h2')).toHaveText('Mum and Dad');
  await expect(page.getByRole('button', { name: PACK_SETTINGS('Mum and Dad') })).toBeFocused();
});

// Change icon: one drawing per pack, chosen in the menu, and the menu closes
// onto the card. Opening it again shows the drawing chosen.
test('Change icon gives the pack a drawing', async ({ page }) => {
  await page.goto(home('?days=3'));
  await page.getByRole('button', { name: PACK_SETTINGS('Ferny Creek') }).click();
  await page.getByRole('button', { name: CHANGE_ICON }).click();
  await expect(page.getByRole('radio', { name: PACK_ICON_NAMES.place })).toBeChecked();
  await expect(page.getByRole('radio', { name: PACK_ICON_NAMES.place })).toBeFocused();

  await page.getByRole('radio', { name: PACK_ICON_NAMES.family }).check();
  await page.getByRole('button', { name: SAVE, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: PACK_SETTINGS('Ferny Creek') }).click();
  await page.getByRole('button', { name: CHANGE_ICON }).click();
  await expect(page.getByRole('radio', { name: PACK_ICON_NAMES.family })).toBeChecked();
});

// One name per pack: a name another pack has, whatever its capitals, is refused
// and said, and the pack keeps its name.
test('Rename refuses a name another pack already has', async ({ page }) => {
  await page.goto(home('?days=3&packs=2'));
  await page.getByRole('button', { name: PACK_SETTINGS('Ferny Creek') }).click();
  const menu = page.getByRole('dialog', { name: 'Ferny Creek' });
  await menu.getByRole('button', { name: RENAME_PACK }).click();
  await menu.getByLabel(PLACE_NAME_LABEL).fill('kalorama ');
  await menu.getByRole('button', { name: SAVE, exact: true }).click();

  await expect(menu.locator('.field-message')).toHaveText(PACK_NAME_TAKEN);
  await page.keyboard.press('Escape');
  await expect(page.locator('.pack-card h2')).toHaveText(['Kalorama', 'Ferny Creek']);
});

// Deleting the pack takes two taps, and the second removes it from the device
// entirely: the card gives way to the no-pack state and the store holds nothing.
test('delete removes the pack from the device after the confirmation', async ({ page }) => {
  await page.goto(home('?days=3'));
  await expect(page.locator('.app-header-age')).toHaveText(CHECKED_AGO(ITEM_DAYS_AGO(3)));
  await page.getByRole('button', { name: PACK_SETTINGS('Ferny Creek') }).click();
  await page.getByRole('button', { name: DELETE_PACK }).click();
  await page.getByRole('button', { name: CONFIRM_DELETE_PACK, exact: true }).click();
  await expect(page.getByText(NO_PACK_SAVED)).toBeVisible();
  // The header outlives the screen. It must stop stating the age of a pack
  // that is gone, with no reload.
  await expect(page.locator('.app-header-age')).toHaveCount(0);
  expect(await storageCounts(page)).toMatchObject({
    packs: 0, layers: 0, destinations: 0, files: 0, notes: 0,
  });
});

