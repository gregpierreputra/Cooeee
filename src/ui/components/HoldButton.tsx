import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { HOLD_LEAVE_MARGIN_PX, HOLD_MS } from '../../core/constants';

type HoldButtonProps = {
  onHold: () => void;
  hint: string;
  children: ReactNode;
};

/** A mode switch fires on a HOLD, not a tap: a pocket press must not flip the
 *  phone into or out of an emergency screen. The timer lives in a ref, and any
 *  release or exit before HOLD_MS cancels it. A cut-short press earns only the
 *  small "hold" hint. A completed hold gets a confirmation buzz where the
 *  device supports one (iOS does not — there, the pressed colour fill is the
 *  cue) and then runs onHold.
 *
 *  "Exit" means the pointer is clearly off the button, not that it moved. A
 *  mouse sits still for two seconds; a finger does not. It rolls and drifts by
 *  several pixels, and a long press makes a phone raise its context menu. The
 *  first version cancelled on all of that, so on a real phone the hold started
 *  and never finished. Three things make it hold under a finger:
 *   1 the stylesheet sets touch-action: none, so the browser cannot take the
 *     drift for the start of a scroll and cancel the pointer;
 *   2 the pointer is captured, and movement only cancels once the pointer is
 *     outside the button's box by more than HOLD_LEAVE_MARGIN_PX;
 *   3 a touch or pen long-press menu is refused and does not end the hold.
 *  A pocket press is still kept out: it takes two unbroken seconds on the
 *  button, and lifting, sliding off or the browser cancelling all end it. */
export default function HoldButton({ onHold, hint, children }: HoldButtonProps) {
  const [showHint, setShowHint] = useState(false);
  const holdTimer = useRef<number | null>(null);
  // Which kind of pointer is pressing, from its pointerdown until it lifts. The
  // contextmenu event must be answered differently for a finger and a mouse,
  // and not every browser says on the event itself which one raised it.
  const pressing = useRef<string | null>(null);
  const clearHold = () => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  // Once shown, the hint stays until the hold completes (onHold unmounts this
  // screen). Removing it when a press starts would shift the layout UNDER the
  // active press, slide the button out from beneath the finger, and put the
  // finger outside the margin — silently cancelling the very hold the hint
  // taught.

  const startHold = () => {
    clearHold(); // a key press during a pointer hold must not start a second timer
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      if ('vibrate' in navigator) navigator.vibrate(100);
      onHold();
    }, HOLD_MS);
  };

  const releaseHold = () => {
    if (holdTimer.current !== null) {
      clearHold();
      setShowHint(true);
    }
  };

  // The pointer has moved. With the pointer captured every move is delivered
  // here wherever the finger goes, so the question is asked of the button's box
  // as it is NOW (the hint above can move it): still within the margin, or off?
  const followPointer = (e: PointerEvent<HTMLButtonElement>) => {
    if (holdTimer.current === null) return;
    const box = e.currentTarget.getBoundingClientRect();
    const off =
      e.clientX < box.left - HOLD_LEAVE_MARGIN_PX ||
      e.clientX > box.right + HOLD_LEAVE_MARGIN_PX ||
      e.clientY < box.top - HOLD_LEAVE_MARGIN_PX ||
      e.clientY > box.bottom + HOLD_LEAVE_MARGIN_PX;
    if (off) releaseHold();
  };

  useEffect(() => clearHold, []);

  return (
    <>
      <button
        type="button"
        className="blacksky-hold"
        // Only the main button holds. A right click opens a menu that swallows
        // the pointerup, and the timer would then enter BlackSky with no hold.
        onPointerDown={(e) => {
          pressing.current = e.pointerType;
          if (e.button !== 0) return;
          // Capture: from here every move and the lift come to this button,
          // even with the finger past its edge, so the margin can be judged
          // and the hold can always be ended. Refused only for a pointer that
          // is already gone, and then the leave fallback below applies.
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // nothing to do: see onPointerLeave
          }
          startHold();
        }}
        onPointerMove={followPointer}
        onPointerUp={() => {
          pressing.current = null;
          releaseHold();
        }}
        // A captured pointer does not "leave" until it lifts; its moves are
        // judged against the margin above. Without capture the moves stop
        // arriving at the edge, so there leaving the box has to end the hold,
        // or it would run on with the pointer somewhere else.
        onPointerLeave={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) releaseHold();
        }}
        // The browser took the pointer away (a system gesture, a call coming
        // in). touch-action: none in the stylesheet is what stops an ordinary
        // finger drift from landing here as the start of a scroll.
        onPointerCancel={() => {
          pressing.current = null;
          releaseHold();
        }}
        // A long press is exactly what this control asks for, and on a phone a
        // long press also raises the context menu, about half a second in. For
        // a finger or a pen the menu is refused and the hold goes on: nothing
        // here has a menu worth opening. For a mouse the menu means a right
        // click, which opens a menu that swallows the pointerup, so the hold
        // ends, as it always did: a right click must never enter BlackSky.
        onContextMenu={(e) => {
          const type = (e.nativeEvent as globalThis.PointerEvent).pointerType || pressing.current;
          if (type === 'touch' || type === 'pen') e.preventDefault();
          else releaseHold();
        }}
        // Tab away while Space is down and the keyup lands elsewhere.
        onBlur={releaseHold}
        onKeyDown={(e) => {
          if (e.key === ' ') e.preventDefault(); // Space must not scroll the page under a hold
          if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) startHold();
        }}
        onKeyUp={releaseHold}
      >
        {children}
      </button>
      {showHint ? (
        <p className="muted blacksky-hold-hint" role="status">
          {hint}
        </p>
      ) : null}
    </>
  );
}
