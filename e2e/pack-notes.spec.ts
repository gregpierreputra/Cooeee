import { expect, test } from '@playwright/test';
import {
  ADD_NOTE,
  DELETE_NOTE,
  NOTE_DELETED,
  NOTE_LABEL,
  NOTE_SAVED,
  SAVE_NOTE,
} from '../src/core/copy';
import { HARNESS, storageCounts } from './helpers';

// Each note card reports its own last action on the card itself, and the
// device store agrees with what the card says.
test('a note card says saved and deleted on the card, and the store follows', async ({ page }) => {
  await page.goto(`${HARNESS}/detail`);
  await page.getByRole('button', { name: ADD_NOTE }).click();
  const card = page.locator('.note-card');
  await card.getByLabel(NOTE_LABEL).fill('Turn the gas off at the meter.');
  await card.getByRole('button', { name: SAVE_NOTE }).click();
  await expect(card.locator('.note-mark')).toHaveText(NOTE_SAVED);
  expect(await storageCounts(page)).toMatchObject({ notes: 1 });

  await card.getByRole('button', { name: DELETE_NOTE }).click();
  await expect(card.locator('.note-mark')).toHaveText(NOTE_DELETED);
  await expect(card).toHaveCount(0, { timeout: 5_000 });
  expect(await storageCounts(page)).toMatchObject({ notes: 0 });
});
