// The Back control's destination for every screen. Back goes up to the screen
// above, never simply to the one visited before, which may be another tab.

import { NAV_ITEMS } from './home';

/** What Back needs to know beyond the address. `packCount` is null until the
 *  device has answered; `runPackId` is the pack of the rehearsal running now;
 *  `builder` is what the pack builder allows (see PackNew/builder-back.ts). */
export type BackContext = {
  packCount: number | null;
  runPackId: string | null;
  builder: 'step' | 'hidden';
};

/** One entry back in history: the pack builder's step before this one. */
export const ONE_STEP = -1;

/** The screen above this one, or null where Back is hidden: on a tab's own
 *  screen, in BlackSky, and on a rehearsal that the Rehearse tab would open
 *  again straight away (one pack saved, or a rehearsal running). Inside the
 *  pack builder, Back is ONE_STEP to the step before. */
export function backTarget(
  pathname: string,
  search: string,
  { packCount, runPackId, builder }: BackContext,
): string | typeof ONE_STEP | null {
  if (pathname.startsWith('/blacksky')) return null;
  // A chosen need is a step inside Recover; the list of needs is its tab.
  if (pathname === '/recover') return new URLSearchParams(search).has('need') ? '/recover' : null;
  if (NAV_ITEMS.some((item) => item.to === pathname)) return null;
  if (pathname === '/packs/new' && new URLSearchParams(search).has('step')) {
    return builder === 'hidden' ? null : ONE_STEP;
  }
  if (pathname.startsWith('/rehearse/')) {
    if (runPackId !== null || packCount === null || packCount < 2) return null;
    return '/rehearse';
  }
  // A pack, the address search, or an address the app does not know.
  return '/';
}
