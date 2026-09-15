import { expect, test, type Page } from '@playwright/test';
import { rehearseToResult } from './helpers';

const ORIGIN = 'http://127.0.0.1:4174';
const NO_FIX = 'No location fix';
const NO_DATA = 'No mobile data';

/** `earlier=` seeds a rehearsal that already happened, under no location fix. */
const url = (earlier?: string) =>
  `${ORIGIN}/rehearse?mode=gap${earlier ? `&earlier=${earlier}` : ''}`;

const progress = (page: Page) => page.locator('.progress');

// E5-US2-AC3 — no earlier rehearsal to compare against.
test.describe('AC3 a first rehearsal of this pack this way', () => {
  // TC-5.2.2-D
  test('says so, and still renders the whole gap list', async ({ page }) => {
    await rehearseToResult(page, NO_FIX, url(undefined));

    await expect(
      progress(page).getByRole('heading', {
        name: 'This is your first rehearsal of this pack this way',
      }),
    ).toBeVisible();
    await expect(page.getByText('There is nothing earlier to compare it with yet.')).toBeVisible();

    // A first rehearsal is a whole result, not a partial one.
    await expect(page.locator('.gap-row')).not.toHaveCount(0);
    await expect(page.locator('.gap-action-label').first()).toBeVisible();
  });

  test('shows no empty chart, bar or figure standing in for the comparison', async ({ page }) => {
    await rehearseToResult(page, NO_FIX, url(undefined));

    // Scoped to the comparison: the screen's decorative glyphs are drawings, not figures.
    await expect(progress(page).locator('svg, canvas, progress, meter, .chart, .bar')).toHaveCount(0);
    await expect(progress(page).locator('.progress-group')).toHaveCount(0);
    const text = (await progress(page).innerText()).toLowerCase();
    ['baseline', 'incomplete', 'partial', 'so far', 'score'].forEach((word) =>
      expect(text, `found "${word}"`).not.toContain(word),
    );
  });
});

// E5-US2-AC2 — progress, not a score.
test.describe('AC2 what changed since the last rehearsal', () => {
  // TC-5.2.2-A
  test('names the earlier rehearsal by its date, and groups what moved in words', async ({ page }) => {
    await rehearseToResult(page, NO_FIX, url('changed'));

    await expect(
      progress(page).getByRole('heading', { name: 'Since you last rehearsed this pack this way' }),
    ).toBeVisible();
    await expect(progress(page)).toContainText('Compared with your rehearsal of 1 March 2026');

    // The earlier run found only the contingency, so the pack-content gap is
    // one it did not find.
    await expect(progress(page).locator('.progress-group .kicker')).toContainText([
      'Not found last time',
    ]);
  });

  // TC-5.2.2-B
  test('never compares against a run under a different condition', async ({ page }) => {
    // The seeded earlier run is under no location fix; this one is no data.
    await rehearseToResult(page, NO_DATA, url('changed'));

    await expect(
      progress(page).getByRole('heading', {
        name: 'This is your first rehearsal of this pack this way',
      }),
    ).toBeVisible();
    await expect(progress(page)).not.toContainText('Compared with your rehearsal');
  });

  // Every group is told apart by its heading, so removing colour removes
  // nothing [WCAG 1.4.1].
  test('reads the same with every colour stripped out', async ({ page }) => {
    await rehearseToResult(page, NO_FIX, url('changed'));
    const before = await progress(page).innerText();

    await page.addStyleTag({ content: 'html { filter: grayscale(1) !important; }' });

    expect(await progress(page).innerText()).toBe(before);
    await expect(progress(page).locator('.progress-group .kicker').first()).toBeVisible();
  });
});

// E5-US2-AC4 — the pack changed since the last rehearsal.
test.describe('AC4 a comparison across a pack that changed', () => {
  // TC-5.2.2-E
  test('says the pack changed, names when, and still shows the comparison', async ({ page }) => {
    await rehearseToResult(page, NO_FIX, url('changed'));

    await expect(progress(page).locator('.progress-pack-change')).toContainText(
      'You built this pack again on 3 March 2026',
    );
    // Annotated, never suppressed.
    await expect(progress(page)).toContainText('Compared with your rehearsal of');
    await expect(progress(page).locator('.progress-group')).not.toHaveCount(0);
  });

  test('keeps a change in the pack apart from a change in what the reader did', async ({ page }) => {
    await rehearseToResult(page, NO_FIX, url('changed'));

    await expect(progress(page).locator('.progress-pack-change')).toContainText(
      'What changed between them is not only what you did.',
    );
    const text = (await progress(page).innerText()).toLowerCase();
    ['your fault', 'you failed', 'you did not', 'well done'].forEach((phrase) =>
      expect(text, `found "${phrase}"`).not.toContain(phrase),
    );
  });

  test('says nothing about the pack when it did not change', async ({ page }) => {
    await rehearseToResult(page, NO_FIX, url('same'));

    await expect(progress(page)).toContainText('Compared with your rehearsal of');
    await expect(progress(page).locator('.progress-pack-change')).toHaveCount(0);
  });

  // TC-5.2.2-F
  test('says it cannot be told, rather than defaulting to unchanged', async ({ page }) => {
    await rehearseToResult(page, NO_FIX, url('unknown'));

    await expect(progress(page).locator('.progress-pack-change')).toContainText(
      'was not recorded, so it cannot be said either way',
    );
    const text = (await progress(page).innerText()).toLowerCase();
    ['unchanged', 'no change', 'the same pack'].forEach((phrase) =>
      expect(text, `found "${phrase}"`).not.toContain(phrase),
    );
  });
});

// TC-5.2.2-C. The one thing this screen must never do.
test.describe('AC2 progress is never a score', () => {
  for (const earlier of [undefined, 'same', 'changed', 'unknown']) {
    test(`no number anywhere: ${earlier ?? 'first rehearsal'}`, async ({ page }) => {
      await rehearseToResult(page, NO_FIX, url(earlier));
      await expect(progress(page)).toBeVisible();

      const text = (await progress(page).innerText()).toLowerCase();
      ['score', 'grade', 'total', 'percent', '%', 'out of', 'passed', 'failed'].forEach((word) =>
        expect(text, `found "${word}"`).not.toContain(word),
      );
      // A date is the only figure allowed here, and only in the two lines that
      // name one. Nothing else counts anything.
      const withoutDates = text.replace(/\d{1,2} [a-z]+ \d{4}/g, '');
      expect(withoutDates).not.toMatch(/\d/);

      // And no verdict about the reader.
      ['prepared', 'unprepared', 'ready', 'improved', 'better than', 'on track'].forEach((word) =>
        expect(text, `found "${word}"`).not.toContain(word),
      );
    });
  }
});
