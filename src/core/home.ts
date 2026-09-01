// E1-US2-AC6 — the decisions behind the returning-user home screen and the
// fixed header. Everything here is pure: the screen renders what these
// functions return and decides nothing of its own.

import { MS_PER_DAY, PACK_REFRESH_DAYS } from './constants';
import * as copy from './copy';
import { freshness } from './pack';
import { savedAgeDays } from './provenance';
import type { Pack } from './types';

/** What the right-hand side of the header reports.
 *
 *  Three states and no fourth: inside the refresh window it states the age in
 *  days, past the window it carries the label, and with no pack it says
 *  nothing at all. Nothing here judges whether the pack is still good to use,
 *  and no state disables anything. */
export type HeaderAge =
  | { kind: 'none' }
  | { kind: 'checked'; days: number; text: string }
  | { kind: 'not-recently-verified'; days: number; text: string };

/** The header reports the OLDEST complete pack. Iteration 1 stores exactly one,
 *  so this is the same pack the screen shows; if a later epic ever allows a
 *  second, the oldest is the honest figure to report rather than the newest. */
export function oldestPack(packs: Pack[]): Pack | null {
  return packs.reduce<Pack | null>(
    (oldest, pack) => (oldest === null || pack.verifiedAt < oldest.verifiedAt ? pack : oldest),
    null,
  );
}

/** The window is inclusive, exactly as core/pack.ts freshness() reads it: day 30
 *  is still 'Checked 30 days ago', and the label starts on day 31. The day
 *  arithmetic is savedAgeDays(), shared with the pack card — only the wording
 *  differs, deliberately. */
export function headerAge(now: number, verifiedAt: number | null): HeaderAge {
  if (verifiedAt === null) return { kind: 'none' };
  const days = savedAgeDays(now, verifiedAt);
  return days > PACK_REFRESH_DAYS
    ? { kind: 'not-recently-verified', days, text: copy.NOT_RECENTLY_VERIFIED_LABEL }
    : { kind: 'checked', days, text: copy.CHECKED_DAYS_AGO(days) };
}

/** Which preparation line is shown, from a seed the screen captures once.
 *
 *  Whole days since the epoch, so the choice is the same for every mount on the
 *  same day: navigating away and back cannot reshuffle it, and no random source
 *  makes the screen untestable. Written to survive a seed before 1970 rather
 *  than return a negative index. */
export function preparationLineIndex(seed: number, count: number): number {
  return (((Math.floor(seed / MS_PER_DAY) % count) + count) % count);
}

type PreparationLine = { text: string; source: string };

export function preparationLine(seed: number): PreparationLine {
  return {
    text: copy.PREPARATION_LINES[preparationLineIndex(seed, copy.PREPARATION_LINES.length)],
    source: copy.PREPARATION_SOURCE,
  };
}

export type NavItem = { key: 'home' | 'pack'; label: string; to: string };

/** The bottom navigation. Two destinations, both of which exist in Iteration 1;
 *  nothing here is invented for a later epic. BlackSky is deliberately absent —
 *  it is entered by a deliberate hold, never by a tab. */
export function navItems(packId: string | null): NavItem[] {
  return [
    { key: 'home', label: copy.NAV_HOME, to: '/' },
    packId === null
      ? { key: 'pack', label: copy.BUILD_A_PACK, to: '/packs/new' }
      : { key: 'pack', label: copy.NAV_MY_PACK, to: `/packs/${packId}` },
  ];
}

/** Everything the home screen renders, decided in one place.
 *
 *  One pack or none — the Open-or-Build rule. The screen offers to build only
 *  when there is nothing saved, so this screen can never be the way a second
 *  complete pack comes to exist. */
export type HomeView =
  | { kind: 'no-pack'; preparation: PreparationLine; nav: NavItem[] }
  | {
      kind: 'pack';
      pack: Pack;
      ageLine: string;
      preparation: PreparationLine;
      nav: NavItem[];
    };

export function homeView(now: number, packs: Pack[]): HomeView {
  const pack = oldestPack(packs);
  const preparation = preparationLine(now);
  const nav = navItems(pack?.id ?? null);
  if (pack === null) return { kind: 'no-pack', preparation, nav };
  return {
    kind: 'pack',
    pack,
    // The pack card's own wording, unchanged: 'Saved N days ago', and past the
    // window the mandated 'Saved N days ago — not recently verified'.
    ageLine: freshness(now, pack.verifiedAt).label,
    preparation,
    nav,
  };
}

/** Title-cases a stored string FOR DISPLAY ONLY.
 *
 *  What is STORED is never touched: the pack keeps the string it was saved
 *  with, so nothing downstream ever compares against a value this function
 *  invented. Digits and postcodes pass through unchanged; a letter after a
 *  space, a hyphen or a slash leads its word. An apostrophe leads a word only
 *  behind a single letter — "O'Hara", never a possessive turned "Mum'S". */
export function titleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(
      /(^|[\s\-/])([a-z])/g,
      (_m, lead: string, letter: string) => lead + letter.toUpperCase(),
    )
    .replace(
      /(^|[\s\-/])([A-Za-z])'([a-z])/g,
      (_m, lead: string, first: string, letter: string) =>
        `${lead}${first}'${letter.toUpperCase()}`,
    );
}
