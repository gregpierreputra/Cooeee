import { expect, test } from '@playwright/test';
import {
  ADD_NOTE,
  CANCEL,
  DELETE_NOTE,
  DELETE_NOTE_QUESTION,
  EDIT_NOTE,
  KEEP_IT,
  NOTE_DELETED,
  NOTE_LABEL,
  NOTE_SAVED,
  NOTE_UNSAVED,
  SAVE_NOTE,
} from '../src/core/copy';
import { HARNESS, storageCounts } from './helpers';

// Notes read as cards and open one at a time for editing. Save, Cancel and
// Delete show only while editing, unsaved words are said in amber, Delete
// asks first, and the device store agrees with what the screen says.
test('a note is added, read, edited, kept and deleted, and the store follows', async ({ page }) => {
  await page.goto(`${HARNESS}/detail`);
  const notes = page.locator('.pack-notes');
  await expect(notes.getByRole('button', { name: SAVE_NOTE })).toHaveCount(0);

  await notes.getByRole('button', { name: ADD_NOTE }).click();
  await expect(notes.getByLabel(NOTE_LABEL)).toBeFocused();
  await expect(notes.getByRole('button', { name: SAVE_NOTE })).toBeDisabled();
  await expect(notes.getByRole('button', { name: DELETE_NOTE })).toHaveCount(0);
  await notes.getByLabel(NOTE_LABEL).fill('Turn the gas off at the meter.');
  await expect(notes.getByText(NOTE_UNSAVED)).toBeVisible();
  await notes.getByRole('button', { name: SAVE_NOTE }).click();

  await expect(notes.locator('.note-text')).toHaveText('Turn the gas off at the meter.');
  await expect(notes.getByRole('status')).toHaveText(NOTE_SAVED);
  await expect(notes.getByRole('button', { name: /^Edit/ })).toBeFocused();
  expect(await storageCounts(page)).toMatchObject({ notes: 1 });

  // Cancel puts the saved words back.
  await notes.getByRole('button', { name: /^Edit/ }).click();
  await notes.getByLabel(NOTE_LABEL).fill('Something else');
  await expect(notes.getByText(NOTE_UNSAVED)).toBeVisible();
  await notes.getByRole('button', { name: CANCEL }).click();
  await expect(notes.locator('.note-text')).toHaveText('Turn the gas off at the meter.');

  // Delete asks first, and Keep it changes nothing.
  await notes.getByRole('button', { name: `${EDIT_NOTE} Turn the gas` }).click();
  await notes.getByRole('button', { name: DELETE_NOTE }).click();
  await expect(notes.getByText(DELETE_NOTE_QUESTION)).toBeVisible();
  await expect(notes.getByRole('button', { name: KEEP_IT })).toBeFocused();
  await notes.getByRole('button', { name: KEEP_IT }).click();
  expect(await storageCounts(page)).toMatchObject({ notes: 1 });

  await notes.getByRole('button', { name: DELETE_NOTE }).click();
  await notes.locator('.card-confirm-yes').click();
  await expect(notes.getByRole('status')).toHaveText(NOTE_DELETED);
  await expect(notes.locator('.note-card')).toHaveCount(0);
  await expect(notes.getByRole('button', { name: ADD_NOTE })).toBeFocused();
  expect(await storageCounts(page)).toMatchObject({ notes: 0 });
});

test('leaving the page with unsaved words brings up the browser’s warning', async ({ page }) => {
  await page.goto(`${HARNESS}/detail`);
  await page.getByRole('button', { name: ADD_NOTE }).click();
  await page.getByLabel(NOTE_LABEL).fill('Not saved');

  const dialog = page.waitForEvent('dialog');
  // Dismissing the warning cancels the reload, so its promise never settles.
  page.reload().catch(() => undefined);
  const shown = await dialog;
  expect(shown.type()).toBe('beforeunload');
  await shown.dismiss();
});

// Unsaved words are kept on the phone: after a reload the note opens again with
// them, said to be unsaved, and Cancel clears the draft for good.
test('unsaved words come back after a reload until they are saved or cancelled', async ({ page }) => {
  await page.goto(`${HARNESS}/detail`);
  await page.getByRole('button', { name: ADD_NOTE }).click();
  await page.getByLabel(NOTE_LABEL).fill('Pack the dog lead.');

  page.once('dialog', (dialog) => void dialog.accept());
  await page.reload();
  await expect(page.getByLabel(NOTE_LABEL)).toHaveValue('Pack the dog lead.');
  await expect(page.getByText(NOTE_UNSAVED)).toBeVisible();
  // The draft does not take focus when the page opens.
  await expect(page.getByLabel(NOTE_LABEL)).not.toBeFocused();

  await page.getByRole('button', { name: CANCEL }).click();
  await page.reload();
  await expect(page.getByLabel(NOTE_LABEL)).toHaveCount(0);
});
