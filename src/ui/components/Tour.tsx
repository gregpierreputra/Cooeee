import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import * as copy from '../../core/copy';

export const TOUR_EVENT = 'cooeee:tour';

// Latched as well as dispatched, like the update banner in app.tsx: the
// acknowledgement asks for the tour before the routed tree, and with it this
// component, exists. The ring on the home screen asks while it is mounted.
let pending = false;
export function startTour() {
  pending = true;
  window.dispatchEvent(new Event(TOUR_EVENT));
}

const STEPS = copy.TOUR_STEPS;
const PAD = 8; // px of breathing room around the spotlit feature
const TRIES = 30; // a screen has 3 s to render its target before the card shows alone
const CHROME = 112; // px of notice, header and back bar fixed above the page

/** The guided tour: one overlay that greys the screen, surrounds one feature
 *  at a time and explains it, across every screen. A stop whose screen is not
 *  open first moves there, then waits for its target to render. The grey never
 *  lifts between stops, and the page beneath still scrolls with the box
 *  following, so a feature taller than the room beside the card can be brought
 *  into the clear. The tour keeps nothing in storage: it starts only from a
 *  fresh acknowledgement or the ring, and a reload simply ends it. It never
 *  visits BlackSky. */
export default function Tour() {
  const [step, setStep] = useState<number | null>(() => {
    const start = pending;
    pending = false;
    return start ? 0 : null;
  });
  const [rect, setRect] = useState<DOMRect | null>(null);
  // Which edge the card sits on, decided once per stop: the far side from the feature.
  const [side, setSide] = useState<'bottom' | 'top'>('bottom');
  const card = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const onStart = () => {
      pending = false;
      setStep(0);
    };
    window.addEventListener(TOUR_EVENT, onStart);
    return () => window.removeEventListener(TOUR_EVENT, onStart);
  }, []);

  // Each stop: go to its screen, then find and measure its target, before the
  // browser paints, so the box is never a frame behind. Replace rather than
  // push, so the tour leaves no history entries behind it.
  useLayoutEffect(() => {
    if (step === null) return;
    // BlackSky is entered by a hold the overlay cannot stop from a keyboard,
    // and its latch would bounce every hop back: the tour simply ends there.
    if (pathname.startsWith('/blacksky')) {
      setStep(null);
      return;
    }
    const { path, target } = STEPS[step];
    if (pathname !== path) {
      setRect(null); // the layer itself dims the new screen until its target is found
      navigate(path, { replace: true });
      return;
    }
    // The first sighting picks the card's side and scrolls the feature to the
    // other one; later sightings (scroll, resize) only move the box.
    let placed = false;
    const measure = () => {
      const found = document.querySelectorAll(target);
      if (found.length === 0) return false;
      if (!placed) {
        placed = true;
        const box = union(found);
        const atBottom = box.top + box.height / 2 <= window.innerHeight / 2;
        setSide(atBottom ? 'bottom' : 'top');
        found[0].scrollIntoView({ block: atBottom ? 'start' : 'end' });
        if (atBottom) window.scrollBy(0, -CHROME);
        card.current?.focus();
      }
      setRect(union(found));
      return true;
    };
    let tries = 0;
    const timer = measure()
      ? 0
      : window.setInterval(() => {
          tries += 1;
          if (measure() || tries === TRIES) window.clearInterval(timer);
        }, 100);
    const follow = () => void measure();
    window.addEventListener('resize', follow);
    window.addEventListener('scroll', follow, { passive: true });
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', follow);
      window.removeEventListener('scroll', follow);
    };
  }, [step, pathname]);

  const end = () => {
    setStep(null);
    navigate('/', { replace: true });
  };

  // Focus must not wander onto the greyed controls, and Escape is one more
  // way to skip.
  useEffect(() => {
    if (step === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') end();
    };
    const onFocus = (event: FocusEvent) => {
      if (!card.current?.contains(event.target as Node)) card.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocus);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocus);
    };
  }, [step]);

  if (step === null || pathname.startsWith('/blacksky')) return null;

  const { title, lines } = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div className={rect ? 'tour' : 'tour tour-dim'}>
      {rect ? (
        <div
          className="tour-spot"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + 2 * PAD,
            height: rect.height + 2 * PAD,
          }}
        />
      ) : null}
      <section
        ref={card}
        tabIndex={-1}
        className={side === 'top' ? 'card tour-card tour-card-top' : 'card tour-card'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
      >
        <div className="tour-head">
          <span className="kicker">{copy.TOUR_KICKER}</span>
          <span className="figure">
            {step + 1}/{STEPS.length}
          </span>
        </div>
        <h2 id="tour-title">{title}</h2>
        <ul className="info-lines">
          {lines.map((text, i) => (
            <li key={copy.TOUR_LEADS[i]}>
              <b>{copy.TOUR_LEADS[i]}</b> {text}
            </li>
          ))}
        </ul>
        <div className="tour-actions">
          <button type="button" disabled={step === 0} onClick={() => setStep(step - 1)}>
            {copy.TOUR_BACK}
          </button>
          <button
            type="button"
            className="main-action"
            onClick={() => (last ? end() : setStep(step + 1))}
          >
            {last ? copy.TOUR_FINISH : copy.TOUR_NEXT}
          </button>
          <button type="button" onClick={end}>
            {copy.SKIP_TOUR}
          </button>
        </div>
      </section>
    </div>
  );
}

/** The smallest box around every matched element, in viewport coordinates. */
function union(nodes: NodeListOf<Element>): DOMRect {
  const boxes = Array.from(nodes, (node) => node.getBoundingClientRect());
  const left = Math.min(...boxes.map((box) => box.left));
  const top = Math.min(...boxes.map((box) => box.top));
  const right = Math.max(...boxes.map((box) => box.right));
  const bottom = Math.max(...boxes.map((box) => box.bottom));
  return new DOMRect(left, top, right - left, bottom - top);
}
