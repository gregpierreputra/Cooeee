import { useEffect, useRef } from 'react';

/** Point the reader at an information panel that has just opened. The panel is
 *  brought into view if it is not already there, and given focus, so a screen
 *  reader announces it and the next Tab continues from inside it. A panel
 *  already on screen is not scrolled, so nothing moves under the finger that
 *  just tapped. The panel's own scroll-margin keeps it clear of the fixed
 *  header and bottom bar.
 *
 *  Reduced motion jumps instead of gliding. The check is in JavaScript because
 *  a behavior option passed here overrides the stylesheet's media rule. */
export function useRevealedPanel<T extends HTMLElement>(open: boolean) {
  const panel = useRef<T>(null);

  useEffect(() => {
    if (!open || !panel.current) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    panel.current.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
    panel.current.focus({ preventScroll: true });
  }, [open]);

  return panel;
}
