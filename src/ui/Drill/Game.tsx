import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import * as copy from '../../core/copy';
import { SPAWN, onDoorMat, pathTo } from '../../core/drill-house';
import { BAG_LIMIT, type DrillItem } from '../../core/drill-items';
import { DOWN, EARLY_EXIT_HOLD, facing, haze, leavingEarly, nearestItem, speedFor, step } from '../../core/drill-play';
import Glyph from '../components/Glyph';
import * as audio from './audio';
import { BEATS, CUTSCENE_SECONDS, LINES, OUTSIDE_SECONDS, POWER_OFF_AT, beatAt, beatStart, drawOutside, insideScene, stillAt } from './cutscene';
import { attachKeys, stickVector } from './input';
import SoundButton from './SoundButton';
import { startLoop } from './loop';
import { TILE } from '../../core/drill-layout';
import { BAG_STRIP, drawScene, fitCanvas, loadArt, type Art } from './render';

export type DrillOutcome = { reachedDoor: boolean; packed: string[] };

const STICK_RADIUS = 48; // css pixels
const PICK_SECONDS = 0.4; // the figure bends down: packing costs a moment
// The clock turns red with half a minute left, and pulses for the last ten.
const WARN_SECONDS = 30;
const LATE_SECONDS = 10;
// How long the rule stays under the clock once the drill starts.
const RULE_SECONDS = 5;
const DOOR_ARROW_SECONDS = 20;
const DOOR_OPENS_SECONDS = 0.9;

/** Everything the loop reads and writes, outside React so a frame never
 *  waits on a render. */
type World = {
  phase: 'opening' | 'ready' | 'play' | 'leaving';
  clock: number; // seconds this screen has been drawing
  opening: number; // seconds into the opening film
  elapsed: number; // seconds of the two minutes used
  leaving: number; // seconds since the time ended on the mat
  onMat: number; // seconds stood on the mat, ready to leave early
  x: number;
  y: number;
  facing: number;
  stickX: number;
  stickY: number;
  moving: boolean;
  pickUntil: number;
  packed: string[];
  packedAt: number;
  near: DrillItem | null;
  /** A tapped walk: the cell middles still to pass, and where it ends. */
  route: { x: number; y: number }[];
  target: { x: number; y: number } | null;
};

const freshWorld = (opening: boolean): World => ({
  phase: opening ? 'opening' : 'play',
  clock: 0, opening: 0, elapsed: 0, leaving: 0, onMat: 0,
  x: SPAWN.x, y: SPAWN.y, facing: DOWN, stickX: 0, stickY: 0, moving: false, pickUntil: 0,
  packed: [], packedAt: 0, near: null, route: [], target: null,
});

/** A fact with its key phrases (a date, a distance, a count) set in the
 *  accent colour, so they are what the eye lands on first. */
function withKeys(text: string, keys: string[]) {
  if (keys.length === 0) return text;
  const pattern = new RegExp(`(${keys.map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`);
  return text.split(pattern).map((part, i) => (keys.includes(part) ? <strong key={i} className="drill-fact-figure">{part}</strong> : part));
}

type Props = {
  /** Show the opening film first. Play again goes straight to the clock. */
  opening: boolean;
  seconds: number;
  onEnd: (outcome: DrillOutcome) => void;
  onUnavailable: () => void;
  onLeave: () => void;
};

/** E9-US1 and US2 — the opening film, then two minutes in the house, on one
 *  canvas that fills the screen, so there is no break between them. Left thumb
 *  steers, or a tap on the floor walks there; the one button packs whatever
 *  is in reach, and where the figure stands at 0:00 decides. */
export default function Game({ opening, seconds, onEnd, onUnavailable, onLeave }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const knobRef = useRef<HTMLSpanElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const world = useRef<World>(freshWorld(opening));
  const [calm] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // Mouse and keys, or touch: which wording the guide uses.
  const [keys] = useState(() => window.matchMedia('(pointer: fine)').matches);
  const [hud, setHud] = useState({
    playing: !opening, ready: false, beat: 0, seconds, packed: 0, near: null as DrillItem | null,
  });

  // After the film the game waits behind the guide, clock stopped, until the
  // person starts it. Play again has no film and no guide.
  const skipOpening = () => {
    world.current.phase = 'ready';
  };
  const nextBeat = () => {
    const w = world.current;
    const beat = beatAt(w.opening) + 1;
    if (beat >= BEATS) w.phase = 'ready';
    else w.opening = beatStart(beat);
  };
  const start = () => {
    if (world.current.phase === 'ready') world.current.phase = 'play';
  };

  const pack = () => {
    const w = world.current;
    // Checked here as well as on the button, so nothing packs out of reach,
    // past ten, or outside the two minutes.
    if (w.phase !== 'play' || !w.near || w.packed.length >= BAG_LIMIT || w.clock < w.pickUntil) return;
    w.packed = [...w.packed, w.near.id];
    w.packedAt = w.clock;
    w.pickUntil = w.clock + PICK_SECONDS;
    audio.blip();
    navigator.vibrate?.(10);
  };

  // Where the picture starts over the house, and house pixels per css pixel,
  // as the last frame drew it: what a tap on the picture is turned back through.
  const camera = useRef({ left: 0, top: 0, perCss: 1 });
  const walkTo = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const w = world.current;
    if (w.phase !== 'play') return;
    const box = event.currentTarget.getBoundingClientRect();
    const { left, top, perCss } = camera.current;
    const x = ((event.clientX - box.left) * perCss + left) / TILE;
    const y = ((event.clientY - box.top) * perCss + top) / TILE;
    w.route = pathTo(w.x, w.y, x, y);
    w.target = w.route.at(-1) ?? null;
  };

  const releaseStick = () => {
    world.current.stickX = 0;
    world.current.stickY = 0;
    if (knobRef.current) knobRef.current.style.transform = '';
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const w = world.current;
    let shown = hud;
    let bagHeight = '';
    let stopLoop = () => {};
    let live = true;

    // The drill takes the whole screen: the app's bars step aside until it ends.
    document.body.classList.add('drill-open');
    stage.focus();

    const detachKeys = attachKeys((x, y) => {
      w.stickX = x;
      w.stickY = y;
    });
    const onKey = (event: KeyboardEvent) => {
      const onButton = (event.target as HTMLElement).tagName === 'BUTTON';
      if ((event.key === 'Enter' || event.key === ' ') && !onButton) {
        if (w.phase === 'ready') start();
        else pack();
      }
    };
    // A hidden tab hears no key or thumb come up, and should make no sound.
    const onVisibility = () => {
      if (document.hidden) {
        releaseStick();
        audio.suspend();
      } else {
        audio.resume();
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);

    const frame = (art: Art, dt: number): boolean => {
      const view = fitCanvas(canvas);
      if (!view) return true;
      // The thumb controls sit just above the bag strip drawn along the bottom.
      const nextBag = `${Math.round((BAG_STRIP * view.scale) / view.ratio)}px`;
      if (nextBag !== bagHeight) stage.style.setProperty('--drill-bag', (bagHeight = nextBag));
      w.clock += dt;

      if (w.phase === 'opening') {
        const before = w.opening;
        w.opening += dt;
        if (w.opening >= CUTSCENE_SECONDS) w.phase = 'ready';
        if (before < POWER_OFF_AT && w.opening >= POWER_OFF_AT) audio.powerDown();
        audio.fire(w.opening < OUTSIDE_SECONDS ? 0.2 + (0.8 * w.opening) / OUTSIDE_SECONDS : 0.45);
        // Under reduced motion each line holds one still picture, not a film.
        const shownAt = calm ? stillAt(beatAt(w.opening)) : w.opening;
        if (shownAt < OUTSIDE_SECONDS) drawOutside(view, art, shownAt, calm);
        else drawScene(view, art, insideScene(shownAt, calm));
      } else {
        const picking = w.clock < w.pickUntil;
        if (w.phase === 'play') {
          const before = Math.ceil(seconds - w.elapsed);
          w.elapsed += dt;
          const left = Math.ceil(seconds - w.elapsed);
          if (left < before && left < LATE_SECONDS && left >= 0) audio.beat();
          // The stick or the keys always win: touching them ends a tapped walk.
          let goX = w.stickX;
          let goY = w.stickY;
          if (goX !== 0 || goY !== 0) {
            w.route = [];
            w.target = null;
          } else if (w.route.length > 0) {
            // Head for the next cell middle; close enough counts as there.
            const [next] = w.route;
            if (Math.hypot(next.x - w.x, next.y - w.y) < 0.1) w.route.shift();
            if (w.route.length === 0) w.target = null;
            else {
              // Full pace, easing off only for the last bit so it never overshoots.
              const dx = w.route[0].x - w.x;
              const dy = w.route[0].y - w.y;
              const pace = Math.min(1, Math.hypot(dx, dy) / Math.max(1e-6, speedFor(w.packed) * dt)) / Math.hypot(dx, dy);
              goX = dx * pace;
              goY = dy * pace;
            }
          }
          w.moving = !picking && (goX !== 0 || goY !== 0);
          if (w.moving) {
            const moved = step(w.x, w.y, goX, goY, dt, speedFor(w.packed));
            // A walk that is held fast (an edge it cannot ease round) gives up.
            if (dt > 0 && moved.x === w.x && moved.y === w.y) {
              w.route = [];
              w.target = null;
            }
            w.x = moved.x;
            w.y = moved.y;
            w.facing = facing(goX, goY, w.facing);
          }
          w.near = nearestItem(w.x, w.y, w.packed);
          const ready = leavingEarly(seconds - w.elapsed, onDoorMat(w.x, w.y));
          w.onMat = ready ? w.onMat + dt : 0;
        } else if (w.phase === 'leaving') {
          w.leaving += dt;
        }
        const left = seconds - w.elapsed;
        const { smoke, dark } = haze(w.elapsed, seconds);
        audio.fire(0.45 + 0.5 * (w.elapsed / seconds));
        camera.current = drawScene(view, art, {
          time: w.clock, camX: w.x, camY: w.y - 1, target: w.target,
          figure: { x: w.x, y: w.y, facing: w.facing, pose: picking ? 'pick' : w.moving ? 'walk' : 'idle', poseTime: picking ? w.clock - w.packedAt : w.clock },
          packed: w.packed, packedAt: w.packedAt, near: w.phase === 'play' ? w.near : null,
          powered: false, glow: 1, smoke, dark, door: Math.min(1, w.leaving / 0.6),
          late: left <= LATE_SECONDS, doorArrow: left <= DOOR_ARROW_SECONDS, showBag: true, outlines: w.phase !== 'leaving', calm,
          // The ring stays full while the door opens, so it is seen to complete.
          matHold: w.phase === 'leaving' ? 1 : w.onMat / EARLY_EXIT_HOLD,
        });
      }

      const next = {
        playing: w.phase !== 'opening',
        ready: w.phase === 'ready',
        beat: beatAt(w.opening),
        seconds: Math.max(0, Math.ceil(seconds - w.elapsed)),
        packed: w.packed.length,
        near: w.near,
      };
      if (Object.keys(next).some((key) => next[key as keyof typeof next] !== shown[key as keyof typeof next])) {
        shown = next;
        setHud(next);
      }

      // In the last 1:45, a moment on the mat: out the door now.
      if (w.phase === 'play' && w.onMat >= EARLY_EXIT_HOLD) {
        w.phase = 'leaving';
        audio.thud();
      }
      if (w.phase === 'play' && w.elapsed >= seconds) {
        // The time always runs to its end. Where the figure stands now decides.
        if (!onDoorMat(w.x, w.y)) {
          onEnd({ reachedDoor: false, packed: w.packed });
          return false;
        }
        w.phase = 'leaving';
        audio.thud();
      }
      if (w.phase === 'leaving' && w.leaving >= DOOR_OPENS_SECONDS) {
        onEnd({ reachedDoor: true, packed: w.packed });
        return false;
      }
      return true;
    };

    // The pictures ship with the app. If they cannot be read there is no
    // drill, and the person goes on to the rehearsal instead of a blank box.
    loadArt().then(
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
      detachKeys();
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      document.body.classList.remove('drill-open');
      audio.fire(0);
      // Nothing plays on the screens after the two minutes; Play again resumes it.
      audio.suspend();
    };
    // The loop owns its own state; it starts once with the canvas.
  }, []);

  // The guide takes focus as it opens, so a screen reader reads it first.
  useEffect(() => {
    if (hud.ready) guideRef.current?.focus();
    else stageRef.current?.focus();
  }, [hud.ready]);

  // The stick: the thumb's offset from where it landed, held inside a circle.
  const stickOrigin = useRef<[number, number] | null>(null);
  const moveStick = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!stickOrigin.current) return;
    const stick = stickVector(stickOrigin.current[0], stickOrigin.current[1], event.clientX, event.clientY, STICK_RADIUS);
    world.current.stickX = stick.x;
    world.current.stickY = stick.y;
    if (knobRef.current) knobRef.current.style.transform = `translate(${stick.dx}px, ${stick.dy}px)`;
  };
  const dropStick = () => {
    stickOrigin.current = null;
    releaseStick();
  };

  const clockState = hud.seconds <= LATE_SECONDS ? ' late' : hud.seconds <= WARN_SECONDS ? ' warn' : '';
  // The one rule that decides the score, under the clock: said at the start,
  // and again once the door arrow shows.
  const goal = hud.ready ? null : hud.seconds <= DOOR_ARROW_SECONDS ? copy.HEAD_TO_DOOR : hud.seconds > seconds - RULE_SECONDS ? copy.DRILL_HINT : null;
  const clock = `${Math.floor(hud.seconds / 60)}:${String(hud.seconds % 60).padStart(2, '0')}`;
  const full = hud.packed >= BAG_LIMIT;
  const line = LINES[hud.beat];

  return (
    <div ref={stageRef} className={hud.ready ? 'drill-stage ready' : 'drill-stage'} tabIndex={-1} aria-label={copy.DRILL_LABEL}>
      {/* A tap on the floor walks the figure there, round walls and furniture. */}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={hud.playing ? copy.DRILL_SCENE_LABEL : copy.CUTSCENE_LABEL}
        onPointerDown={walkTo}
      />
      {/* Over the paused game: the goal in the middle and a line beside each
          control, which are ringed above it. A tap or click anywhere, or
          Enter, starts the clock; the controls ignore taps until then. */}
      {hud.ready ? (
        <div ref={guideRef} className="drill-guide" role="dialog" aria-labelledby="drill-guide-goal" tabIndex={-1} onClick={start}>
          <div className="drill-guide-middle">
            <p id="drill-guide-goal" className="drill-guide-goal">{copy.GUIDE_GOAL}</p>
            <p className="drill-guide-start">{copy.GUIDE_START(keys)}</p>
          </div>
          <div className="drill-guide-tips">
            <p className="drill-guide-tip move">{copy.GUIDE_MOVE(keys).map((part) => <span key={part}>{part} </span>)}</p>
            <p className="drill-guide-tip grab">{copy.GUIDE_GRAB(keys).map((part) => <span key={part}>{part} </span>)}</p>
          </div>
        </div>
      ) : null}
      <div className={`drill-top${clockState}`}>
        {hud.playing ? <p className="drill-timer figure">{clock}</p> : null}
        {hud.playing && goal ? <p className="drill-goal">{goal}</p> : null}
        <div className="drill-top-actions">
          <SoundButton />
          {hud.playing ? null : (
            <button type="button" className="drill-chip" onClick={skipOpening}>
              {copy.SKIP_CUTSCENE}
            </button>
          )}
          <button type="button" className="drill-chip drill-close" aria-label={copy.LEAVE_DRILL} onClick={onLeave}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>

      {hud.playing ? (
        <>
          {/* Beside the ten slots it counts. */}
          <p className="drill-bag">
            <Glyph kind="bag" size={16} line />
            <span aria-hidden="true">{`${hud.packed}/${BAG_LIMIT}`}</span>
            <span className="visually-hidden">{copy.BAG_COUNT(hud.packed, BAG_LIMIT)}</span>
          </p>
          {/* Spoken twice in the two minutes, at 30 and at 10 seconds, so a reader who
              cannot see the clock still hears it coming. */}
          <p className="visually-hidden" role="status" aria-live="polite">
            {hud.seconds === 30 || hud.seconds === 10 ? copy.SECONDS_LEFT(hud.seconds) : ''}
          </p>
          <div className="drill-controls">
            <button
              type="button"
              className="drill-stick"
              aria-label={copy.STICK_LABEL}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                stickOrigin.current = [event.clientX, event.clientY];
              }}
              onPointerMove={moveStick}
              onPointerUp={dropStick}
              onPointerCancel={dropStick}
              onLostPointerCapture={dropStick}
            >
              {/* Four arrows say the ring is for moving. The figure still walks
                  any way the thumb points, diagonals included. */}
              <svg className="drill-stick-arrows" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
                <path d="M60 9l7 10H53zM60 111l7-10H53zM9 60l10-7v14zM111 60l-10-7v14z" />
              </svg>
              <span ref={knobRef} className="drill-knob" aria-hidden="true" />
            </button>
            {/* Packs on the press, not the release: a second thumb landing while
                the first holds the stick often gets no click on a phone. The
                click only serves the keyboard, where detail is 0. */}
            {/* Always in the same place, so the thumb finds it. It lights up
                and names the thing once one is in reach, and is dim with
                nothing near. Enter packs from a keyboard at any time. */}
            <button
              type="button"
              className="drill-grab"
              disabled={!hud.near || full}
              onPointerDown={pack}
              onClick={(event) => {
                if (event.detail === 0) pack();
              }}
            >
              {hud.near ? (
                <span key={hud.near.id} className="drill-grab-name">
                  {full ? copy.BAG_FULL : copy.GRAB_ITEM(hud.near.name)}
                </span>
              ) : (
                <span className="visually-hidden">{copy.NOTHING_IN_REACH}</span>
              )}
              <span className="drill-grab-ring">
                <Glyph kind="grab" size={34} line />
              </span>
            </button>
          </div>
        </>
      ) : (
        <div className="drill-film">
          <div className="drill-scrim" aria-hidden="true" />
          {/* One stable live region, so each new line is read out as it lands. */}
          <div role="status" aria-live="polite">
            <div key={hud.beat} className={hud.beat === BEATS - 1 ? 'drill-fact ready' : 'drill-fact'}>
              <p className="drill-fact-text">{withKeys(line.text, line.key)}</p>
              {line.source ? <p className="drill-fact-source">{line.source}</p> : null}
            </div>
          </div>
          {calm ? (
            <button type="button" className="drill-chip drill-next" onClick={nextBeat}>
              {copy.NEXT_STAGE}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
