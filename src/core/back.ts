// The Back control's destination for every screen. Back goes up to the screen
// above, never simply to the one visited before, which may be another tab.

import { NAV_ITEMS } from './home';

/** What Back needs to know beyond the address. `runPackId` is the pack of the
 *  rehearsal running now; `builder` is what the pack builder allows (see
 *  PackNew/builder-back.ts). */
export type BackContext = {
  runPackId: string | null;
  builder: 'step' | 'hidden';
};

/** The games played from the Rehearse screen, each a screen of its own. */
export const GAME_PATHS = ['/rehearse/drill', '/rehearse/word', '/rehearse/block'];

/** One entry back in history: the pack builder's step before this one. */
export const ONE_STEP = -1;

/** The screen above this one, or null where Back is hidden: on a tab's own
 *  screen, in BlackSky, and on a running rehearsal, which the Rehearse tab
 *  would open again straight away. Inside the
 *  pack builder, Back is ONE_STEP to the step before. */
export function backTarget(
  pathname: string,
  search: string,
  { runPackId, builder }: BackContext,
): string | typeof ONE_STEP | null {
  if (pathname.startsWith('/blacksky')) return null;
  // A chosen need is a step inside Recover; the list of needs is its tab.
  if (pathname === '/recover') return new URLSearchParams(search).has('need') ? '/recover' : null;
  if (NAV_ITEMS.some((item) => item.to === pathname)) return null;
  if (pathname === '/packs/new' && new URLSearchParams(search).has('step')) {
    return builder === 'hidden' ? null : ONE_STEP;
  }
  // The games on the Rehearse screen go back to it, whatever is saved.
  if (GAME_PATHS.includes(pathname)) return '/rehearse';
  // A chosen condition steps back to the choice. The choice goes back where it
  // was opened from: the pack page when its own Rehearse this pack opened it,
  // else the Rehearse tab.
  if (pathname.startsWith('/rehearse/')) {
    if (runPackId !== null) return null;
    const params = new URLSearchParams(search);
    if (params.has('condition')) {
      params.delete('condition');
      const rest = params.toString();
      return rest ? `${pathname}?${rest}` : pathname;
    }
    return params.get('from') === 'pack' ? `/packs/${pathname.split('/')[2]}` : '/rehearse';
  }
  // A pack, the address search, or an address the app does not know.
  return '/';
}
