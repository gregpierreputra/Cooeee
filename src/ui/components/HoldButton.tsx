import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { HOLD_LEAVE_MARGIN_PX, HOLD_MS, HOLD_VIBRATE_MS } from '../../core/constants';

type HoldButtonProps = {
  onHold: () => void;
  hint: string;
  children: ReactNode;
  /** More classes for the button, beside its own: where it sits sets its look. */
  className?: string;
  /** How long the completed hold's buzz lasts, where the phone can buzz. */
  vibrateMs?: number;
  /** The name read out, when the button shows a drawing rather than its words. */
  label?: string;
  /** Hides the hint again after this long. Only for a hint that floats over
   *  the screen, so taking it away moves nothing under the finger. */
  hintMs?: number;
  /** Counts up each time the screen wants `nudgeHint` said in the hint's
   *  place, as BlackSky does when Back is pressed. */
  nudge?: number;
  nudgeHint?: string;
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
export default function HoldButton({
  onHold,
  hint,
  children,
  className,
  vibrateMs = HOLD_VIBRATE_MS,
  label,
  hintMs,
  nudge = 0,
  nudgeHint,
}: HoldButtonProps) {
  // The words in the hint, and a count that goes up each time it is shown, so
  // every short tap starts its time over and its pop in plays again.
  const [shown, setShown] = useState<{ text: string; count: number } | null>(null);
  const showHint = (text: string) => setShown((was) => ({ text, count: (was?.count ?? 0) + 1 }));
  useEffect(() => {
    if (!shown || hintMs === undefined) return undefined;
    const hide = window.setTimeout(() => setShown(null), hintMs);
    return () => window.clearTimeout(hide);
  }, [shown, hintMs]);
  useEffect(() => {
    if (nudge > 0 && nudgeHint) showHint(nudgeHint);
  }, [nudge]);
  const holdTimer = useRef<number | null>(null);
  // When the hold began, and whether one is running. The fill is drawn from
  // this, not from the browser's own pressed state, so the fill and the timer
  // share one clock: a fill that is full is a hold that is done, and a hold
  // that ends early takes the fill back with it.
  const startedAt = useRef(0);
  const [holding, setHolding] = useState(false);
  // Which kind of pointer is pressing, from its pointerdown until it lifts. The
  // contextmenu event must be answered differently for a finger and a mouse,
  // and not every browser says on the event itself which one raised it.
  const pressing = useRef<string | null>(null);
  const clearHold = () => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setHolding(false);
  };

  const completeHold = () => {
    clearHold();
    if (typeof navigator.vibrate === 'function') navigator.vibrate(vibrateMs);
    onHold();
  };

  // Once shown, the hint stays until the hold completes (onHold unmounts this
  // screen). Removing it when a press starts would shift the layout UNDER the
  // active press, slide the button out from beneath the finger, and put the
  // finger outside the margin — silently cancelling the very hold the hint
  // taught.

  const startHold = () => {
    clearHold(); // a key press during a pointer hold must not start a second timer
    startedAt.current = performance.now();
    setHolding(true);
    holdTimer.current = window.setTimeout(completeHold, HOLD_MS);
  };

  // A lift ends the hold. On a busy phone the timer can run a little late, so
  // a finger lifted as the fill completes may arrive before it: by then two
  // seconds have passed, and the hold is done, not cut short.
  const releaseHold = () => {
    if (holdTimer.current === null) return;
    if (performance.now() - startedAt.current >= HOLD_MS) {
      completeHold();
      return;
    }
    clearHold();
    showHint(hint);
  };

  // The browser took the pointer, or focus went: the hold is not done by the
  // finger, so it is cut short however long it ran.
  const cancelHold = () => {
    if (holdTimer.current === null) return;
    clearHold();
    showHint(hint);
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
    if (off) cancelHold();
  };

  useEffect(() => clearHold, []);

  return (
    <>
      <button
        type="button"
        className={['blacksky-hold', className, holding ? 'holding' : null].filter(Boolean).join(' ')}
        aria-label={label}
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
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) cancelHold();
        }}
        // The browser took the pointer away (a system gesture, a call coming
        // in). touch-action: none in the stylesheet is what stops an ordinary
        // finger drift from landing here as the start of a scroll.
        onPointerCancel={() => {
          pressing.current = null;
          cancelHold();
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
          else cancelHold();
        }}
        // Tab away while Space is down and the keyup lands elsewhere.
        onBlur={cancelHold}
        onKeyDown={(e) => {
          if (e.key === ' ') e.preventDefault(); // Space must not scroll the page under a hold
          if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) startHold();
        }}
        onKeyUp={releaseHold}
      >
        {children}
      </button>
      {shown ? (
        <p key={shown.count} className="muted blacksky-hold-hint" role="status">
          {shown.text}
        </p>
      ) : null}
    </>
  );
}
