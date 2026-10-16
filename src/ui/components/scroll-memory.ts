import { SCROLL_RESTORE_WAIT_MS } from '../../core/constants';

/** Where each screen was last scrolled to, by its address, so Back lands where
 *  the person left it. Held in memory for this visit only: nothing is stored. */
const positions = new Map<string, number>();

/** The Back bar's mark on the screen it opens, as the phone's back is marked. */
export const BACK_STATE = { back: true } as const;

export const rememberScroll = (url: string, y: number) => positions.set(url, y);
export const savedScroll = (url: string): number | undefined => positions.get(url);

/** Scroll to y once the screen is tall enough, as a screen may still be
 *  reading its list from the device. Returns a cancel for a screen left early. */
export function restoreScroll(y: number): () => void {
  const started = Date.now();
  let frame = 0;
  const step = () => {
    const room = document.documentElement.scrollHeight - window.innerHeight;
    if (room >= y || Date.now() - started > SCROLL_RESTORE_WAIT_MS) window.scrollTo(0, y);
    else frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}
