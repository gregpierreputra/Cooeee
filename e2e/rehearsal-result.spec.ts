import { expect, test, type Page } from '@playwright/test';
import { rehearseToResult } from './helpers';

const ORIGIN = 'http://127.0.0.1:4174';
/** A pack holding the whole journey: a designation and an official place. */
const WHOLE = `${ORIGIN}/rehearse?mode=rehearsable`;
/** A pack with a designation but no official place saved with it. */
const WITH_GAP = `${ORIGIN}/rehearse?mode=gap`;

const NO_DATA = 'No mobile data';
const NO_FIX = 'No location fix';
const CHOOSE_HEADING = 'What are we rehearsing without?';

const PACK_CONTENT_MEANING = 'This information is missing from your pack.';
const CONDITION_MEANING =
  'This is not available under this condition. Here is what to do instead.';

// E5-US2-AC1 — one action for each gap.

test.describe('AC1 each gap arrives with one action', () => {
  // TC-5.2.1-A
  test('every gap row carries exactly one action, and never none', async ({ page }) => {
    await rehearseToResult(page, NO_FIX, WITH_GAP);

    const rows = page.locator('.gap-row');
    await expect(rows).not.toHaveCount(0);
    const count = await rows.count();
    for (let i = 0; i < count; i += 1) {
      const row = rows.nth(i);
      await expect(row.locator('.gap-action-label')).toHaveCount(1);
      await expect(row.locator('h3')).toHaveCount(1);
      // One action paragraph after the label, not a list of options.
      await expect(row.locator('ul, ol')).toHaveCount(0);
    }
  });

  // TC-5.2.1-B
  test('a pack-content gap and a condition gap read differently', async ({ page }) => {
    await rehearseToResult(page, NO_FIX, WITH_GAP);

    await expect(page.getByText(PACK_CONTENT_MEANING)).toBeVisible();
    await expect(page.getByText(CONDITION_MEANING)).toBeVisible();
    // Both kinds are on screen, in one list, told apart only by their words.
    await expect(page.locator('.gap-list')).toHaveCount(1);
  });

  test('every gap names whose journey it belongs to', async ({ page }) => {
    await rehearseToResult(page, NO_FIX, WITH_GAP);

    const rows = page.locator('.gap-row');
    const count = await rows.count();
    for (let i = 0; i < count; i += 1) {
      await expect(rows.nth(i).locator('.kicker')).toHaveText('Bushfire journey');
    }
  });

  test('a contingency action never says the capability has come back', async ({ page }) => {
    await rehearseToResult(page, NO_FIX, WHOLE);

    const row = page.locator('.gap-row', { hasText: CONDITION_MEANING });
    await expect(row).toHaveCount(1);
    await expect(row).not.toContainText('restored');
    await expect(row).not.toContainText('back online');
    await expect(row).not.toContainText('will work');
  });
});

// TC-5.2.1-D
test('AC1 a rehearsal that found nothing renders its own screen', async ({ page }) => {
  await rehearseToResult(page, NO_DATA, WHOLE);

  await expect(page.getByRole('heading', { name: 'Nothing was missing in this rehearsal' })).toBeVisible();
  await expect(page.locator('.gap-list')).toHaveCount(0);
  await expect(page.locator('.gap-row')).toHaveCount(0);
  // It says what was checked, and does not say the reader is prepared.
  await expect(page.getByText('That is what was checked, on this pack, today.')).toBeVisible();
  await expect(page.locator('main')).not.toContainText('prepared');
  await expect(page.locator('main')).not.toContainText('ready');
});

// The no-gaps state is reachable ONLY after a no-data run on a complete pack:
// under no location fix the contingency always fires. Asserted here so the
// missing combination is not read later as a coverage hole.
test('AC1 no location fix always finds something, so it never reaches the no-gaps screen', async ({
  page,
}) => {
  await rehearseToResult(page, NO_FIX, WHOLE);

  await expect(page.locator('.gap-row')).not.toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Nothing was missing in this rehearsal' }),
  ).toHaveCount(0);
});

// TC-5.2.1-E. The one thing this screen must never do.
test.describe('AC1 a result never marks the reader', () => {
  for (const [name, url, condition] of [
    ['gaps found', WITH_GAP, NO_FIX],
    ['nothing found', WHOLE, NO_DATA],
  ] as const) {
    test(`${name}: no total, count, percentage, grade or verdict`, async ({ page }) => {
      await rehearseToResult(page, condition, url);

      const text = (await page.locator('main').innerText()).toLowerCase();
      ['score', 'grade', 'total', 'passed', 'failed', 'pass', 'fail', '%', 'out of'].forEach(
        (word) => expect(text, `found "${word}"`).not.toContain(word),
      );
      // No bare digit: a number on this screen is a number the reader counts with.
      expect(text).not.toMatch(/\d/);
      // And no verdict about the person.
      expect(text).not.toMatch(/\bunprepared\b|\byou are (ready|prepared)\b/);
    });
  }
});

// TC-5.2.1-F, and the AC3 guarantee it rests on.
test.describe('AC1 what the run recorded', () => {
  test('reading the result again gives the same gaps', async ({ page }) => {
    await rehearseToResult(page, NO_FIX, WITH_GAP);
    const before = await page.locator('.gap-row h3').allInnerTexts();

    // Leave the screen and come back: the same run, the same finding.
    await page.getByTestId('remount').click();
    await page.getByTestId('remount').click();
    await expect(page.locator('.rehearsal-bar')).toBeVisible();

    expect(await page.locator('.gap-row h3').allInnerTexts()).toEqual(before);
  });

  test('the result is a rehearsal, and says so throughout', async ({ page }) => {
    await rehearseToResult(page, NO_FIX, WITH_GAP);

    await expect(page.locator('.rehearsal-bar')).toContainText('Rehearsal');
    await expect(page.locator('.rehearsal-bar-condition')).toHaveText(NO_FIX);
    await expect(page.getByText('Rehearsed without No location fix.')).toBeVisible();
  });

  test('nothing leaves the device while the result is produced', async ({ page }) => {
    const offOrigin: string[] = [];
    page.on('request', (request) => {
      if (!request.url().startsWith(ORIGIN)) offOrigin.push(`${request.method()} ${request.url()}`);
    });

    await rehearseToResult(page, NO_DATA, WITH_GAP);
    await expect(page.locator('.gap-row')).not.toHaveCount(0);

    expect(offOrigin).toEqual([]);
  });
});

// E5-US2-AC1 — the reader's own record of what they have done about a gap.
//
// `keep=1` makes the harness seed only once, so a reload keeps what the previous
// load wrote. Without it every load starts from a clean device and a
// survives-a-reload test could not be written at all.
const KEEP = `${ORIGIN}/rehearse?mode=gap&keep=1`;

const firstRow = (page: Page) => page.locator('.gap-row').first();

test.describe('AC1 marking an action done', () => {
  // TC-5.2.1-C
  test('records the date, shows it, and survives a reload', async ({ page }) => {
    await rehearseToResult(page, NO_FIX, KEEP);
    await expect(page.locator('.gap-row').first()).toBeVisible();
    const row = firstRow(page);

    await expect(row.getByRole('button', { name: 'Mark this done' })).toBeVisible();
    await expect(row.locator('.gap-done')).toHaveCount(0);

    await row.getByRole('button', { name: 'Mark this done' }).click();
    await expect(row.locator('.gap-done')).toHaveText(/^You marked this done \d{1,2} [A-Z][a-z]+ \d{4}$/);
    const shown = await row.locator('.gap-done').innerText();

    // The app is closed and reopened. The rehearsal is gone, as AC3 requires;
    // the record of what the reader has done is not.
    await page.reload();
    await expect(page.getByRole('heading', { name: CHOOSE_HEADING })).toBeVisible();
    await rehearseToResult(page, NO_FIX);
    await expect(firstRow(page).locator('.gap-done')).toHaveText(shown);
  });

  test('is attributed to the reader, and never reads as the capability returning', async ({ page }) => {
    await rehearseToResult(page, NO_FIX, KEEP);
    await expect(page.locator('.gap-row').first()).toBeVisible();
    const row = page.locator('.gap-row', { hasText: CONDITION_MEANING });

    await row.getByRole('button', { name: 'Mark this done' }).click();
    await expect(row.locator('.gap-done')).toContainText('You marked this done');
    // The gap is still stated, in the same words, beside the completion.
    await expect(row).toContainText(CONDITION_MEANING);
    await expect(row).not.toContainText('restored');
    await expect(row).not.toContainText('available again');
  });

  // TC-5.2.1-F
  test('does not change the gap it belongs to', async ({ page }) => {
    await rehearseToResult(page, NO_FIX, KEEP);
    await expect(page.locator('.gap-row').first()).toBeVisible();
    const before = await page.locator('.gap-row h3').allInnerTexts();
    const meanings = await page.locator('.gap-row > p.muted').allInnerTexts();

    await firstRow(page).getByRole('button', { name: 'Mark this done' }).click();
    await expect(firstRow(page).locator('.gap-done')).toBeVisible();

    expect(await page.locator('.gap-row h3').allInnerTexts()).toEqual(before);
    expect(await page.locator('.gap-row > p.muted').allInnerTexts()).toEqual(meanings);
  });

  test('marks only the action it belongs to', async ({ page }) => {
    await rehearseToResult(page, NO_FIX, KEEP);
    await expect(page.locator('.gap-row').first()).toBeVisible();
    await firstRow(page).getByRole('button', { name: 'Mark this done' }).click();

    await expect(firstRow(page).locator('.gap-done')).toBeVisible();
    await expect(page.locator('.gap-row').nth(1).locator('.gap-done')).toHaveCount(0);
  });
});

// TC-5.2.1-I. The reader correcting their own record is not the product
// un-ticking: nothing expires a completion, and only this control removes one.
test.describe('AC1 undoing a marking', () => {
  test('leaves no completion, no date, and the gap unchanged', async ({ page }) => {
    await rehearseToResult(page, NO_FIX, KEEP);
    await expect(page.locator('.gap-row').first()).toBeVisible();
    const row = firstRow(page);
    const title = await row.locator('h3').innerText();
    const meaning = await row.locator('p.muted').first().innerText();

    await row.getByRole('button', { name: 'Mark this done' }).click();
    await expect(row.locator('.gap-done')).toBeVisible();

    // The same control, tapped again. No confirm step, no menu.
    await row.getByRole('button', { name: 'I have not done this' }).click();
    await expect(row.locator('.gap-done')).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'Mark this done' })).toBeVisible();

    // The gap is not newly detected: it reads exactly as it did before.
    await expect(row.locator('h3')).toHaveText(title);
    await expect(row.locator('p.muted').first()).toHaveText(meaning);
    // Nothing reads as the gap having just been found: undoing a completion is
    // a correction to the reader's record, not a change to what the run found.
    // (The word "again" is not checked for: the actions themselves say "build
    // this pack again", which is the action, not a claim about the gap.)
    await expect(page.locator('main')).not.toContainText('newly');
    await expect(page.locator('main')).not.toContainText('found again');
    await expect(page.locator('main')).not.toContainText('new gap');
    await expect(page.locator('main')).not.toContainText('reappeared');

    // And it is gone from the device, not merely from the screen.
    await page.reload();
    await rehearseToResult(page, NO_FIX);
    await expect(firstRow(page).locator('.gap-done')).toHaveCount(0);
  });

  test('can be marked again afterwards', async ({ page }) => {
    await rehearseToResult(page, NO_FIX, KEEP);
    await expect(page.locator('.gap-row').first()).toBeVisible();
    const row = firstRow(page);

    await row.getByRole('button', { name: 'Mark this done' }).click();
    await row.getByRole('button', { name: 'I have not done this' }).click();
    await row.getByRole('button', { name: 'Mark this done' }).click();

    await expect(row.locator('.gap-done')).toBeVisible();
  });
});

// A completion belongs to the pack, not to the run, so the reader does not
// re-tick what they have already done.
test('AC1 a completion is still there on the next rehearsal', async ({ page }) => {
  await rehearseToResult(page, NO_FIX, KEEP);
  await expect(page.locator('.gap-row').first()).toBeVisible();
  await firstRow(page).getByRole('button', { name: 'Mark this done' }).click();
  await expect(firstRow(page).locator('.gap-done')).toBeVisible();

  // Leave the rehearsal and run another one on the same pack.
  await page.getByRole('button', { name: 'Leave the rehearsal' }).click();
  await expect(page.getByRole('heading', { name: CHOOSE_HEADING })).toBeVisible();
  await rehearseToResult(page, NO_FIX);

  await expect(firstRow(page).locator('.gap-done')).toBeVisible();
});

// TC-5.2.1-E again, now that a date is on the screen: a date is not a count.
test('AC1 a completion adds no total, count or verdict', async ({ page }) => {
  await rehearseToResult(page, NO_FIX, KEEP);
  await expect(page.locator('.gap-row').first()).toBeVisible();
  await firstRow(page).getByRole('button', { name: 'Mark this done' }).click();
  await expect(firstRow(page).locator('.gap-done')).toBeVisible();

  const text = (await page.locator('main').innerText()).toLowerCase();
  ['score', 'grade', 'total', 'passed', 'failed', '%', 'out of', 'remaining', 'complete'].forEach(
    (word) => expect(text, `found "${word}"`).not.toContain(word),
  );
  expect(text).not.toMatch(/\bunprepared\b|\byou are (ready|prepared)\b/);
});
