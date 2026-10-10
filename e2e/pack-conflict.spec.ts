import { expect, test, type Page } from '@playwright/test';
import {
  KEEP_SAVED_PACK,
  NOTE_LABEL,
  NOTE_STEP_TITLE,
  NOTES_DROPPED,
  NOTES_KEPT,
  NOTHING_CHANGED,
  PLACE_ALREADY_SAVED,
  REPLACE_SAVED_PACK,
  SAVED_PLACE_CHECK_FAILED,
} from '../src/core/copy';
import { HARNESS, readPacks as packs, storageCounts } from './helpers';

const CONFLICT_URL = `${HARNESS}/conflict`;
// The harness saves a pack at the one candidate address: confirming that same
// address is what reaches the keep-or-replace step. Any other address goes
// straight to the area check (pack-save-flow.spec.ts).
const ADDRESS = '6 RIDGE ROAD KALORAMA 3766';

async function reachConflict(page: Page, suffix = '') {
  await page.goto(`${CONFLICT_URL}${suffix}`);
  await page.getByLabel('Street address').fill('RIDGE');
  await page.getByLabel('Street address').press('Enter');
  await page.getByRole('button', { name: ADDRESS }).click();
  await page.getByRole('button', { name: 'Save this place' }).click();
  await expect(page.getByRole('heading', { name: PLACE_ALREADY_SAVED })).toBeVisible();
}

test('AC8 shows the saved address and equal unselected choices before network', async ({ page }) => {
  await reachConflict(page);
  await expect(page.getByTestId('saved-address')).toHaveText(ADDRESS);
  await expect(page.locator('main').locator(
    'h1, [data-testid="saved-address"], button',
  )).toHaveText([PLACE_ALREADY_SAVED, ADDRESS, KEEP_SAVED_PACK, REPLACE_SAVED_PACK]);
  await expect(page.locator('main')).not.toContainText(
    /Updating|We have updated your place|Automatically replaced/i,
  );

  const keep = page.getByRole('button', { name: KEEP_SAVED_PACK });
  const replace = page.getByRole('button', { name: REPLACE_SAVED_PACK });
  await expect(keep).not.toBeFocused();
  await expect(replace).not.toBeFocused();
  await expect(keep).toHaveCSS('background-color', await replace.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  ));
  expect(await keep.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width >= 24 && rect.height >= 24;
  })).toBe(true);
  expect(await replace.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width >= 24 && rect.height >= 24;
  })).toBe(true);
  expect(await page.evaluate(() => window.__areaCheckCount)).toBe(0);
});

test('AC8 keep leaves the original complete pack byte-identical', async ({ page }) => {
  await reachConflict(page);
  const before = await packs(page);
  await page.getByRole('button', { name: KEEP_SAVED_PACK }).click();

  expect(await page.evaluate(() => window.__keptSavedPlace)).toBe(true);
  expect(await packs(page)).toEqual(before);
  expect(await page.evaluate(() => window.__areaCheckCount)).toBe(0);
});

test('AC8 leaving without a choice leaves the original complete pack byte-identical', async ({ page }) => {
  await reachConflict(page);
  const before = await packs(page);
  await page.goto(`${HARNESS}/`);

  expect(await packs(page)).toEqual(before);
  expect(await page.evaluate(() => window.__areaCheckCount)).toBe(0);
});

test('AC8 replace explicitly starts the next stage while the original remains current', async ({ page }) => {
  await reachConflict(page);
  const before = await packs(page);
  await page.getByRole('button', { name: REPLACE_SAVED_PACK }).click();

  await expect(page.getByRole('heading')).toHaveText(
    'This address is inside a Bushfire Prone Area.',
  );
  expect(await page.evaluate(() => window.__areaCheckCount)).toBe(1);
  expect(await packs(page)).toEqual(before);
});

test('AC8 store failure stops before network and states that nothing changed', async ({ page }) => {
  await page.goto(`${CONFLICT_URL}?mode=unavailable`);
  await page.getByLabel('Street address').fill('RIDGE');
  await page.getByLabel('Street address').press('Enter');
  await page.getByRole('button', { name: ADDRESS }).click();
  await page.getByRole('button', { name: 'Save this place' }).click();

  await expect(page.getByRole('heading')).toHaveText(SAVED_PLACE_CHECK_FAILED);
  await expect(page.getByRole('status')).toContainText(NOTHING_CHANGED);
  expect(await page.evaluate(() => window.__areaCheckCount)).toBe(0);
});

// Replacing a pack keeps the notes already written for the place, and its note
// step starts empty so no second example is added. The person can choose to
// start without them, and nothing is removed until the new pack is saved.
async function replaceToNoteStep(page: Page) {
  await reachConflict(page, '?mode=notes');
  await page.getByRole('button', { name: REPLACE_SAVED_PACK }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  const boxes = page.getByRole('checkbox');
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await page.getByRole('button', { name: 'Save last-resort places' }).click();
  await expect(page.getByRole('heading', { name: NOTE_STEP_TITLE })).toBeVisible();
}

test('a replace keeps the notes already written, and adds no example beside them', async ({ page }) => {
  await replaceToNoteStep(page);
  await expect(page.getByLabel(NOTE_LABEL)).toHaveValue('');
  await expect(page.getByRole('status').filter({ hasText: NOTES_KEPT(2) })).toBeVisible();
  await page.getByRole('button', { name: 'Not now' }).click();
  await page.getByRole('button', { name: 'Save this pack' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Place saved');
  expect(await storageCounts(page)).toMatchObject({ packs: 1, notes: 2 });
});

test('a replace can start without the notes, removed only once the new pack is saved', async ({ page }) => {
  await replaceToNoteStep(page);
  await page.getByRole('button', { name: 'Start without them' }).click();
  await expect(page.getByRole('status').filter({ hasText: NOTES_DROPPED(2) })).toBeVisible();
  // Changing their mind puts it back, and choosing again holds until the save.
  await page.getByRole('button', { name: 'Keep them' }).click();
  await page.getByRole('button', { name: 'Start without them' }).click();
  await page.getByRole('button', { name: 'Not now' }).click();
  expect(await storageCounts(page)).toMatchObject({ notes: 2 });
  await page.getByRole('button', { name: 'Save this pack' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Place saved');
  expect(await storageCounts(page)).toMatchObject({ packs: 1, notes: 0 });
});
