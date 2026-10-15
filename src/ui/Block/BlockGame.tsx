import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import * as copy from '../../core/copy';
import { BLOCK_SECONDS, HINT_COST, HINT_LIMIT, WRONG_TAP_COST, boxOf, hintFor, hitTest, runningScore, shownFor } from '../../core/block';
import { BLOCK_DECOYS, BLOCK_HAZARDS, BLOCK_PICKS, type BlockHazard } from '../../core/block-hazards';
import { BLOCK_TILE } from '../../core/block-layout';
import { centredOn, isTap, panBy, pinchScale, screenToYard, zoomAbout, zoomLevels, type Camera, type Viewport } from '../../core/block-view';
import * as audio from '../Drill/audio';
import SoundButton from '../Drill/SoundButton';
import Glyph from '../components/Glyph';
import { startLoop } from '../Drill/loop';
import { drawBlock, loadBlockArt, type Mark } from './block-render';

export type BlockOutcome = { found: string[]; wrongTaps: number; hints: number };

type Props = {
  day: number;
  hazards: BlockHazard[];
  seconds?: number;
  onEnd: (outcome: BlockOutcome) => void;
  onUnavailable: () => void;
  onLeave: () => void;
};

/** How far round a thing a tap still counts, in css pixels: a fingertip's
 *  width, so a small thing is not a fiddly target. */
const TAP_PAD_CSS = 10;
/** How far a press may wander and still be a tap, in css pixels. */
const TAP_SLOP_CSS = 10;
/** How far one arrow key press moves the picture, in css pixels. */
const KEY_PAN_CSS = 48;
/** The clock turns red at half a minute and pulses for the last ten seconds,
 *  as the drill's does. */
const WARN_SECONDS = 30;
const LATE_SECONDS = 10;
/** How long the yard stays, still, after the last find or the end of the
 *  clock, so the last ring and what it means are seen before the result. */
const END_PAUSE_MS = 1500;
/** Scrolling this far, in pixels, is one step of zoom, so a trackpad's many
 *  small scroll events do not race from one end of the zoom to the other. */
const WHEEL_STEP = 40;
/** A part step left over is forgotten after this long without scrolling, so
 *  the next swipe starts afresh. */
const WHEEL_REST_MS = 250;
/** A trackpad pinch arrives as scrolling with Ctrl held, in much smaller
 *  amounts than a swipe, so it is scaled up to feel as quick. */
const PINCH_SCALE = 5;

/** What a tap said: its words, whether it found a risk, cost points or
 *  neither, and how it changed the score. */
type Said = { text: string; tone: 'found' | 'wrong' | 'plain'; points?: number };

/** The points one more find adds, as the score rounds them. */
const findPoints = (found: number) => Math.round((100 * found) / BLOCK_PICKS) - Math.round((100 * (found - 1)) / BLOCK_PICKS);

const nameOf = (id: string): string =>
  BLOCK_HAZARDS.find((hazard) => hazard.id === id)?.name ?? BLOCK_DECOYS.find((decoy) => decoy.id === id)?.name ?? '';

/** Ready the Block — three minutes over the yard. Drag to look around, pinch
 *  or use the buttons to zoom, tap a thing to mark it. Found risks keep a
 *  green ring; a wrong tap shows a cross and costs a little. */
export default function BlockGame({ day, hazards, seconds = BLOCK_SECONDS, onEnd, onUnavailable, onLeave }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [calm] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const state = useRef({
    clock: 0,
    elapsed: 0,
    found: [] as string[],
    wrongTaps: 0,
    hints: 0,
    marks: [] as Mark[],
    hint: null as { x: number; y: number; radius: number } | null,
    camera: null as Camera | null,
    view: { width: 1, height: 1 } as Viewport,
    ratio: 1,
    // Over: the clock has stopped and taps count no more, but the yard stays
    // for END_PAUSE_MS before `ended`, when the result takes over.
    over: false,
    ended: false,
  });
  const [hud, setHud] = useState({ seconds, found: 0, hints: 0, score: 0 });
  const [said, setSaid] = useState<Said>({ text: '', tone: 'plain' });
  const say = (text: string, tone: Said['tone'] = 'plain', points?: number) => setSaid({ text, tone, points });
  const wheelTravel = useRef(0);
  const wheelAt = useRef(0);
  const pointers = useRef(new Map<number, { x: number; y: number; startX: number; startY: number; at: number }>());
  const pinch = useRef<{ distance: number; scale: number } | null>(null);

  const levels = () => zoomLevels(state.current.view);

  const zoomTo = (scale: number, px?: number, py?: number) => {
    const s = state.current;
    if (!s.camera) return;
    s.camera = zoomAbout(s.camera, scale, px ?? s.view.width / 2, py ?? s.view.height / 2, s.view);
  };
  const zoomStep = (step: number) => {
    const s = state.current;
    if (!s.camera) return;
    const { min, max } = levels();
    zoomTo(Math.min(max, Math.max(min, s.camera.scale + step)));
  };

  const endTimer = useRef<number | null>(null);
  const finish = () => {
    const s = state.current;
    if (s.ended) return;
    s.ended = true;
    onEnd({ found: s.found, wrongTaps: s.wrongTaps, hints: s.hints });
  };
  /** Stop the clock and the taps, and show the result a moment later. */
  const wrapUp = () => {
    const s = state.current;
    if (s.over) return;
    s.over = true;
    endTimer.current = window.setTimeout(finish, END_PAUSE_MS);
  };

  /** A tap at a point on the canvas, in device pixels. */
  const tapAt = (px: number, py: number) => {
    const s = state.current;
    if (!s.camera || s.over) return;
    const { x, y } = screenToYard(px, py, s.camera);
    const hit = hitTest(x, y, hazards, s.found, (TAP_PAD_CSS * s.ratio) / s.camera.scale);
    if (hit.kind === 'hazard') {
      s.found = [...s.found, hit.id];
      const hazard = hazards.find((candidate) => candidate.id === hit.id)!;
      const box = boxOf(hazard.sprite, hazard.x, hazard.y);
      s.marks.push({ kind: 'found', x: (box.x0 + box.x1) / 2, y: box.y1, w: box.x1 - box.x0, h: box.y1 - box.y0, at: s.clock });
      // A hint pointing at this one has done its job.
      if (s.hint && hintFor(hazards, s.found, day, s.hints) === null) s.hint = null;
      else if (s.hint && Math.hypot(s.hint.x - hazard.x, s.hint.y - hazard.y) < 3) s.hint = null;
      audio.blip();
      navigator.vibrate?.(10);
      // The last find says what it found, then that all are found.
      const all = s.found.length === BLOCK_PICKS;
      say(all ? `${copy.BLOCK_FOUND(hazard.name)} ${copy.BLOCK_ALL_FOUND}.` : copy.BLOCK_FOUND(hazard.name), 'found', findPoints(s.found.length));
      if (all) wrapUp();
    } else if (hit.kind === 'again') {
      say(copy.BLOCK_AGAIN);
    } else if (hit.kind === 'nothing') {
      say(copy.BLOCK_NOTHING);
    } else {
      s.wrongTaps += 1;
      s.marks.push({ kind: 'wrong', x, y, w: 0, h: 0, at: s.clock });
      audio.beat();
      const cleared = BLOCK_HAZARDS.find((hazard) => hazard.id === hit.id)?.clearedName ?? '';
      say(hit.kind === 'decoy' ? copy.BLOCK_DECOY(nameOf(hit.id)) : copy.BLOCK_CLEARED(cleared), 'wrong', -WRONG_TAP_COST);
    }
  };

  const useHint = () => {
    const s = state.current;
    if (s.hints >= HINT_LIMIT || s.over || !s.camera) return;
    const hint = hintFor(hazards, s.found, day, s.hints + 1);
    if (!hint) return;
    s.hints += 1;
    s.hint = hint;
    s.camera = centredOn(hint.x * BLOCK_TILE, hint.y * BLOCK_TILE, Math.max(s.camera.scale, levels().start), s.view);
    say(copy.BLOCK_HINT_SHOWN, 'plain', -HINT_COST);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const s = state.current;
    let stopLoop = () => {};
    let live = true;
    let shown = { seconds, found: 0, hints: 0, score: 0 };
    let cameraText = '';

    document.body.classList.add('drill-open');
    stage.focus();

    const fit = () => {
      s.ratio = Math.min(window.devicePixelRatio || 1, 3, 2048 / Math.max(1, canvas.clientWidth), 2048 / Math.max(1, canvas.clientHeight));
      const width = Math.round(canvas.clientWidth * s.ratio);
      const height = Math.round(canvas.clientHeight * s.ratio);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      // The bars over the yard, measured each frame: the count at the top and
      // the zoom and hint buttons at the bottom. The yard may be moved clear of both.
      const box = canvas.getBoundingClientRect();
      const count = stage.querySelector('.block-found')?.getBoundingClientRect();
      const controls = stage.querySelector('.block-controls')?.getBoundingClientRect();
      const insetTop = count ? Math.max(0, Math.round((count.bottom - box.top) * s.ratio)) : 0;
      const insetBottom = controls ? Math.max(0, Math.round((box.bottom - controls.top) * s.ratio)) : 0;
      s.view = { width, height, insetTop, insetBottom };
      // The first frame looks at the house, close enough to tap.
      if (!s.camera) s.camera = centredOn(17.5 * BLOCK_TILE, 12 * BLOCK_TILE, zoomLevels(s.view).start, s.view);
      else s.camera = panBy(s.camera, 0, 0, s.view);
    };

    const onKey = (event: KeyboardEvent) => {
      if (!s.camera) return;
      const step = KEY_PAN_CSS * s.ratio;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [step, 0],
        ArrowRight: [-step, 0],
        ArrowUp: [0, step],
        ArrowDown: [0, -step],
      };
      if (moves[event.key]) {
        event.preventDefault();
        s.camera = panBy(s.camera, moves[event.key][0], moves[event.key][1], s.view);
      } else if (event.key === '+' || event.key === '=') zoomStep(1);
      else if (event.key === '-') zoomStep(-1);
    };
    const onVisibility = () => (document.hidden ? audio.suspend() : audio.resume());
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);

    const frame = (art: Awaited<ReturnType<typeof loadBlockArt>>, dt: number): boolean => {
      fit();
      s.clock += dt;
      if (!s.over) s.elapsed += dt;
      const camera = s.camera!;
      drawBlock(canvas, art, {
        time: s.clock,
        camera,
        things: shownFor(hazards),
        marks: s.marks,
        hint: s.hint,
        calm,
      });
      const nextCamera = `${camera.left.toFixed(2)},${camera.top.toFixed(2)},${camera.scale},${s.ratio}`;
      if (nextCamera !== cameraText) {
        cameraText = nextCamera;
        // Where the picture sits, for the end to end tests to tap a known thing.
        canvas.dataset.camera = nextCamera;
      }
      const next = {
        seconds: Math.max(0, Math.ceil(seconds - s.elapsed)),
        found: s.found.length,
        hints: s.hints,
        score: runningScore({ found: s.found.length, wrongTaps: s.wrongTaps, hints: s.hints }),
      };
      if (next.seconds !== shown.seconds || next.found !== shown.found || next.hints !== shown.hints || next.score !== shown.score) {
        if (next.seconds < shown.seconds && next.seconds < 10) audio.beat();
        shown = next;
        setHud(next);
      }
      if (!s.over && s.elapsed >= seconds) {
        setSaid({ text: copy.BLOCK_TIME_UP, tone: 'plain' });
        wrapUp();
      }
      return !s.ended;
    };

    loadBlockArt().then(
      (art) => {
        if (live) stopLoop = startLoop((dt) => frame(art, dt));
      },
      () => {
        if (live) onUnavailable();
      },
    );

    return () => {
      live = false;
      stopLoop();
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      document.body.classList.remove('drill-open');
      if (endTimer.current !== null) window.clearTimeout(endTimer.current);
      audio.suspend();
    };
    // The loop owns its own state; it starts once with the canvas.
  }, []);

  // ── pointers: one drags, two pinch, a short still press taps ──
  const point = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = state.current.ratio;
    return { x: (event.clientX - box.left) * ratio, y: (event.clientY - box.top) * ratio };
  };
  const spread = () => {
    const [a, b] = [...pointers.current.values()];
    return { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  const down = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const { x, y } = point(event);
    pointers.current.set(event.pointerId, { x, y, startX: x, startY: y, at: performance.now() });
    if (pointers.current.size === 2 && state.current.camera) pinch.current = { distance: spread().distance, scale: state.current.camera.scale };
  };
  const move = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const s = state.current;
    const held = pointers.current.get(event.pointerId);
    if (!held || !s.camera) return;
    const { x, y } = point(event);
    const dx = x - held.x;
    const dy = y - held.y;
    held.x = x;
    held.y = y;
    if (pointers.current.size === 1) s.camera = panBy(s.camera, dx, dy, s.view);
    else if (pointers.current.size === 2 && pinch.current) {
      const now = spread();
      const scale = pinchScale(pinch.current.scale, now.distance / Math.max(1, pinch.current.distance), levels());
      if (scale !== s.camera.scale) zoomTo(scale, now.x, now.y);
    }
  };
  const up = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const held = pointers.current.get(event.pointerId);
    const wasSingle = pointers.current.size === 1 && pinch.current === null;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (!held || !wasSingle || event.type === 'pointercancel') return;
    const moved = Math.hypot(held.x - held.startX, held.y - held.startY) / state.current.ratio;
    if (isTap(moved, performance.now() - held.at, TAP_SLOP_CSS)) tapAt(held.x, held.y);
  };
  const wheel = (event: WheelEvent) => {
    // Scrolling or pinching over the yard zooms the yard only, never the page
    // behind it or the whole page with its buttons.
    event.preventDefault();
    const s = state.current;
    if (!s.camera) return;
    // Lines and pages are turned into pixels, then added up: one step of zoom
    // for every WHEEL_STEP scrolled, however many events it came in.
    if (event.timeStamp - wheelAt.current > WHEEL_REST_MS) wheelTravel.current = 0;
    wheelAt.current = event.timeStamp;
    const pixels = event.deltaY * (event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? 800 : 1);
    wheelTravel.current += event.ctrlKey ? pixels * PINCH_SCALE : pixels;
    if (Math.abs(wheelTravel.current) < WHEEL_STEP) return;
    const step = wheelTravel.current < 0 ? 1 : -1;
    wheelTravel.current = 0;
    const box = (event.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const { min, max } = levels();
    const scale = Math.min(max, Math.max(min, s.camera.scale + step));
    zoomTo(scale, (event.clientX - box.left) * s.ratio, (event.clientY - box.top) * s.ratio);
  };

  // React listens to the wheel without the right to stop the browser, so the
  // yard listens itself, allowed to keep the scroll and the pinch to itself.
  const onWheel = useRef(wheel);
  onWheel.current = wheel;
  useEffect(() => {
    const canvas = canvasRef.current!;
    const listen = (event: WheelEvent) => onWheel.current(event);
    canvas.addEventListener('wheel', listen, { passive: false });
    return () => canvas.removeEventListener('wheel', listen);
  }, []);

  const clock = `${Math.floor(hud.seconds / 60)}:${String(hud.seconds % 60).padStart(2, '0')}`;
  const hintsLeft = HINT_LIMIT - hud.hints;
  const clockState = hud.seconds <= LATE_SECONDS ? ' late' : hud.seconds <= WARN_SECONDS ? ' warn' : '';

  return (
    <div ref={stageRef} className="drill-stage block-stage" tabIndex={-1} aria-label={copy.BLOCK_LABEL}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={copy.BLOCK_SCENE_LABEL}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
      {/* Laid out as the drill's: the clock in the middle, the sound and close
          buttons at the right, and the count and what a tap found under the clock. */}
      <div className={`drill-top${clockState}`}>
        <p className="drill-timer figure">{clock}</p>
        <div className="block-status">
          <div className="block-counts">
            <p className="block-found figure">{copy.BLOCK_FOUND_COUNT(hud.found)}</p>
            {/* The score stands out from the count: a label over a larger figure,
                red below 0, that bumps each time it changes. */}
            <p className={`block-score${hud.score < 0 ? ' below' : ''}`}>
              <span className="block-score-label">{copy.BLOCK_SCORE_LABEL}</span>
              <span key={hud.score} className="block-score-figure figure">{copy.BLOCK_SCORE_FIGURE(hud.score)}</span>
            </p>
          </div>
          {/* What a tap found, in its tone: a tick in green for a risk, a cross
              in red for a wrong tap, with how it changed the score. */}
          <p className={`block-message tone-${said.text ? said.tone : 'plain'}`} role="status" aria-live="polite">
            {said.text ? (
              <>
                {said.tone === 'found' ? <Glyph kind="check" line /> : said.tone === 'wrong' ? <Glyph kind="close" line /> : null}
                <span>{said.text}</span>
                {said.points !== undefined ? (
                  <span className="block-points">
                    <span aria-hidden="true">{copy.BLOCK_POINT_CHANGE(said.points)}</span>
                    <span className="visually-hidden">{copy.BLOCK_POINTS_SAID(said.points)}</span>
                  </span>
                ) : null}
              </>
            ) : hud.seconds === 30 || hud.seconds === 10 ? (
              copy.SECONDS_LEFT(hud.seconds)
            ) : null}
          </p>
        </div>
        <div className="drill-top-actions">
          <SoundButton />
          <button type="button" className="drill-chip drill-close" aria-label={copy.LEAVE_BLOCK} onClick={onLeave}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>
      <div className="block-controls">
        <div className="block-zoom">
          <button type="button" className="drill-chip block-zoom-button" aria-label={copy.ZOOM_OUT} onClick={() => zoomStep(-1)}>
            <span aria-hidden="true">−</span>
          </button>
          <button type="button" className="drill-chip block-zoom-button" aria-label={copy.ZOOM_IN} onClick={() => zoomStep(1)}>
            <span aria-hidden="true">+</span>
          </button>
        </div>
        <button type="button" className="drill-chip block-hint" disabled={hintsLeft <= 0} aria-describedby="block-hint-cost" onClick={useHint}>
          {copy.BLOCK_HINT(hintsLeft)}
        </button>
        <span id="block-hint-cost" className="visually-hidden">
          {copy.BLOCK_HINT_DETAIL}
        </span>
      </div>
    </div>
  );
}
