import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import * as copy from '../../core/copy';
import { BLOCK_SECONDS, HINT_LIMIT, boxOf, hintFor, hitTest, shownFor } from '../../core/block';
import { BLOCK_DECOYS, BLOCK_HAZARDS, BLOCK_PICKS, type BlockHazard } from '../../core/block-hazards';
import { BLOCK_TILE } from '../../core/block-layout';
import { centredOn, isTap, panBy, pinchScale, screenToYard, zoomAbout, zoomLevels, type Camera, type Viewport } from '../../core/block-view';
import * as audio from '../Drill/audio';
import SoundButton from '../Drill/SoundButton';
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
    ended: false,
  });
  const [hud, setHud] = useState({ seconds, found: 0, hints: 0 });
  const [message, setMessage] = useState('');
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

  const finish = () => {
    const s = state.current;
    if (s.ended) return;
    s.ended = true;
    onEnd({ found: s.found, wrongTaps: s.wrongTaps, hints: s.hints });
  };

  /** A tap at a point on the canvas, in device pixels. */
  const tapAt = (px: number, py: number) => {
    const s = state.current;
    if (!s.camera || s.ended) return;
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
      setMessage(copy.BLOCK_FOUND(hazard.name));
      if (s.found.length === BLOCK_PICKS) finish();
    } else if (hit.kind === 'again') {
      setMessage(copy.BLOCK_AGAIN);
    } else if (hit.kind === 'nothing') {
      setMessage(copy.BLOCK_NOTHING);
    } else {
      s.wrongTaps += 1;
      s.marks.push({ kind: 'wrong', x, y, w: 0, h: 0, at: s.clock });
      audio.beat();
      setMessage(hit.kind === 'decoy' ? copy.BLOCK_DECOY(nameOf(hit.id)) : copy.BLOCK_CLEARED);
    }
  };

  const useHint = () => {
    const s = state.current;
    if (s.hints >= HINT_LIMIT || s.ended || !s.camera) return;
    const hint = hintFor(hazards, s.found, day, s.hints + 1);
    if (!hint) return;
    s.hints += 1;
    s.hint = hint;
    s.camera = centredOn(hint.x * BLOCK_TILE, hint.y * BLOCK_TILE, Math.max(s.camera.scale, levels().start), s.view);
    setMessage(copy.BLOCK_HINT_SHOWN);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const s = state.current;
    let stopLoop = () => {};
    let live = true;
    let shown = { seconds, found: 0, hints: 0 };
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
      s.view = { width, height };
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
      if (!s.ended) s.elapsed += dt;
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
      const next = { seconds: Math.max(0, Math.ceil(seconds - s.elapsed)), found: s.found.length, hints: s.hints };
      if (next.seconds !== shown.seconds || next.found !== shown.found || next.hints !== shown.hints) {
        if (next.seconds < shown.seconds && next.seconds < 10) audio.beat();
        shown = next;
        setHud(next);
      }
      if (!s.ended && s.elapsed >= seconds) finish();
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
  const wheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    const s = state.current;
    if (!s.camera) return;
    const box = event.currentTarget.getBoundingClientRect();
    const { min, max } = levels();
    const scale = Math.min(max, Math.max(min, s.camera.scale + (event.deltaY < 0 ? 1 : -1)));
    zoomTo(scale, (event.clientX - box.left) * s.ratio, (event.clientY - box.top) * s.ratio);
  };

  const clock = `${Math.floor(hud.seconds / 60)}:${String(hud.seconds % 60).padStart(2, '0')}`;
  const hintsLeft = HINT_LIMIT - hud.hints;

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
        onWheel={wheel}
      />
      <div className="drill-top">
        <div className="drill-counts">
          <p className={hud.seconds <= 10 ? 'drill-timer figure late' : 'drill-timer figure'}>{clock}</p>
          <p className="drill-bag figure">{copy.BLOCK_FOUND_COUNT(hud.found)}</p>
        </div>
        <div className="drill-top-actions">
          <SoundButton />
          <button type="button" className="drill-chip drill-close" aria-label={copy.LEAVE_BLOCK} onClick={onLeave}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>
      <p className="drill-room block-message" role="status" aria-live="polite">
        {message || (hud.seconds === 30 || hud.seconds === 10 ? copy.SECONDS_LEFT(hud.seconds) : '')}
      </p>
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
