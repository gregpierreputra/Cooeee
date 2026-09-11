import { expect, test } from '@playwright/test';
import { NEED_CHANNELS } from '../src/core/constants';
import * as copy from '../src/core/copy';
import { acknowledgeFirstOpen, HARNESS } from './helpers';

const RECOVER_URL = `${HARNESS}/recover`;

// E4-US1 and E4-US2: one question, plain phrases, may-match results with
// publisher, licence and date on every card, and not one request for any of it.
test('a need in plain words lists the may-match programs from the pack, with zero requests', async ({ page }) => {
  await page.goto(RECOVER_URL);
  await expect(page.getByRole('heading', { name: copy.RECOVER_QUESTION })).toBeVisible();
  await expect(page.getByText(copy.RECOVER_PRIVACY_LINE)).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(6);

  let requests = 0;
  await page.route('**', async (route) => { requests += 1; await route.continue(); });
  await page.getByRole('button', { name: copy.NEED_PHRASE.money }).click();

  await expect(page.getByRole('heading', { name: copy.NEED_PHRASE.money })).toBeVisible();
  await expect(page.getByText(copy.RECOVER_MAY_MATCH)).toBeVisible();
  await expect(page.getByText(copy.RECOVER_ORDER_LINE)).toBeVisible();
  const cards = page.locator('.card');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Example disaster payment');
  await expect(cards.first()).toContainText('Published by Services Australia · Saved 9 September 2026');
  await expect(cards.first()).toContainText(copy.LICENCE_LINE('CC BY 4.0'));
  await expect(cards.getByRole('link', { name: copy.OPEN_ORIGINAL_SOURCE }))
    .toHaveAttribute('href', 'https://www.servicesaustralia.gov.au/');
  await expect(cards.getByRole('link', { name: copy.CALL_LINE('180 22 66') }))
    .toHaveAttribute('href', 'tel:1802266');
  await expect(page.locator('main')).not.toContainText(/recommended|eligible for|best match/i);
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
  await expect(page.getByText(copy.VERIFIED_ON('10 September 2026'))).toBeVisible();
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

// E4-US3-AC2: no pack is a designed screen that offers to build one.
test('with no pack, Recover says it holds nothing and offers to build a pack', async ({ page }) => {
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
  await expect(page.getByRole('heading', { name: copy.RECOVER_NONE_TITLE })).toBeVisible();
  await expect(nav).toBeVisible();
});
