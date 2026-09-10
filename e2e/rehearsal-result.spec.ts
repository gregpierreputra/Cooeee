import { expect, test, type Page } from '@playwright/test';

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

async function run(page: Page, url: string, condition: string) {
  await page.goto(url);
  await expect(page.getByRole('heading', { name: CHOOSE_HEADING })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(condition) }).click();
  await expect(page.locator('.rehearsal-bar')).toBeVisible();
}

// E5-US2-AC1 — one action for each gap.

test.describe('AC1 each gap arrives with one action', () => {
  // TC-5.2.1-A
  test('every gap row carries exactly one action, and never none', async ({ page }) => {
    await run(page, WITH_GAP, NO_FIX);

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
    await run(page, WITH_GAP, NO_FIX);

    await expect(page.getByText(PACK_CONTENT_MEANING)).toBeVisible();
    await expect(page.getByText(CONDITION_MEANING)).toBeVisible();
    // Both kinds are on screen, in one list, told apart only by their words.
    await expect(page.locator('.gap-list')).toHaveCount(1);
  });

  test('every gap names whose journey it belongs to', async ({ page }) => {
    await run(page, WITH_GAP, NO_FIX);

    const rows = page.locator('.gap-row');
    const count = await rows.count();
    for (let i = 0; i < count; i += 1) {
      await expect(rows.nth(i).locator('.kicker')).toHaveText('Bushfire journey');
    }
  });

  test('a contingency action never says the capability has come back', async ({ page }) => {
    await run(page, WHOLE, NO_FIX);

    const row = page.locator('.gap-row', { hasText: CONDITION_MEANING });
    await expect(row).toHaveCount(1);
    await expect(row).not.toContainText('restored');
    await expect(row).not.toContainText('back online');
    await expect(row).not.toContainText('will work');
  });
});

// TC-5.2.1-D
test('AC1 a rehearsal that found nothing renders its own screen', async ({ page }) => {
  await run(page, WHOLE, NO_DATA);

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
  await run(page, WHOLE, NO_FIX);

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
      await run(page, url, condition);

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
    await run(page, WITH_GAP, NO_FIX);
    const before = await page.locator('.gap-row h3').allInnerTexts();

    // Leave the screen and come back: the same run, the same finding.
    await page.getByTestId('remount').click();
    await page.getByTestId('remount').click();
    await expect(page.locator('.rehearsal-bar')).toBeVisible();

    expect(await page.locator('.gap-row h3').allInnerTexts()).toEqual(before);
  });

  test('the result is a rehearsal, and says so throughout', async ({ page }) => {
    await run(page, WITH_GAP, NO_FIX);

    await expect(page.locator('.rehearsal-bar')).toContainText('Rehearsal');
    await expect(page.locator('.rehearsal-bar-condition')).toHaveText(NO_FIX);
    await expect(page.getByText('Rehearsed without No location fix.')).toBeVisible();
  });

  test('nothing leaves the device while the result is produced', async ({ page }) => {
    const offOrigin: string[] = [];
    page.on('request', (request) => {
      if (!request.url().startsWith(ORIGIN)) offOrigin.push(`${request.method()} ${request.url()}`);
    });

    await run(page, WITH_GAP, NO_DATA);
    await expect(page.locator('.gap-row')).not.toHaveCount(0);

    expect(offOrigin).toEqual([]);
  });
});
