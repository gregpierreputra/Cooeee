import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { MAP_HOME, MAP_MAX_SCALE, clampView, mapPoint, zoomAbout, type MapBox, type MapView } from '../../core/area-map-view';
import * as copy from '../../core/copy';
import type { Destination } from '../../core/types';
import Glyph from './Glyph';

type Point = { x: number; y: number };

const WHEEL_STEP = 0.01; // zoom per pixel of wheel travel, with Ctrl held or a trackpad pinch
const WHEEL_MAX = 50; // one wheel notch zooms about as much as a button press
const KEY_PAN = 48; // pixels an arrow key moves the map
const BUTTON_ZOOM = 1.6;

/** The stored map of the pack's area, to explore with a finger or a mouse: one
 *  finger drags it, two pinch to zoom, a wheel zooms at the pointer, and round
 *  buttons zoom for anyone who cannot. North stays up, and the picture always
 *  fills the frame, as nothing was saved past its edge. The
 *  saved place sits at the middle by construction; each official place of
 *  last resort is placed from its own coordinates. Everything is drawn from
 *  bytes already on the phone, so it works the same with no signal. */
export default function AreaMap({
  src,
  box,
  places,
  scale,
}: {
  src: string;
  box: MapBox | null;
  places: Destination[];
  /** How far the map reaches, shown in its corner as a map's scale is. */
  scale?: string;
}) {
  const howId = useId();
  const frame = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const [view, setView] = useState<MapView>(MAP_HOME);

  // A point relative to the frame's middle, and half the frame's width.
  const measure = (clientX: number, clientY: number) => {
    const rect = frame.current!.getBoundingClientRect();
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2, half: rect.width / 2 };
  };

  // React's wheel handler cannot stop the page scrolling, so it is attached here.
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    // A plain wheel or two-finger scroll scrolls the page past the map. Only
    // Ctrl with the wheel, or a trackpad pinch (which the browser reports as
    // Ctrl), zooms it.
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const at = measure(event.clientX, event.clientY);
      const travel = Math.max(-WHEEL_MAX, Math.min(WHEEL_MAX, event.deltaY));
      setView((v) => zoomAbout(v, at.x, at.y, Math.exp(-travel * WHEEL_STEP), at.half));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return; // only the main button drags
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const before = pointers.current.get(event.pointerId);
    if (!before) return;
    // A mouse whose button came up out of sight (a context menu) stops dragging.
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      pointers.current.delete(event.pointerId);
      return;
    }
    const now = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, now);
    const others = [...pointers.current].filter(([id]) => id !== event.pointerId).map(([, point]) => point);
    const { half } = measure(now.x, now.y);
    if (others.length === 0) {
      // One finger, or the mouse: drag.
      setView((v) => clampView({ ...v, x: v.x + now.x - before.x, y: v.y + now.y - before.y }, half));
      return;
    }
    // Two fingers. Each move event moves one finger, so the map zooms about the
    // other, still finger: the change in their spacing is the zoom.
    const other = others[0];
    const factor = Math.hypot(now.x - other.x, now.y - other.y) / Math.max(1, Math.hypot(before.x - other.x, before.y - other.y));
    const pivot = measure(other.x, other.y);
    setView((v) => zoomAbout(v, pivot.x, pivot.y, factor, half));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => pointers.current.delete(event.pointerId);

  // The buttons act about the middle of the frame.
  const fromButton = (factor: number) => {
    const half = frame.current!.getBoundingClientRect().width / 2;
    setView((v) => zoomAbout(v, 0, 0, factor, half));
  };

  // From the keyboard, with any map button focused: the arrows move the map,
  // + and - zoom it.
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const move = { ArrowLeft: [KEY_PAN, 0], ArrowRight: [-KEY_PAN, 0], ArrowUp: [0, KEY_PAN], ArrowDown: [0, -KEY_PAN] }[event.key];
    if (move) {
      event.preventDefault();
      const half = frame.current!.getBoundingClientRect().width / 2;
      setView((v) => clampView({ ...v, x: v.x + move[0], y: v.y + move[1] }, half));
    } else if (event.key === '+' || event.key === '=') fromButton(BUTTON_ZOOM);
    else if (event.key === '-') fromButton(1 / BUTTON_ZOOM);
  };
  // At a limit the button stays focusable and simply does nothing, so a
  // keyboard user is never dropped out of the controls.
  const atMax = view.scale >= MAP_MAX_SCALE;
  const atMin = view.scale <= 1;

  const layer = {
    transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
    // The markers undo the zoom, so they stay one size.
    '--map-scale': view.scale,
  } as CSSProperties;

  return (
    <>
      <div
        ref={frame}
        className="area-map-frame"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onPointerUp}
      >
        <div className="area-map-layer" style={layer}>
          <img src={src} alt={copy.AREA_MAP_ALT} draggable={false} />
          <span className="area-map-pin" aria-hidden="true" />
          {places.map((place) => {
            const at = !box || place.lat === undefined || place.lon === undefined ? null : mapPoint(box, { lat: place.lat, lon: place.lon });
            return at ? (
              <span
                key={place.id}
                className="area-map-mark"
                style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }}
                aria-hidden="true"
              >
                <Glyph kind="place" size={16} />
              </span>
            ) : null;
          })}
        </div>
        {/* On the map, top left, outside the turning layer. A press here
            never reaches the frame, so tapping a button never drags the map. */}
        <div className="area-map-controls" onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" className="map-button" onKeyDown={onKeyDown} aria-label={copy.MAP_ZOOM_IN} aria-describedby={howId} aria-disabled={atMax} onClick={() => !atMax && fromButton(BUTTON_ZOOM)}>
            +
          </button>
          <button type="button" className="map-button" onKeyDown={onKeyDown} aria-label={copy.MAP_ZOOM_OUT} aria-describedby={howId} aria-disabled={atMin} onClick={() => !atMin && fromButton(1 / BUTTON_ZOOM)}>
            −
          </button>
        </div>
        {scale ? <span className="area-map-scale">{scale}</span> : null}
      </div>
      {/* Pinch and drag are what every phone map does, so the how-to is read
          out with the buttons rather than shown. */}
      <p id={howId} className="visually-hidden">{copy.MAP_HOW}</p>
    </>
  );
}
