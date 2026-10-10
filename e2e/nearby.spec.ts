import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
  DATA_SOURCES_LABEL,
  FIRST_RUN_LINE,
  FIRST_RUN_TITLE,
  HOURS_AGO,
  MAY_BE_OUTDATED,
  MINUTES_AGO,
  COPIED_LINE,
  SHARED_PLACE_FROM,
  STATE_CACHED,
  TOO_OLD_TO_SHOW,
} from '../src/core/copy';

const ORIGIN = 'http://127.0.0.1:4174';

// Load the seeded harness online, then cut the network before doing anything.
async function openOffline(page: Page, context: BrowserContext, mode: string) {
  await page.goto(`${ORIGIN}/nearby?mode=${mode}`);
  await page.getByRole('heading', { name: 'Nearest official places' }).waitFor();
  await context.setOffline(true);
}

async function findPostcode(page: Page) {
  // Searched at the fourth digit, with no button, like the pack builder.
  await page.getByLabel('Type a postcode').fill('3766');
}

async function openTab(page: Page, name: string) {
  const tab = page.getByRole('tab', { name });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

test('the tabs move with the arrow keys and show one group at a time', async ({ page, context }) => {
  await openOffline(page, context, 'cached');
  await findPostcode(page);

  const bushfire = page.getByRole('tab', { name: 'Bushfire places' });
  await expect(bushfire).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
  await bushfire.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Relief centres' })).toBeFocused();
  await expect(page.getByRole('tabpanel', { name: 'Relief centres' })).toBeVisible();
});

// Each tab's note starts closed, and opens with no title of its own: the
// heading beside its ring already names it.
test('each tab opens its own note, closed again after a switch', async ({ page, context }) => {
  await openOffline(page, context, 'cached');
  await findPostcode(page);
  const ring = page.locator('.nearby-group .info-ring');
  await ring.click();
  await expect(ring).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.nearby-group .hint-panel .kicker')).toHaveCount(0);

  await openTab(page, 'Relief centres');
  await expect(ring).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.nearby-group .hint-panel')).toHaveCount(0);
});

const rowFor = (page: Page, title: string) =>
  page.locator('li.card', { has: page.getByRole('heading', { level: 3, name: title, exact: true }) });

test('AC4 offline, static places come from IndexedDB labelled cached with their verified date', async ({ page, context }) => {
  await openOffline(page, context, 'cached');
  await findPostcode(page);
  await expect(page.getByText('From the centre of postcode 3766')).toBeVisible();
  await expect(page.locator('.nearby-origin-code')).toHaveText('3766');

  const nsp = rowFor(page, 'Neighbourhood Safer Place');
  await expect(nsp).toContainText('Kalorama Memorial Reserve');
  await expect(nsp).toContainText(STATE_CACHED(HOURS_AGO(2)));
  await expect(nsp).toContainText('Verified 31 August 2026');
  await expect(rowFor(page, 'Community Fire Refuge')).toContainText('Ferny Creek Community Fire Refuge');
  // One group at a time: the relief rows wait behind their own tab.
  await expect(rowFor(page, 'Relief Centre')).toHaveCount(0);

  await openTab(page, 'Relief centres');
  const relief = rowFor(page, 'Relief Centre');
  await expect(relief).toContainText('Lilydale Community Centre');
  await expect(relief).toContainText(STATE_CACHED(MINUTES_AGO(10)));
  await expect(relief).toContainText(MAY_BE_OUTDATED);
  await expect(rowFor(page, 'Neighbourhood Safer Place')).toHaveCount(0);
  // E1-US3-AC7: one drawing per kind, carried on its tab.
  await expect(page.getByRole('tab').locator('.glyph')).toHaveCount(2);

  // The data sources sit behind their toggle: closed until tapped, then each of
  // this tab's lists by name with its status and when it was last checked beneath.
  const ring = page.getByRole('button', { name: DATA_SOURCES_LABEL });
  await expect(ring).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.data-sources .hint-panel')).toHaveCount(0);
  await ring.click();
  await expect(page.locator('.data-sources .hint-panel')).toBeVisible();
  const feed = page.locator('.data-sources .source-health li').first();
  await expect(feed.locator('.source-health-name')).toHaveText('VicEmergency feed');
  await expect(feed.locator('.source-health-state')).toHaveText(/^Reachable · checked /);
  await ring.click();
  await expect(page.locator('.data-sources .hint-panel')).toHaveCount(0);
});

// Each tab lists only the sources behind its own cards, closed again after a switch.
test('each tab has its own data sources, closed after a switch', async ({ page, context }) => {
  await openOffline(page, context, 'cached');
  await findPostcode(page);
  const sources = page.getByRole('button', { name: DATA_SOURCES_LABEL });
  const names = page.locator('.data-sources .source-health-name');
  await sources.click();
  await expect(names.filter({ hasText: 'Country Fire Authority Neighbourhood Safer Places list' })).toHaveCount(1);
  await expect(names.filter({ hasText: 'VicEmergency feed' })).toHaveCount(0);

  await openTab(page, 'Relief centres');
  await expect(sources).toHaveAttribute('aria-expanded', 'false');
  await sources.click();
  await expect(names.filter({ hasText: 'VicEmergency feed' })).toHaveCount(1);
  await expect(names.filter({ hasText: 'Country Fire Authority' })).toHaveCount(0);
});

test('AC5 offline with a snapshot past the threshold, no relief centre is shown — only the stale line and the hotline', async ({ page, context }) => {
  await openOffline(page, context, 'stale');
  await findPostcode(page);

  // The static rows are unaffected by the dynamic cut-off.
  await expect(rowFor(page, 'Neighbourhood Safer Place')).toContainText('Kalorama Memorial Reserve');

  await openTab(page, 'Relief centres');
  const relief = rowFor(page, 'Relief Centre');
  await expect(relief).not.toContainText('Lilydale');
  await expect(relief).toContainText(TOO_OLD_TO_SHOW);
  await expect(relief).toContainText('1800 226 226');
});

test('AC6 offline and never synced, the first-run state is stated rather than a blank screen', async ({ page, context }) => {
  await openOffline(page, context, 'empty');
  await expect(page.getByRole('heading', { name: FIRST_RUN_TITLE })).toBeVisible();
  await expect(page.getByText(FIRST_RUN_LINE)).toBeVisible();
  await expect(page.getByLabel('Type a postcode')).toHaveCount(0);
});

// One place can be sent to someone, say to meet there. With no share sheet it
// goes to the clipboard: the place and how current it is, never the distance.
test('Share on a place copies it to send, without the distance', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  await page.goto(`${ORIGIN}/nearby?mode=fresh`);
  await page.getByRole('heading', { name: 'Nearest official places' }).waitFor();
  await findPostcode(page);
  const card = page.locator('.card', { hasText: 'Kalorama Memorial Reserve' });
  await card.getByRole('button', { name: 'Share Kalorama Memorial Reserve' }).click();
  await expect(card.getByRole('status')).toHaveText(COPIED_LINE);
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text.startsWith('Neighbourhood Safer Place\nKalorama Memorial Reserve\nRidge Road, Kalorama')).toBe(true);
  expect(text.endsWith(SHARED_PLACE_FROM)).toBe(true);
  expect(text).not.toMatch(/\d+ ?(m|km)\b/);
});

// The nearest places of last resort on a map, folded until asked for, drawn on
// the phone from files it already holds, so it opens with no signal.
test('Show on a map opens a map of the nearest places, with no signal', async ({ page, context }) => {
  await openOffline(page, context, 'cached');
  await findPostcode(page);
  const toggle = page.getByRole('button', { name: 'Show on a map' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.nearby-map')).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('img', { name: /Map of the main roads and towns/ })).toBeVisible();
  await expect(page.locator('.nearby-map .blacksky-road').first()).toBeAttached();
  await expect(page.locator('.nearby-map .area-map-mark').first()).toBeVisible();
  // The middle is where distances are measured from, named as such. A place
  // 580 m away sits over it at this size, so it is opened from the keyboard.
  await page.locator('.nearby-map .area-map-pin').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.nearby-map .area-map-label')).toHaveText('Centre of postcode 3766');
});
