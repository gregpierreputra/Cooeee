import { expect, test } from '@playwright/test';

const ORIGIN = 'http://127.0.0.1:4174';
/** The heading is the first thing in the card, and every state has one. */
const cardHeading = (page: import('@playwright/test').Page) => page.locator('.card h2');

// E5-US1-AC4, WCAG 1.4.4 — no text is clipped or overlapped at 200%.
//
// WHAT THIS CHECKS, AND WHAT IT DOES NOT. This doubles the root font size in
// desktop Chromium at a narrow viewport. That is not iOS Dynamic Type and it is
// not the Android font-scale setting: those scale differently, apply to
// different elements, and can break lines in places this never will. The real
// check is the one in the epic's definition of done — a person reading all four
// states on a real iOS and a real Android device with text size at 200% — and
// that check is still owed. This spec exists to catch a layout regression
// between those manual passes, not to replace them.
//
// Only the two states a running app can reach are covered here, for the same
// reason as rehearsal-entry.spec.ts: sweepBuilding() clears building packs
// before first render, and the only trigger is on the pack page.

const measure = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const card = document.querySelector('.card') as HTMLElement;
    const heading = document.querySelector('.card h2') as HTMLElement;
    return {
      rootFont: getComputedStyle(document.documentElement).fontSize,
      headingFont: getComputedStyle(heading).fontSize,
      cardHeight: Math.round(card.getBoundingClientRect().height),
    };
  });

for (const mode of ['empty', 'unreadable'] as const) {
  test(`AC4 ${mode} state survives 200% text with no clipping or overlap`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(`${ORIGIN}/rehearse?mode=${mode}`);
    await cardHeading(page).waitFor();

    const before = await measure(page);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await expect
      .poll(async () => (await measure(page)).rootFont)
      .toBe('32px');
    const after = await measure(page);

    // The check has to bite before its result means anything: if the page
    // ignored the setting, everything below would pass on a page that never
    // reflowed. Both the type and the card must actually grow.
    expect(Number.parseFloat(after.headingFont)).toBeGreaterThan(
      Number.parseFloat(before.headingFont) * 1.9,
    );
    expect(after.cardHeight).toBeGreaterThan(before.cardHeight);

    const report = await page.evaluate(() => {
      const doc = document.documentElement;
      const overflowing: string[] = [];
      const clipped: string[] = [];
      document.querySelectorAll<HTMLElement>('main *').forEach((el) => {
        const box = el.getBoundingClientRect();
        if (box.right > doc.clientWidth + 1 || box.left < -1) {
          overflowing.push(`${el.tagName}.${el.className}`);
        }
        if (el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflowY === 'hidden') {
          clipped.push(`${el.tagName}.${el.className}`);
        }
      });
      // Every block in the card, top to bottom: none may intrude on the one
      // above it. The Nothing-to-rehearse detail is the longest line and
      // carries a date, so it is the one that would collide first.
      const blocks = [...document.querySelectorAll<HTMLElement>('.card h2, .card p')].map((el) => {
        const box = el.getBoundingClientRect();
        return { text: (el.textContent ?? '').slice(0, 40), top: box.top, bottom: box.bottom };
      });
      const overlaps: string[] = [];
      for (let i = 1; i < blocks.length; i += 1) {
        if (blocks[i].top < blocks[i - 1].bottom - 1) {
          overlaps.push(`${blocks[i - 1].text} / ${blocks[i].text}`);
        }
      }
      return {
        overflowing,
        clipped,
        overlaps,
        horizontalScroll: document.body.scrollWidth > doc.clientWidth + 1,
        blockCount: blocks.length,
      };
    });

    expect(report.overlaps).toEqual([]);
    expect(report.clipped).toEqual([]);
    expect(report.overflowing).toEqual([]);
    expect(report.horizontalScroll).toBe(false);
    // Every line of the state is still on the page, not silently dropped: a
    // heading and at least two paragraphs.
    expect(report.blockCount).toBeGreaterThanOrEqual(3);
    await expect(cardHeading(page)).toBeVisible();
  });
}

// WCAG 2.5.8 — every action is at least 24 by 24 CSS pixels.
test('AC4 every action meets the minimum target size', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(`${ORIGIN}/rehearse?mode=empty`);
  await cardHeading(page).waitFor();

  for (const name of ['Back to this pack', 'Build an offline pack', 'Back to Home']) {
    const box = await page.getByRole('link', { name }).boundingBox();
    expect(box, `${name} has no box`).not.toBeNull();
    expect(box!.width, `${name} width`).toBeGreaterThanOrEqual(24);
    expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(24);
  }
});

// WCAG 1.3.1 — the heading is a heading, and its detail follows it in reading
// order. What a screen reader announces is the DOM order, so that is what is
// asserted; the VoiceOver pass in the epic's definition of done still stands.
test('AC4 heading, detail and actions are in reading order', async ({ page }) => {
  await page.goto(`${ORIGIN}/rehearse?mode=empty`);

  const heading = page.getByRole('heading', { name: 'This pack holds nothing to rehearse' });
  await expect(heading).toBeVisible();
  await expect(heading).toHaveJSProperty('tagName', 'H2');

  const order = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.kicker, .card h2, .card p, .actions a')];
    return nodes.map((el) => ({ tag: el.tagName, text: el.textContent ?? '' }));
  });

  const kicker = order.findIndex((entry) => entry.text.includes('Rehearsal'));
  const head = order.findIndex((entry) => entry.tag === 'H2');
  const detail = order.findIndex((entry) => entry.text.includes('holds no designation'));
  const action = order.findIndex((entry) => entry.tag === 'A');

  // kicker · heading · detail · what would make a rehearsal possible · actions.
  expect(kicker).toBeGreaterThanOrEqual(0);
  expect(head).toBeGreaterThan(kicker);
  expect(detail).toBeGreaterThan(head);
  expect(action).toBeGreaterThan(detail);
  // Nothing sits between the kicker and the heading: the heading is the first
  // thing in the card, and no line above it repeats what it says.
  expect(head).toBe(kicker + 1);
});

// WCAG 1.4.3 — every element of both stopped states meets 4.5:1, or 3:1 where
// the type is large. Measured rather than assumed, so a change to a token, or
// to the --surface behind it, cannot take an element under without failing.
// The screen sets no colour of its own: the earlier draft's quiet opening line,
// and the --ink-2 / --ink-3 argument that went with it, are both gone.
//
// The ratios are computed and compared against the threshold rather than
// against a stored number, so a design-system change that stays above the
// minimum does not have to be transcribed here to keep this spec passing.
//
// Measured in the dark prepare mode, which is what the harness renders. The
// light theme is not covered here.
const contrastRows = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const relativeLuminance = (channels: number[]) => {
      const [r, g, b] = channels.map((value) => {
        const s = value / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const channels = (colour: string) => colour.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number);
    // The nearest ancestor that actually paints, which is what the text sits on.
    const painted = (el: HTMLElement): number[] => {
      let node: HTMLElement | null = el;
      while (node) {
        const background = getComputedStyle(node).backgroundColor;
        if (background && !background.includes('rgba(0, 0, 0, 0)')) return channels(background);
        node = node.parentElement;
      }
      return [255, 255, 255];
    };
    return [...document.querySelectorAll<HTMLElement>('.kicker, .card h2, .card p, .actions a')].map(
      (el) => {
        const style = getComputedStyle(el);
        const foreground = relativeLuminance(channels(style.color));
        const background = relativeLuminance(painted(el));
        const ratio =
          (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
        const px = Number.parseFloat(style.fontSize);
        const large = px >= 24 || (px >= 18.66 && Number(style.fontWeight) >= 700);
        return {
          text: (el.textContent ?? '').slice(0, 40),
          ratio: Math.round(ratio * 100) / 100,
          required: large ? 3 : 4.5,
        };
      },
    );
  });

for (const mode of ['empty', 'unreadable'] as const) {
  test(`AC4 ${mode} state meets the contrast minimum on every element`, async ({ page }) => {
    await page.goto(`${ORIGIN}/rehearse?mode=${mode}`);
    await cardHeading(page).waitFor();

    const rows = await contrastRows(page);
    // Kicker, heading, the details and all three actions: nothing is skipped.
    expect(rows.length).toBeGreaterThanOrEqual(6);

    const failing = rows.filter((row) => row.ratio < row.required);
    expect(failing, JSON.stringify(failing)).toEqual([]);
  });
}

// The accent means one thing across the gate: this is what would fix it. In
// 'could not be read' that is the build. In 'nothing to rehearse' nothing fixes
// it today, so no action is filled at all rather than the accent sitting on the
// one action that would not help.
test('AC4 could not be read fills the action that would fix it', async ({ page }) => {
  await page.goto(`${ORIGIN}/rehearse?mode=unreadable`);
  await cardHeading(page).waitFor();

  await expect(page.locator('.actions .main-action')).toHaveCount(1);
  await expect(page.locator('.actions .main-action')).toHaveText('Build an offline pack');
});

test('AC4 nothing to rehearse fills no action, because none of them fixes it', async ({ page }) => {
  await page.goto(`${ORIGIN}/rehearse?mode=empty`);
  await cardHeading(page).waitFor();

  await expect(page.locator('.actions .main-action')).toHaveCount(0);
  // All three are still there, and still in order: only the weight changed.
  await expect(page.locator('.actions a')).toHaveText([
    'Back to this pack',
    'Build an offline pack',
    'Back to Home',
  ]);
});
