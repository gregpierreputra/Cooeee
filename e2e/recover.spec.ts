import { expect, test } from '@playwright/test';
import { NEED_CHANNELS } from '../src/core/constants';
import * as copy from '../src/core/copy';
import { acknowledgeFirstOpen, HARNESS } from './helpers';

const RECOVER_URL = `${HARNESS}/recover`;

// E4-US1 and E4-US2: one question, plain phrases, may-match results with
// publisher, licence and date on every card, and not one request for any of it.
// The harness seeds the programs and no pack: Recover needs none.
test('a need in plain words lists the may-match programs from the pack, with zero requests', async ({ page }) => {
  await page.goto(RECOVER_URL);
  await expect(page.getByRole('heading', { name: copy.RECOVER_QUESTION })).toBeVisible();
  await expect(page.getByText(copy.RECOVER_PRIVACY_LINE)).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(7);

  let requests = 0;
  await page.route('**', async (route) => { requests += 1; await route.continue(); });
  await page.getByRole('button', { name: copy.NEED_PHRASE.money }).click();

  await expect(page.getByRole('heading', { name: copy.NEED_PHRASE.money })).toBeVisible();
  await expect(page.getByText(copy.RECOVER_MAY_MATCH)).toBeVisible();
  await expect(page.getByText(copy.RECOVER_ORDER_LINE)).toBeVisible();
  const cards = page.locator('.card');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Example disaster payment');
  await expect(cards.first().locator('.monogram')).toHaveText('SA');
  await expect(cards.first().locator('.need-pill')).toHaveText([copy.NEED_PHRASE.money, copy.NEED_PHRASE.property]);
  await expect(page.locator('.card.kept')).toHaveCount(0);
  await expect(cards.first()).toContainText('Published by Services Australia · Saved 9 September 2026');
  await expect(cards.first()).toContainText(copy.LICENCE_LINE('CC BY 4.0'));
  await expect(cards.getByRole('link', { name: copy.OPEN_ORIGINAL_SOURCE }))
    .toHaveAttribute('href', 'https://www.servicesaustralia.gov.au/');
  await expect(cards.getByRole('link', { name: copy.CALL_LINE('180 22 66') }))
    .toHaveAttribute('href', 'tel:1802266');
  await expect(page.locator('main')).not.toContainText(/recommended|eligible for|best match/i);
  await expect(page.getByRole('button', { name: copy.KEEP })).toHaveCount(1);
  await expect(page.getByText(copy.RECOVER_STALE_LINE)).toHaveCount(0);

  await page.getByRole('button', { name: copy.CHOOSE_ANOTHER_NEED }).click();
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
  await expect(page.getByRole('button', { name: copy.CHOOSE_ANOTHER_NEED })).toBeVisible();
});

// E4-US3-AC3: an old snapshot says so in words and the programs stay shown.
test('an old snapshot is labelled in plain words and still shown', async ({ page }) => {
  await page.goto(`${RECOVER_URL}?mode=stale`);
  await page.getByRole('button', { name: copy.NEED_PHRASE.health }).click();

  await expect(page.getByText(copy.RECOVER_STALE_LINE)).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.locator('.card')).toContainText(copy.LICENCE_LINE('Link only, all rights reserved'));
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
  await page.getByRole('button', { name: copy.EVERY_PROGRAM }).click();
  await expect(page.getByRole('heading', { name: copy.EVERY_PROGRAM })).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(2);
  await expect(page.locator('.card').first()).toContainText('Australian Red Cross');
  await expect(page.getByText(copy.RECOVER_ORDER_LINE)).toBeVisible();
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
  await page.getByRole('button', { name: copy.KEPT_PROGRAMS }).click();
  await expect(page.locator('.card')).toHaveCount(1);
  await page.getByRole('button', { name: copy.CHOOSE_ANOTHER_NEED }).click();
  await page.getByRole('button', { name: copy.EVERY_PROGRAM }).click();
  await expect(page.locator('.card').first()).toContainText('Example disaster payment');
  await expect(page.getByText(copy.RECOVER_ORDER_LINE_KEPT)).toBeVisible();
  await page.getByRole('button', { name: copy.KEPT }).click();
  expect(await page.evaluate(() => window.localStorage.getItem('cooeee.kept.v1'))).toBe('[]');
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
  const section = page.locator('.saved-programs');
  await expect(section.getByText(copy.SAVED_PROGRAMS)).toBeVisible();
  await expect(section.locator('.card')).toHaveCount(0);
  const toggle = section.getByRole('button', { name: copy.SHOW_SAVED_PROGRAMS(1) });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(section.locator('.card')).toHaveCount(1);
  await expect(section.locator('.monogram')).toHaveText('SA');
  await expect(section.locator('.need-pill')).toHaveText([copy.NEED_PHRASE.money]);
  await expect(section.getByRole('link', { name: copy.OPEN_SOURCE_FILE })).toHaveAttribute('download', 'program.pdf');
  await section.getByRole('button', { name: copy.HIDE_SAVED_PROGRAMS }).click();
  await expect(section.locator('.card')).toHaveCount(0);
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
