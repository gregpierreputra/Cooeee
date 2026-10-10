import { expect, test, type Page } from '@playwright/test';
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

/** The pack page opens on Area; the notes live in its Notes tab. The test page
 *  keeps no address, so a reload opens on Area again. */
async function openNotes(page: Page) {
  await page.getByRole('tab', { name: 'Notes' }).click();
  await expect(page.getByRole('tab', { name: 'Notes' })).toHaveAttribute('aria-selected', 'true');
}

// Notes read as cards and open one at a time for editing. Save, Cancel and
// Delete show only while editing, unsaved words are said in amber, Delete
// asks first, and the device store agrees with what the screen says.
test('a note is added, read, edited, kept and deleted, and the store follows', async ({ page }) => {
  await page.goto(`${HARNESS}/detail`);
  await openNotes(page);
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
  await openNotes(page);
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
  await openNotes(page);
  await page.getByRole('button', { name: ADD_NOTE }).click();
  await page.getByLabel(NOTE_LABEL).fill('Pack the dog lead.');

  page.once('dialog', (dialog) => void dialog.accept());
  await page.reload();
  await openNotes(page);
  await expect(page.getByLabel(NOTE_LABEL)).toHaveValue('Pack the dog lead.');
  await expect(page.getByText(NOTE_UNSAVED)).toBeVisible();
  // The draft does not take focus when the page opens.
  await expect(page.getByLabel(NOTE_LABEL)).not.toBeFocused();

  await page.getByRole('button', { name: CANCEL }).click();
  await page.reload();
  await expect(page.getByLabel(NOTE_LABEL)).toHaveCount(0);
});

// Enter on a bullet starts the next one, and the box follows it down: a long
// list never leaves the line being typed below the box's edge.
test('Enter on a bullet keeps the new line in view as the list grows', async ({ page }) => {
  await page.goto(`${HARNESS}/detail`);
  await openNotes(page);
  const notes = page.locator('.pack-notes');
  await notes.getByRole('button', { name: ADD_NOTE }).click();
  const box = notes.getByLabel(NOTE_LABEL);
  await box.fill('');
  await page.keyboard.type('- item 1');
  for (let i = 2; i <= 15; i++) {
    await page.keyboard.press('Enter');
    await page.keyboard.type(`item ${i}`);
  }
  await expect(box).toHaveValue(Array.from({ length: 15 }, (_, i) => `• item ${i + 1}`).join('\n'));
  // Straight after Enter, before a letter is typed (typing scrolls on its own),
  // the new empty bullet at the end is in view: the box has scrolled down to it,
  // all but its bottom padding.
  await page.keyboard.press('Enter');
  await expect(box).toHaveValue(/\n• $/);
  const view = await box.evaluate((el) => ({
    top: el.scrollTop,
    seen: el.scrollTop + el.clientHeight,
    all: el.scrollHeight,
    padding: parseFloat(getComputedStyle(el).paddingBottom),
  }));
  expect(view.top).toBeGreaterThan(0);
  expect(view.seen).toBeGreaterThanOrEqual(view.all - view.padding - 2);
});
