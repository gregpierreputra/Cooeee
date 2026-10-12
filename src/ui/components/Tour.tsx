import { useEffect, useLayoutEffect, useRef, useState, type SyntheticEvent } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router';
import * as copy from '../../core/copy';
import Glyph from './Glyph';
import KeyTerms from './KeyTerms';
import Mark from './Mark';

export const TOUR_EVENT = 'cooeee:tour';

// Latched as well as dispatched, like the update banner in app.tsx: the
// acknowledgement asks for the tour before the routed tree, and with it this
// component, exists. The ring in the header asks while it is mounted.
let pending = false;
export function startTour() {
  pending = true;
  window.dispatchEvent(new Event(TOUR_EVENT));
}

const STEPS = copy.TOUR_STEPS;
/** The welcome comes first, then one stop per feature. */
const TOTAL = STEPS.length + 1;
const PAD = 8; // px of breathing room around the spotlit feature
// The tab a screen's stop also rings fills the bar to its foot, so its ring
// stands a little wider than the tab and a little inside it top and bottom.
const TAB_PAD_X = 6;
const TAB_PAD_Y = -4;
const GAP = 12; // px between the bars above and the feature brought into view
const TRIES = 30; // a screen has 3 s to render its target before the panel shows alone

/** The guided tour: one overlay that greys the screen and surrounds one feature
 *  at a time, explained in a panel docked at the bottom, just above the tab
 *  bar. The panel never moves, and its Back, count and Next sit in one fixed
 *  row, so nothing jumps from stop to stop. Each feature is brought into the
 *  clear space between the bars at the top and the panel, never under either.
 *  It opens on a welcome that says what Cooeee is. A stop whose screen is not
 *  open first moves there, then waits for its target. The tour keeps nothing in
 *  storage: it starts only from a fresh acknowledgement or the ring, and a
 *  reload simply ends it. It never visits BlackSky. */
export default function Tour() {
  const [step, setStep] = useState<number | null>(() => {
    const start = pending;
    pending = false;
    return start ? 0 : null;
  });
  const [rect, setRect] = useState<DOMRect | null>(null);
  // The tab in the bottom bar that opens the stop's screen, when it has one.
  const [tabRect, setTabRect] = useState<DOMRect | null>(null);
  const panel = useRef<HTMLElement>(null);
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

  // While the tour runs, every page gets room at its foot, so even its last
  // feature can be scrolled clear of the panel.
  useEffect(() => {
    document.body.classList.toggle('touring', step !== null);
    return () => document.body.classList.remove('touring');
  }, [step]);

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
    panel.current?.focus();
    // The welcome stands alone on Home, with nothing to surround.
    if (step === 0) {
      setRect(null);
      if (pathname !== '/') navigate('/', { replace: true });
      return;
    }
    const stop = STEPS[step - 1];
    const { path, target } = stop;
    const tab = 'tab' in stop ? stop.tab : null;
    // A stop's path may forward on arrival (/rehearse goes to the one saved
    // pack), so the stop is reached when the path is a prefix, not an equal.
    if (!matchPath({ path, end: path === '/' }, pathname)) {
      setRect(null); // the layer itself dims the new screen until its target is found
      navigate(path, { replace: true });
      return;
    }
    // The first sighting brings the feature to the top of the clear space;
    // later sightings (scroll, resize) only move the box.
    let placed = false;
    const measure = () => {
      const found = document.querySelectorAll(target);
      if (found.length === 0) return false;
      if (!placed) {
        placed = true;
        // A feature in the fixed bars is always in view: nothing to scroll.
        if (!found[0].closest('.app-header, .bottom-nav')) {
          window.scrollBy(0, union(found).top - clearTop() - GAP);
        }
      }
      setRect(union(found));
      const tabFound = tab ? document.querySelector(tab) : null;
      setTabRect(tabFound ? tabFound.getBoundingClientRect() : null);
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
      if (!panel.current?.contains(event.target as Node)) panel.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocus);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocus);
    };
  }, [step]);

  if (step === null || pathname.startsWith('/blacksky')) return null;

  const first = step === 0;
  const last = step === TOTAL - 1;

  return (
    <div className={rect ? 'tour' : 'tour tour-dim'}>
      {rect ? (
        <>
          {/* One shade over the screen with a hole for each ringed part, so a
              stop can show its feature and its tab together. */}
          <svg className="tour-shade" aria-hidden="true">
            <mask id="tour-holes">
              <rect width="100%" height="100%" fill="white" />
              <rect {...grown(rect, PAD)} rx="16" fill="black" />
              {tabRect ? <rect {...grown(tabRect, TAB_PAD_X, TAB_PAD_Y)} rx="12" fill="black" /> : null}
            </mask>
            <rect width="100%" height="100%" mask="url(#tour-holes)" />
          </svg>
          <div className="tour-spot" style={box(grown(rect, PAD))} />
          {tabRect ? <div className="tour-tab-spot" style={box(grown(tabRect, TAB_PAD_X, TAB_PAD_Y))} /> : null}
        </>
      ) : null}
      <section
        ref={panel}
        tabIndex={-1}
        className="card tour-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
      >
        <div className="tour-head">
          <span className="kicker">{first ? copy.WELCOME_KICKER : copy.TOUR_KICKER}</span>
          {/* Skip stays in this corner on every stop; on the last, Finish says it. */}
          <button
            type="button"
            className={last ? 'tour-skip tour-hold-place' : 'tour-skip'}
            aria-label={copy.SKIP_TOUR}
            aria-hidden={last || undefined}
            tabIndex={last ? -1 : undefined}
            onClick={end}
          >
            <Glyph kind="close" line />
          </button>
        </div>
        <div className="tour-body">
          {first ? <Welcome /> : <Stop index={step - 1} />}
        </div>
        {/* One row in one place on every stop: Back, where it is, and Next. A
            Back with nowhere to go keeps its room, so Next never moves. */}
        <div className="tour-controls">
          <button
            type="button"
            className={first ? 'tour-hold-place' : undefined}
            aria-hidden={first || undefined}
            tabIndex={first ? -1 : undefined}
            onClick={() => setStep(step - 1)}
          >
            {copy.TOUR_BACK}
          </button>
          <span className="figure tour-count">
            {step + 1}/{TOTAL}
          </span>
          <button type="button" className="main-action" onClick={() => (last ? end() : setStep(step + 1))}>
            {last ? copy.TOUR_FINISH : copy.TOUR_NEXT}
          </button>
        </div>
      </section>
    </div>
  );
}

/** The first page of the tour: what Cooeee is called and what it does, with
 *  the longer lines that were the About page behind one toggle. */
function Welcome() {
  return (
    <>
      <div className="card-head welcome-head">
        <span className="welcome-mark">
          <Mark size={32} />
        </span>
        <div>
          <h2 id="tour-title">{copy.APP_NAME}</h2>
          <p className="muted">
            <KeyTerms text={copy.WELCOME_SAY} terms={copy.WELCOME_TERMS} className="welcome-term" />
          </p>
        </div>
      </div>
      <p>
        <KeyTerms text={copy.WELCOME_NAME} terms={copy.WELCOME_TERMS} className="welcome-term" />
      </p>
      {/* What it does, apart from the name above it: grey, as each stop's line
          is, with a little more room before it. */}
      <p className="muted welcome-does">
        <KeyTerms text={copy.WELCOME_DOES} terms={copy.WELCOME_TERMS} className="welcome-term" />
      </p>
      <details className="welcome-more" onToggle={revealOpened}>
        <summary>
          {copy.ABOUT_COOEEE}
          {/* Points right while closed and down while open, as every toggle's does. */}
          <svg className="hint-chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
            <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <ul className="info-lines">
          {copy.COOEEE_INFO_LINES.map((line) => (
            <li key={line.glyph}>
              <Glyph kind={line.glyph} />
              <div>
                <h3 className="about-line-title">{line.title}</h3>
                <p>{line.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}

function Stop({ index }: { index: number }) {
  const step = STEPS[index];
  return (
    <>
      <div className="card-head">
        <Glyph kind={step.glyph} />
        <h2 id="tour-title">{step.title}</h2>
      </div>
      <p className="muted">{step.line}</p>
      {/* BlackSky's stop carries what the mode does, which sat behind a ring
          beside the hold on Home before the hold moved to the tab bar. */}
      {'more' in step ? (
        <details className="welcome-more" onToggle={revealOpened}>
          <summary>
            {copy.ABOUT_BLACKSKY}
            {/* Points right while closed and down while open, as every toggle's does. */}
            <svg className="hint-chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
              <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <ul className="info-lines glyph-lines">
            {copy.BLACKSKY_INFO_LINES.map((line) => (
              <li key={line.glyph}>
                <Glyph kind={line.glyph} line />
                {line.text}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}

/** An opened toggle in the panel brings its lines into view inside it. */
function revealOpened(event: SyntheticEvent<HTMLDetailsElement>) {
  if (event.currentTarget.open) event.currentTarget.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

/** Where the clear space starts: under the header and, where there is one,
 *  the Back bar stuck beneath it. */
function clearTop(): number {
  const bars = document.querySelectorAll('.app-header, .back-bar');
  return Math.max(0, ...Array.from(bars, (bar) => bar.getBoundingClientRect().bottom));
}

/** A box made larger by `pad` across and `padY` up and down, or smaller
 *  where either is negative. */
function grown(rect: DOMRect, pad: number, padY = pad) {
  return { x: rect.left - pad, y: rect.top - padY, width: rect.width + 2 * pad, height: rect.height + 2 * padY };
}

/** The style that places a ring over a box. */
function box({ x, y, width, height }: ReturnType<typeof grown>) {
  return { left: x, top: y, width, height };
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
