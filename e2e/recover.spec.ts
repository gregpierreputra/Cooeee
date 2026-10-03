import { expect, test } from '@playwright/test';
import { NEED_CHANNELS } from '../src/core/constants';
import * as copy from '../src/core/copy';
import { acknowledgeFirstOpen, HARNESS, openSources } from './helpers';

const RECOVER_URL = `${HARNESS}/recover`;

// E4-US1 and E4-US2: one question, plain phrases, may-match results with
// publisher, licence and date on every card, and not one request for any of it.
// The harness seeds the programs and no pack: Recover needs none.
test('a need in plain words lists the may-match programs from the pack, with zero requests', async ({ page }) => {
  await page.goto(RECOVER_URL);
  await expect(page.getByRole('heading', { name: copy.RECOVER_QUESTION })).toBeVisible();
  await expect(page.getByText(copy.RECOVER_PRIVACY_LINE)).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(9);

  let requests = 0;
  await page.route('**', async (route) => { requests += 1; await route.continue(); });
  await page.getByRole('button', { name: copy.NEED_PHRASE.money }).click();

  await expect(page.getByRole('heading', { name: copy.NEED_PHRASE.money })).toBeVisible();
  await expect(page.getByText(copy.RECOVER_MAY_MATCH)).toBeVisible();
  const cards = page.locator('.card');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Example disaster payment');
  await expect(cards.first().locator('.monogram')).toHaveText('SA');
  await expect(cards.first().locator('.need-pill')).toHaveText([copy.NEED_PHRASE.money, copy.NEED_PHRASE.property]);
  await expect(page.locator('.card.kept')).toHaveCount(0);
  await openSources(page);
  const source = cards.first().locator('.source-rows');
  await expect(source).toContainText('Services Australia');
  await expect(source).toContainText('9 September 2026');
  await expect(source).toContainText('CC BY 4.0');
  await expect(cards.getByRole('link', { name: copy.OPEN_ORIGINAL_SOURCE }))
    .toHaveAttribute('href', 'https://www.servicesaustralia.gov.au/');
  await expect(cards.getByRole('link', { name: copy.CALL_LINE('180 22 66') }))
    .toHaveAttribute('href', 'tel:1802266');
  await expect(page.locator('main')).not.toContainText(/recommended|eligible for|best match/i);
  await expect(page.getByRole('button', { name: copy.KEEP })).toHaveCount(1);
  await expect(page.getByText(copy.RECOVER_STALE_LINE)).toHaveCount(0);

  await page.getByRole('button', { name: copy.BACK, exact: true }).click();
  await expect(page.getByRole('heading', { name: copy.RECOVER_QUESTION })).toBeVisible();
  expect(requests).toBe(0);
});

// E4-US3-AC1: nothing tagged to the need is a designed screen with the channel.
test('a need the pack holds nothing for says so and names the official channel', async ({ page }) => {
  await page.goto(RECOVER_URL);
  await page.getByRole('button', { name: copy.NEED_PHRASE.documents }).click();

  await expect(page.getByRole('heading', { name: copy.RECOVER_NO_MATCH_TITLE })).toBeVisible();
  await expect(page.getByText(copy.RECOVER_NO_MATCH_LINE)).toBeVisible();
  await expect(page.getByText(copy.VERIFIED_ON('9 September 2026'))).toBeVisible();
  await expect(page.getByRole('link', { name: copy.OFFICIAL_CHANNEL }))
    .toHaveAttribute('href', NEED_CHANNELS.documents);
  // Back at the top is the way to another need; nothing repeats it below.
  await expect(page.getByRole('button', { name: copy.BACK, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Another need' })).toHaveCount(0);
});

// E4-US3-AC3: an old snapshot says so in words and the programs stay shown.
test('an old snapshot is labelled in plain words and still shown', async ({ page }) => {
  await page.goto(`${RECOVER_URL}?mode=stale`);
  await page.getByRole('button', { name: copy.NEED_PHRASE.health }).click();

  await expect(page.getByText(copy.RECOVER_STALE_LINE)).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(1);
  await openSources(page);
  await expect(page.locator('.card .source-rows')).toContainText('Link only, all rights reserved');
});

// E4-US2-AC6: the source at a glance.
test('every card opens with its organisation\'s initials', async ({ page }) => {
  await page.goto(RECOVER_URL);
  await page.getByRole('button', { name: copy.NEED_PHRASE.health }).click();
  await expect(page.locator('.card .monogram')).toHaveText('ARC');
});

// E4-US3-AC2: nothing on the device at all is a designed screen that offers to build a pack.
test('with nothing on the device, Recover says it holds nothing and offers to build a pack', async ({ page }) => {
  await page.goto(`${RECOVER_URL}?mode=none`);
  await expect(page.getByRole('heading', { name: copy.RECOVER_NONE_TITLE })).toBeVisible();
  await expect(page.getByText(copy.RECOVER_NONE_LINE)).toBeVisible();
  await expect(page.getByRole('link', { name: copy.BUILD_A_PACK })).toBeVisible();
  await expect(page.getByRole('link', { name: copy.OFFICIAL_CHANNEL })).toBeVisible();
});

// E4-US1-AC4: Recover is reached from the bottom bar of the real bundle, any day.
test('the bottom bar opens Recover', async ({ page }) => {
  await acknowledgeFirstOpen(page);
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: copy.NAV_LABEL });
  await nav.getByRole('link', { name: copy.NAV_RECOVER }).click();

  await expect(page).toHaveURL(/\/recover$/);
  await expect(page.getByRole('heading', { name: copy.RECOVER_QUESTION })).toBeVisible();
  await expect(nav).toBeVisible();
});

// E4-US4-AC1: every program, any day, with no need chosen.
test('every program in the pack can be read without choosing a need', async ({ page }) => {
  await page.goto(RECOVER_URL);
  await page.getByRole('button', { name: copy.ALL_PROGRAMS }).click();
  await expect(page.getByRole('heading', { name: copy.ALL_PROGRAMS })).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(2);
  await expect(page.locator('.card').first()).toContainText('Australian Red Cross');
});

// E4-US6: a kept program is remembered on the phone, listed first, and offered as its own row.
test('a kept program comes first and is offered as a row of its own', async ({ page }) => {
  await page.goto(RECOVER_URL);
  await expect(page.getByRole('button', { name: copy.KEPT_PROGRAMS })).toHaveCount(0);
  await page.getByRole('button', { name: copy.NEED_PHRASE.money }).click();
  const keep = page.getByRole('button', { name: copy.KEEP });
  await keep.click();
  await expect(page.getByRole('button', { name: copy.KEPT })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.card.kept')).toHaveCount(1);
  expect(await page.evaluate(() => window.localStorage.getItem('cooeee.kept.v1'))).toBe('["recover:payment"]');

  await page.reload();
  // The two tiles over the needs say the kept list is shared and the programs are on the phone.
  await expect(page.getByRole('button', { name: `${copy.KEPT_PROGRAMS} ${copy.KEPT_PROGRAMS_DETAIL}` })).toBeVisible();
  await expect(page.getByRole('button', { name: `${copy.ALL_PROGRAMS} ${copy.ALL_PROGRAMS_DETAIL}` })).toBeVisible();
  await page.getByRole('button', { name: copy.KEPT_PROGRAMS }).click();
  await expect(page.locator('.card')).toHaveCount(1);
  // UAT: releasing it here keeps the card on the list until the person leaves.
  await page.getByRole('button', { name: copy.KEPT }).click();
  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: copy.KEEP })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: copy.KEEP }).click();
  await page.getByRole('button', { name: copy.BACK, exact: true }).click();
  await page.getByRole('button', { name: copy.ALL_PROGRAMS }).click();
  await expect(page.locator('.card').first()).toContainText('Example disaster payment');
  await page.getByRole('button', { name: copy.KEPT }).click();
  expect(await page.evaluate(() => window.localStorage.getItem('cooeee.kept.v1'))).toBe('[]');
});

// UR-US33: Clear all on the kept list asks once, and keeps the cards on screen.
test('Clear all asks first, then releases every kept program', async ({ page }) => {
  await page.goto(RECOVER_URL);
  await page.evaluate(() => window.localStorage.setItem('cooeee.kept.v1', '["recover:payment"]'));
  await page.reload();
  await page.getByRole('button', { name: copy.KEPT_PROGRAMS }).click();

  const clear = page.getByRole('button', { name: copy.CLEAR_KEPT });
  await clear.click();
  await expect(page.getByText(copy.CLEAR_KEPT_QUESTION)).toBeVisible();
  await expect(page.getByRole('button', { name: copy.KEEP_KEPT })).toBeFocused();
  await page.getByRole('button', { name: copy.KEEP_KEPT }).click();
  await expect(clear).toBeFocused();
  expect(await page.evaluate(() => window.localStorage.getItem('cooeee.kept.v1'))).toBe('["recover:payment"]');

  await clear.click();
  await page.getByRole('button', { name: copy.CLEAR_KEPT }).click();
  expect(await page.evaluate(() => window.localStorage.getItem('cooeee.kept.v1'))).toBe('[]');
  await expect(page.getByRole('status').filter({ hasText: copy.KEPT_CLEARED })).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: copy.KEEP })).toHaveAttribute('aria-pressed', 'false');
});

// E4-US5: the list leaves as plain text, with the caveat at the top.
test('the list is shared as plain text that starts with the caveat', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: HARNESS });
  await page.goto(RECOVER_URL);
  await page.getByRole('button', { name: copy.NEED_PHRASE.money }).click();
  await page.getByRole('button', { name: copy.SHARE_LIST }).click();
  await expect(page.getByRole('status')).toHaveText(copy.COPIED_LINE);
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text.startsWith(`${copy.NEED_PHRASE.money}\n${copy.RECOVER_MAY_MATCH}`)).toBe(true);
  expect(text).toContain('Call 180 22 66');
  expect(text).toContain('Published by Services Australia · Saved 9 September 2026');
  expect(text.endsWith(copy.SHARED_FROM)).toBe(true);
});

// E4-US7: the saved programs are sectioned off on the pack page under one
// control, each with the copy of its own page.
test('the pack page sections off its saved programs, each with its own page copy', async ({ page }) => {
  await page.goto(`${HARNESS}/detail`);
  const section = page.locator('.pack-section', { hasText: copy.SAVED_PROGRAMS });
  await expect(section.locator('.section-count')).toHaveText('1');
  await expect(section.locator('.card').first()).toBeHidden();
  const toggle = section.getByRole('button', { name: copy.SHOW_SECTION(copy.SAVED_PROGRAMS) });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(section.locator('.card')).toHaveCount(1);
  await expect(section.locator('.monogram')).toHaveText('SA');
  await expect(section.locator('.need-pill')).toHaveText([copy.NEED_PHRASE.money]);
  await expect(section.getByRole('link', { name: copy.OPEN_SOURCE_FILE })).toHaveAttribute('download', 'program.pdf');
  await section.getByRole('button', { name: copy.HIDE_SECTION(copy.SAVED_PROGRAMS) }).click();
  await expect(section.locator('.card').first()).toBeHidden();
});

// E1-US2-AC10: every block of the pack page has a glyph and one control.
test('every pack page section carries a glyph and opens and closes under one control', async ({ page }) => {
  await page.goto(`${HARNESS}/detail`);
  const heads = page.locator('.pack-section-head');
  // Seven since R3 added the wellbeing lines.
  await expect(heads).toHaveCount(7);
  await expect(heads.locator('.glyph')).toHaveCount(7);
  const places = page.locator('.pack-section', { hasText: copy.DESTINATIONS_STEP_TITLE });
  await expect(places.locator('.card')).toHaveCount(1);
  await places.getByRole('button', { name: copy.HIDE_SECTION(copy.DESTINATIONS_STEP_TITLE) }).click();
  await expect(places.locator('.card').first()).toBeHidden();
  await places.getByRole('button', { name: copy.SHOW_SECTION(copy.DESTINATIONS_STEP_TITLE) }).click();
  await expect(places.locator('.card').first()).toBeVisible();
});

// E4-US7-AC4: kept programs with no pack to carry them earn one nudge on Home.
test('Home nudges towards a pack while a kept program is not saved offline', async ({ page }) => {
  await acknowledgeFirstOpen(page);
  await page.goto('/');
  await expect(page.locator('.nudge')).toHaveCount(0);
  await page.evaluate(() => window.localStorage.setItem('cooeee.kept.v1', '["services-australia-crisis-payment"]'));
  await page.goto('/');
  await expect(page.locator('.nudge')).toContainText(copy.KEPT_NOT_SAVED(1));
  await expect(page.locator('.nudge').getByRole('link', { name: copy.BUILD_A_PACK })).toBeVisible();
});

// E4-US9: a program kept after a pack exists flows into that pack on the next
// visit to Home, so the nudge never shows for a user who already has a pack.
test('Home mirrors a kept program into an existing pack and shows no nudge', async ({ page }) => {
  await page.goto(`${HARNESS}/home?mode=kept`);
  await expect(page.locator('.home .card').first()).toBeVisible();
  await expect(page.locator('.nudge')).toHaveCount(0);
  await expect.poll(async () => (await page.evaluate(() => window.__storageCounts())).packPrograms).toBe(1);
});

// E4-US9-AC3: a Recover card says when a pack already carries it.
test('a Recover card says when it is in your packs', async ({ page }) => {
  await page.goto(`${RECOVER_URL}?mode=saved`);
  await page.getByRole('button', { name: copy.NEED_PHRASE.money }).click();
  await expect(page.locator('.card .in-packs')).toHaveText(copy.IN_YOUR_PACKS);
});

// E4-US10: every number on the device, the hotline first, as tap-to-call links.
test('who to call lists the hotline and each program number as a call link', async ({ page }) => {
  await page.goto(RECOVER_URL);
  await page.getByRole('button', { name: copy.WHO_TO_CALL }).click();
  await expect(page.getByRole('heading', { name: copy.WHO_TO_CALL })).toBeVisible();
  // The wellbeing lines follow in their own group (R3).
  const links = page.locator('.list').first().locator('.card a');
  await expect(links).toHaveCount(2);
  await expect(links.first()).toHaveAttribute('href', 'tel:1800226226');
  await expect(links.nth(1)).toHaveAttribute('href', 'tel:1802266');
});

// E4-US11: one print control, and nothing leaves the phone.
test('the results screen offers to print the list', async ({ page }) => {
  await page.goto(RECOVER_URL);
  await page.getByRole('button', { name: copy.NEED_PHRASE.money }).click();
  await page.evaluate(() => { (window as Window & { __printed?: number }).__printed = 0; window.print = () => { (window as Window & { __printed?: number }).__printed! += 1; }; });
  await page.getByRole('button', { name: copy.PRINT_LIST }).click();
  expect(await page.evaluate(() => (window as Window & { __printed?: number }).__printed)).toBe(1);
});

// The pressed control is gone once the page changes, so focus moves to the page
// itself rather than dropping to the document, where the next Tab would restart
// from the top.
test('focus stays on the page when a need is chosen and when going back', async ({ page }) => {
  await page.goto(RECOVER_URL);
  await page.getByRole('button', { name: copy.NEED_PHRASE.money }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: copy.NEED_PHRASE.money })).toBeVisible();
  await expect(page.locator('main')).toBeFocused();

  await page.getByRole('button', { name: copy.BACK, exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: copy.RECOVER_QUESTION })).toBeVisible();
  await expect(page.locator('main')).toBeFocused();
});

// R1: the roadmap opens from its teal row, ticks stay on the phone across a
// reload, each stage's ring counts them, and a step leads to its programs.
test('the recovery roadmap ticks steps, keeps them, and links each step to its help', async ({ page }) => {
  await page.goto(RECOVER_URL);
  await page.getByRole('button', { name: copy.ROADMAP_TITLE }).click();
  await expect(page.getByRole('heading', { name: copy.ROADMAP_TITLE })).toBeVisible();
  const first = copy.ROADMAP_STAGES[0];
  const stage = page.getByRole('region', { name: first.title });
  await expect(stage.getByRole('img', { name: copy.ROADMAP_DONE_COUNT(0, first.steps.length) })).toBeVisible();
  const insurer = first.steps.find((step) => step.id === 'insurer')!;
  await page.getByRole('button', { name: copy.ROADMAP_MARK(insurer.text) }).click();
  await expect(page.getByRole('button', { name: copy.ROADMAP_MARK(insurer.text) })).toHaveAttribute('aria-pressed', 'true');
  // The harness opens on the landing after a reload; the tick is still there.
  await page.reload();
  await page.getByRole('button', { name: copy.ROADMAP_TITLE }).click();
  await expect(stage.getByRole('img', { name: copy.ROADMAP_DONE_COUNT(1, first.steps.length) })).toBeVisible();
  // Clear progress asks once, then unticks every step.
  await page.getByRole('button', { name: copy.ROADMAP_CLEAR }).click();
  await page.getByRole('button', { name: copy.KEEP_KEPT }).click();
  await expect(stage.getByRole('img', { name: copy.ROADMAP_DONE_COUNT(1, first.steps.length) })).toBeVisible();
  await page.getByRole('button', { name: copy.ROADMAP_CLEAR }).click();
  await page.locator('.card-confirm-yes').click();
  await expect(stage.getByRole('img', { name: copy.ROADMAP_DONE_COUNT(0, first.steps.length) })).toBeVisible();
  await expect(page.getByRole('button', { name: copy.ROADMAP_CLEAR })).toBeDisabled();
  await page.getByRole('link', { name: copy.NEED_PHRASE.money }).click();
  await expect(page.getByRole('heading', { name: copy.NEED_PHRASE.money })).toBeVisible();
});

// R3: the wellbeing lines sit under the numbers in Who to call, each one tap to call.
test('Who to call ends with the wellbeing lines', async ({ page }) => {
  await page.goto(RECOVER_URL);
  await page.getByRole('button', { name: copy.WHO_TO_CALL }).click();
  await expect(page.getByRole('heading', { name: copy.TALK_TO_SOMEONE })).toBeVisible();
  for (const line of copy.WELLBEING_LINES) {
    await expect(page.getByRole('link', { name: copy.CALL_LINE(line.number) }))
      .toHaveAttribute('href', `tel:${line.number.replaceAll(' ', '')}`);
  }
});
