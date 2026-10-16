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

/** A pack's page opened on one of its tabs, the one way every screen a pack
 *  opens returns to it. A tab the page does not know opens Area. */
export function packTab(packId: string, tab: string): string {
  return `/packs/${encodeURIComponent(packId)}?tab=${encodeURIComponent(tab)}`;
}

/** Where the drill returns, by Back or its Done: the Practice tab of the pack
 *  whose page opened it, else the Rehearse screen. */
export function drillHome(search: string): string {
  const pack = new URLSearchParams(search).get('from');
  return pack ? packTab(pack, 'practice') : '/rehearse';
}

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
  // A chosen need is a step inside Recover; the list of needs is its tab. Opened
  // from a pack's Save more, it goes back to that pack's Support tab instead.
  if (pathname === '/recover') {
    const params = new URLSearchParams(search);
    if (!params.has('need')) return null;
    const pack = params.get('from');
    return pack ? packTab(pack, 'support') : '/recover';
  }
  if (NAV_ITEMS.some((item) => item.to === pathname)) return null;
  if (pathname === '/packs/new') {
    const params = new URLSearchParams(search);
    if (params.has('step')) return builder === 'hidden' ? null : ONE_STEP;
    // Opened from an empty Rehearse or Recover tab, the search goes back to it.
    const from = params.get('from');
    if (from === 'rehearse' || from === 'recover') return `/${from}`;
  }
  // The games on the Rehearse screen go back to it, whatever is saved; the
  // drill opened from a pack's page goes back to that pack.
  if (pathname === '/rehearse/drill') return drillHome(search);
  if (GAME_PATHS.includes(pathname)) return '/rehearse';
  // A chosen condition steps back to the choice. The choice goes back where it
  // was opened from: the pack's Practice tab when its Rehearse this pack opened
  // it, else the Rehearse tab.
  if (pathname.startsWith('/rehearse/')) {
    if (runPackId !== null) return null;
    const params = new URLSearchParams(search);
    if (params.has('condition')) {
      params.delete('condition');
      const rest = params.toString();
      return rest ? `${pathname}?${rest}` : pathname;
    }
    return params.get('from') === 'pack' ? packTab(decodeURIComponent(pathname.split('/')[2]), 'practice') : '/rehearse';
  }
  // A pack's print page goes back to the pack, on the tab it was opened from,
  // when the pack page opened it, else to Home, whose pack menu opens it too.
  const print = /^\/packs\/([^/]+)\/print$/.exec(pathname);
  if (print) {
    const params = new URLSearchParams(search);
    if (params.get('from') !== 'pack') return '/';
    return packTab(decodeURIComponent(print[1]), params.get('tab') ?? 'area');
  }
  // A pack, the address search, or an address the app does not know.
  return '/';
}
