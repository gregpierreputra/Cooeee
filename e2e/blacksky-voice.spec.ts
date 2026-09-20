import { expect, test, type Page } from '@playwright/test';
import { relativeBearing } from '../src/core/blacksky-dial';
import { sideOf } from '../src/core/blacksky-voice';
import { FIX_STALE_MS, VOICE_CHECK_MS, VOICE_MIN_GAP_MS } from '../src/core/constants';
import {
  HOLD_FOR_BLACKSKY,
  LEAVE_BLACKSKY,
  SPOKEN_SIDES,
  VOICE_BUTTON,
  VOICE_LONG,
  VOICE_SHORT,
  VOICE_SIGNAL_LOST,
  spokenDistance,
} from '../src/core/copy';
import { bearingDeg, cardinalPoint, distanceM, magneticDeclinationDeg } from '../src/core/geo';
import { openDial, pushPosition, stubPositions, turnPhone } from './blacksky-position';
import { acknowledgeFirstOpen } from './helpers';

// BS_Enhancement-AC3 (voice) and BS_Enhancement-AC4 (stay open), against the
// real screen in the harness. The browser's speech and wake lock are replaced
// by stand-ins that record every call, so the specs can assert exactly what was
// said and when the screen was held awake, and can end a sentence on demand.
//
// The harness in `no-pack` mode points at the nearest state-wide site, Belgrave
// Recreation Reserve; the positions below lie due south of it, so it stays the
// nearest and the distance is what the spec chooses.

declare global {
  interface Window {
    __speech: { spoken: string[]; cancels: number; voices: string[] };
    __endSpeech: () => void;
    __wake: { requests: number; releases: number };
    __setHidden: (hidden: boolean) => void;
  }
}

const BELGRAVE = { lat: -37.872, lon: 145.362 };
const southOf = (km: number) => ({ latitude: BELGRAVE.lat - km / 111.195, longitude: BELGRAVE.lon });
const SITE = 'Belgrave Recreation Reserve';

/** The short form exactly as the app must say it from `position`. */
const shortFrom = (position: { latitude: number; longitude: number }, headingDeg: number | null) => {
  const from = { lat: position.latitude, lon: position.longitude };
  const bearing = bearingDeg(from, BELGRAVE);
  const side = sideOf(headingDeg === null ? null : relativeBearing(bearing, headingDeg));
  return VOICE_SHORT(
    spokenDistance(distanceM(from, BELGRAVE)),
    cardinalPoint(bearing),
    side ? SPOKEN_SIDES[side] : null,
    false,
  );
};

type Stubs = { speech?: 'local-en-au' | 'remote-only' | 'missing'; wakeLock?: boolean };

async function stubPhone(page: Page, { speech = 'local-en-au', wakeLock = true }: Stubs = {}) {
  await page.addInitScript(
    ({ speech, wakeLock }) => {
      window.__speech = { spoken: [], cancels: 0, voices: [] };
      window.__wake = { requests: 0, releases: 0 };

      if (speech === 'missing') {
        delete (window as unknown as Record<string, unknown>).speechSynthesis;
        delete (Window.prototype as unknown as Record<string, unknown>).speechSynthesis;
      } else {
        type Spoken = { text: string; voice: { name: string } | null; onend: (() => void) | null };
        let current: Spoken | null = null;
        const voices =
          speech === 'remote-only'
            ? [{ name: 'Network English', lang: 'en-AU', localService: false }]
            : [
                { name: 'Network English', lang: 'en-AU', localService: false },
                { name: 'Local American', lang: 'en-US', localService: true },
                { name: 'Local Australian', lang: 'en_AU', localService: true },
              ];
        Object.defineProperty(window, 'SpeechSynthesisUtterance', {
          value: class {
            voice = null;
            lang = '';
            onend = null;
            onerror = null;
            constructor(public text: string) {}
          },
        });
        Object.defineProperty(window, 'speechSynthesis', {
          value: {
            getVoices: () => voices,
            speak: (utterance: Spoken) => {
              current = utterance;
              window.__speech.spoken.push(utterance.text);
              window.__speech.voices.push(utterance.voice?.name ?? '');
            },
            cancel: () => {
              window.__speech.cancels += 1;
              current = null;
            },
            addEventListener: () => {},
            removeEventListener: () => {},
          },
        });
        window.__endSpeech = () => {
          const ended = current;
          current = null;
          ended?.onend?.();
        };
      }

      if (wakeLock) {
        Object.defineProperty(Navigator.prototype, 'wakeLock', {
          value: {
            request: async () => {
              window.__wake.requests += 1;
              return {
                release: async () => {
                  window.__wake.releases += 1;
                },
              };
            },
          },
        });
      } else {
        delete (Navigator.prototype as unknown as Record<string, unknown>).wakeLock;
      }

      // Pressing Home and coming back, as the page sees it.
      let hidden = false;
      Object.defineProperty(document, 'hidden', { get: () => hidden });
      window.__setHidden = (next) => {
        hidden = next;
        document.dispatchEvent(new Event('visibilitychange'));
      };
    },
    { speech, wakeLock },
  );
}

/** Stop the page's clock, so only the spec moves time: the minimum gap and the
 *  stale limit are then exact, however slowly the machine runs the spec. */
const pauseClock = (page: Page) => page.clock.pauseAt(Date.now() + 2_000);

const speaker = (page: Page) => page.getByRole('button', { name: VOICE_BUTTON });
const caption = (page: Page) => page.locator('.blacksky-caption');
const spoken = (page: Page) => page.evaluate(() => window.__speech.spoken);
const wake = (page: Page) => page.evaluate(() => window.__wake);
const held = async (page: Page) => {
  const { requests, releases } = await wake(page);
  return requests - releases;
};

test('Empty then Normal: nothing is spoken before the tap; the tap speaks the long form, captioned', async ({
  page,
}) => {
  await stubPhone(page);
  await openDial(page, 'no-pack');
  const here = southOf(5.5);
  await pushPosition(page, here);
  await turnPhone(page, 270); // facing east, so the place has a side
  await expect(page.getByText('North up', { exact: true })).toBeHidden();

  // Voice off: the button is outlined, 44 px or more, and nothing has been said.
  await expect(speaker(page)).toHaveAttribute('aria-pressed', 'false');
  const box = (await speaker(page).boundingBox())!;
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  expect(await speaker(page).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
    'rgba(0, 0, 0, 0)',
  );
  await page.waitForTimeout(2 * VOICE_CHECK_MS);
  expect(await spoken(page)).toEqual([]);

  // A compass reading counts for three seconds, so a fresh one before the tap.
  await turnPhone(page, 270);
  await speaker(page).click();
  const heading = 90 + magneticDeclinationDeg(BELGRAVE);
  const long = VOICE_LONG(SITE, shortFrom(here, heading));
  // The place is due north and the person faces east: it is on their left.
  expect(long).toBe(`${SITE}, place of last resort. 5.5 kilometres. North. On your left.`);
  expect(await spoken(page)).toEqual([long]);
  // A voice that lives on the phone, Australian before any other English.
  expect(await page.evaluate(() => window.__speech.voices)).toEqual(['Local Australian']);

  // Filled when on, and the caption carries exactly the words being spoken.
  await expect(speaker(page)).toHaveAttribute('aria-pressed', 'true');
  expect(await speaker(page).evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
    'rgba(0, 0, 0, 0)',
  );
  await expect(caption(page)).toHaveText(long);
  expect(await caption(page).evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);

  // The caption clears when the sentence ends; voice stays on.
  await page.evaluate(() => window.__endSpeech());
  await expect(caption(page)).toHaveCount(0);
  await expect(speaker(page)).toHaveAttribute('aria-pressed', 'true');

  // Still, and nothing has changed: nothing more is said.
  await page.waitForTimeout(3 * VOICE_CHECK_MS);
  expect(await spoken(page)).toEqual([long]);
});

// The speaker button sits at the right-hand end of the distance row, not in the
// dial. 360 px wide with "12.3 km" and "NE" is the tightest that row gets.
test('at 360 px the speaker button sits on the distance row and overlaps nothing', async ({ page }) => {
  await stubPhone(page);
  await openDial(page, 'no-pack');
  await page.setViewportSize({ width: 360, height: 800 });
  await pushPosition(page, { latitude: -37.95024, longitude: 145.26284 });
  await expect(page.locator('.blacksky-figure-main')).toHaveText('12.3 km');
  await expect(page.locator('.blacksky-figure-point')).toHaveText('NE');

  const layout = await page.locator('.blacksky-dial-figures').evaluate((row) => {
    const box = (selector: string) => row.querySelector(selector)!.getBoundingClientRect();
    const words = document.createRange();
    words.selectNodeContents(row.querySelector('.blacksky-dial-readout')!);
    const [rowBox, figure, beside, button] = [row.getBoundingClientRect(), box('.blacksky-figure-main'), box('.blacksky-dial-beside'), box('.blacksky-speaker')];
    return {
      onTheRow: button.top >= rowBox.top - 0.5 && button.bottom <= rowBox.bottom + 0.5,
      atTheEnd: Math.abs(button.right - rowBox.right) <= 1,
      clearOfFigure: button.left >= figure.right,
      clearOfPointAndAccuracy: button.left >= Math.max(beside.right, words.getBoundingClientRect().right),
      size: Math.min(button.width, button.height),
      insideTheDial: row.closest('.blacksky-dial-frame') !== null,
      rowOverflows: row.scrollWidth > row.clientWidth,
    };
  });
  expect(layout).toEqual({
    onTheRow: true,
    atTheEnd: true,
    clearOfFigure: true,
    clearOfPointAndAccuracy: true,
    size: 48,
    insideTheDial: false,
    rowOverflows: false,
  });
  await expect(page.locator('.blacksky-dial-frame .blacksky-speaker')).toHaveCount(0);

  // It still speaks, and the spoken compass point is the full word, not "NE".
  await speaker(page).click();
  expect((await spoken(page))[0]).toBe(`${SITE}, place of last resort. 12.3 kilometres. North-east.`);
});

test('passing 5 km speaks the short form once, and nothing in between', async ({ page }) => {
  await stubPhone(page);
  await page.clock.install();
  await openDial(page, 'no-pack');
  await pushPosition(page, southOf(5.5));
  await pauseClock(page);
  await speaker(page).click();
  const long = VOICE_LONG(SITE, shortFrom(southOf(5.5), null));
  expect(long).toBe(`${SITE}, place of last resort. 5.5 kilometres. North.`);
  expect(await spoken(page)).toEqual([long]);
  await page.evaluate(() => window.__endSpeech());

  // Past the milestone, but inside the minimum gap: held back.
  await pushPosition(page, southOf(4.9));
  await expect(page.locator('.blacksky-figure-main')).toHaveText('4.90 km');
  await page.clock.fastForward(VOICE_MIN_GAP_MS - 2 * VOICE_CHECK_MS);
  expect(await spoken(page)).toEqual([long]);

  // The gap is over: one short message, captioned with the same words.
  await page.clock.fastForward(3 * VOICE_CHECK_MS);
  const short = shortFrom(southOf(4.9), null);
  expect(short).toBe('4.9 kilometres. North.');
  expect(await spoken(page)).toEqual([long, short]);
  await expect(caption(page)).toHaveText(short);
  await page.evaluate(() => window.__endSpeech());

  // Closer, with no milestone passed: nothing in between.
  await pushPosition(page, southOf(4.5));
  await page.clock.fastForward(2 * VOICE_MIN_GAP_MS);
  expect(await spoken(page)).toEqual([long, short]);
});

test('a second tap stops the sentence and turns repeating off', async ({ page }) => {
  await stubPhone(page);
  await page.clock.install();
  await openDial(page, 'no-pack');
  await pushPosition(page, southOf(5.5));
  await pauseClock(page);
  await speaker(page).click();
  await expect(caption(page)).toBeVisible();
  const cancelsBefore = await page.evaluate(() => window.__speech.cancels);

  await speaker(page).click();
  expect(await page.evaluate(() => window.__speech.cancels)).toBe(cancelsBefore + 1);
  await expect(caption(page)).toHaveCount(0);
  await expect(speaker(page)).toHaveAttribute('aria-pressed', 'false');

  // Off means off: a milestone passed after that is not spoken.
  await pushPosition(page, southOf(4.9));
  await page.clock.fastForward(2 * VOICE_MIN_GAP_MS);
  expect(await spoken(page)).toHaveLength(1);
});

test('Unavailable: with no speech on the phone the button is not shown', async ({ page }) => {
  await stubPhone(page, { speech: 'missing' });
  await openDial(page, 'no-pack');
  await pushPosition(page, southOf(5.5));
  await expect(page.locator('.blacksky-dial')).toBeVisible();
  await expect(speaker(page)).toHaveCount(0);

  // A voice that needs the network is no voice in BlackSky.
  const offline = await page.context().newPage();
  await stubPhone(offline, { speech: 'remote-only' });
  await openDial(offline, 'no-pack');
  await pushPosition(offline, southOf(5.5));
  await expect(offline.locator('.blacksky-dial')).toBeVisible();
  await expect(speaker(offline)).toHaveCount(0);
});

test('the screen is kept awake with voice on or while moving, and let go when still and silent', async ({
  page,
}) => {
  await stubPhone(page);
  await openDial(page, 'no-pack');
  await pushPosition(page, { ...southOf(5.5), speed: 0 });
  await expect(page.locator('.blacksky-dial')).toBeVisible();
  // Still and silent: the phone sleeps on its own timer.
  expect(await wake(page)).toEqual({ requests: 0, releases: 0 });

  await speaker(page).click();
  await expect.poll(() => held(page)).toBe(1);
  await speaker(page).click();
  await expect.poll(() => held(page)).toBe(0);

  // Moving, voice off: awake. Each position is a real move, so it shows at once.
  await pushPosition(page, { ...southOf(5.49), speed: 1.4, heading: 0 });
  await expect.poll(() => held(page)).toBe(1);
  await pushPosition(page, { ...southOf(5.48), speed: 0 });
  await expect.poll(() => held(page)).toBe(0);
  expect(await wake(page)).toEqual({ requests: 2, releases: 2 });
});

test('a phone with no wake lock behaves as before, with nothing said about it', async ({ page }) => {
  await stubPhone(page, { wakeLock: false });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openDial(page, 'no-pack');
  await pushPosition(page, southOf(5.5));
  await speaker(page).click();
  await expect(speaker(page)).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('coming back after two minutes with no fix shows the bar at once, says so, and holds the screen again', async ({
  page,
}) => {
  await stubPhone(page);
  await page.clock.install();
  await openDial(page, 'no-pack');
  await pushPosition(page, southOf(5.5));
  await pauseClock(page);
  await speaker(page).click();
  await page.evaluate(() => window.__endSpeech());
  await expect.poll(() => wake(page)).toEqual({ requests: 1, releases: 0 });

  // Home is pressed mid-sentence or not: anything being said stops.
  const cancelsBefore = await page.evaluate(() => window.__speech.cancels);
  await page.evaluate(() => window.__setHidden(true));
  expect(await page.evaluate(() => window.__speech.cancels)).toBe(cancelsBefore + 1);
  await page.clock.fastForward(120_000);
  expect(await spoken(page)).toHaveLength(1); // nothing is said to a hidden page
  expect(120_000).toBeGreaterThan(FIX_STALE_MS);

  // Back: recomputed at once, before any tick. The position is two minutes
  // old, so the bar is up, and no question or notice stands in the way.
  await page.evaluate(() => window.__setHidden(false));
  await expect(page.getByText('GPS signal lost', { exact: true })).toBeVisible();
  await expect(page.locator('.blacksky-bar')).toContainText('last position 2 min ago');
  // The wake lock the browser dropped while hidden is asked for again.
  await expect.poll(async () => (await wake(page)).requests).toBe(2);

  // With voice on, the state is spoken once.
  await page.clock.fastForward(VOICE_CHECK_MS);
  expect((await spoken(page)).slice(1)).toEqual([VOICE_SIGNAL_LOST]);
  expect(VOICE_SIGNAL_LOST).toBe('GPS signal lost.');
  await page.clock.fastForward(2 * VOICE_MIN_GAP_MS);
  expect(await spoken(page)).toHaveLength(2);
});

test('coming back with a fix shows fresh figures and says the current distance once', async ({ page }) => {
  await stubPhone(page);
  await page.clock.install();
  await openDial(page, 'no-pack');
  await pushPosition(page, southOf(5.5));
  await pauseClock(page);
  await speaker(page).click();
  await page.evaluate(() => window.__endSpeech());

  await page.evaluate(() => window.__setHidden(true));
  await page.clock.fastForward(120_000);
  // The watch is started fresh on return, and the phone answers it.
  await page.evaluate((position) => {
    window.__setHidden(false);
    window.__pushPosition(position);
  }, southOf(5.3));
  await expect(page.locator('.blacksky-figure-main')).toHaveText('5.30 km');
  await expect(page.getByText('GPS signal lost', { exact: true })).toBeHidden();

  await page.clock.fastForward(VOICE_CHECK_MS);
  const short = shortFrom(southOf(5.3), null);
  expect(short).toBe('5.3 kilometres. North.');
  expect((await spoken(page)).slice(1)).toEqual([short]);
  await page.clock.fastForward(2 * VOICE_MIN_GAP_MS);
  expect(await spoken(page)).toHaveLength(2);
});

// Against the real bundle: the harness keeps the screen mounted whatever the
// route, and this is about what leaving does. Entry and exit are the real
// two-second holds, as in blacksky-history.spec.ts.
test('Leave BlackSky lets the screen go and stops the voice', async ({ page }) => {
  const hold = async (name: string, url: string) => {
    const button = page.getByRole('button', { name });
    await button.scrollIntoViewIfNeeded(); // the no-pack screen runs past one desktop viewport
    const box = (await button.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(page).toHaveURL(url, { timeout: 5_000 });
    await page.mouse.up();
  };
  await stubPhone(page);
  await stubPositions(page);
  await acknowledgeFirstOpen(page);
  await page.goto('/');
  await page.waitForTimeout(1_000); // the site list is copied into IndexedDB on app start
  await hold(HOLD_FOR_BLACKSKY, '/blacksky');
  await pushPosition(page, southOf(5.5));

  await speaker(page).click();
  await expect(speaker(page)).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => held(page)).toBe(1);
  const cancelsBefore = await page.evaluate(() => window.__speech.cancels);

  await hold(LEAVE_BLACKSKY, '/');
  await expect.poll(() => held(page)).toBe(0);
  expect(await page.evaluate(() => window.__speech.cancels)).toBeGreaterThan(cancelsBefore);
});
