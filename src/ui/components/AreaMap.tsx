import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { MAP_HOME, MAP_MAX_SCALE, clampView, mapPoint, zoomTurnAbout, type MapBox, type MapView } from '../../core/area-map-view';
import * as copy from '../../core/copy';
import type { Destination } from '../../core/types';
import Glyph from './Glyph';

type Point = { x: number; y: number };

const WHEEL_STEP = 0.0015; // zoom per pixel of wheel travel
const BUTTON_ZOOM = 1.6;
const BUTTON_TURN = 45;

/** The stored map of the pack's area, to explore with a finger or a mouse: one
 *  finger drags it, two pinch to zoom and twist to turn it, a wheel zooms at
 *  the pointer, and round buttons do the same for anyone who cannot. The
 *  saved place sits at the middle by construction; each official place of
 *  last resort is placed from its own coordinates. Everything is drawn from
 *  bytes already on the phone, so it works the same with no signal. */
export default function AreaMap({ src, box, places }: { src: string; box: MapBox | null; places: Destination[] }) {
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
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const at = measure(event.clientX, event.clientY);
      setView((v) => zoomTurnAbout(v, at.x, at.y, Math.exp(-event.deltaY * WHEEL_STEP), 0, at.half));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const before = pointers.current.get(event.pointerId);
    if (!before) return;
    const now = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, now);
    const others = [...pointers.current].filter(([id]) => id !== event.pointerId).map(([, point]) => point);
    const { half } = measure(now.x, now.y);
    if (others.length === 0) {
      // One finger, or the mouse: drag.
      setView((v) => clampView({ ...v, x: v.x + now.x - before.x, y: v.y + now.y - before.y }, half));
      return;
    }
    // Two fingers. Each move event moves one finger, so the map zooms and turns
    // about the other, still finger: the change in their spacing is the zoom,
    // the change in the line between them the turn, and the ground under each
    // finger stays under it.
    const other = others[0];
    const factor = Math.hypot(now.x - other.x, now.y - other.y) / Math.max(1, Math.hypot(before.x - other.x, before.y - other.y));
    const turnRad = Math.atan2(now.y - other.y, now.x - other.x) - Math.atan2(before.y - other.y, before.x - other.x);
    const turn = (((turnRad * 180) / Math.PI + 540) % 360) - 180;
    const pivot = measure(other.x, other.y);
    setView((v) => zoomTurnAbout(v, pivot.x, pivot.y, factor, turn, half));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => pointers.current.delete(event.pointerId);

  // The buttons act about the middle of the frame.
  const fromButton = (factor: number, turn: number) => {
    const half = frame.current!.getBoundingClientRect().width / 2;
    setView((v) => zoomTurnAbout(v, 0, 0, factor, turn, half));
  };

  const layer = {
    transform: `translate(${view.x}px, ${view.y}px) rotate(${view.angle}deg) scale(${view.scale})`,
    // The markers undo the turn and the zoom, so they stay upright and one size.
    '--map-angle': `${view.angle}deg`,
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
      </div>
      <div className="area-map-controls">
        <p className="muted">{copy.MAP_HOW}</p>
        <button type="button" className="map-button" aria-label={copy.MAP_ZOOM_IN} disabled={view.scale >= MAP_MAX_SCALE} onClick={() => fromButton(BUTTON_ZOOM, 0)}>
          +
        </button>
        <button type="button" className="map-button" aria-label={copy.MAP_ZOOM_OUT} disabled={view.scale <= 1} onClick={() => fromButton(1 / BUTTON_ZOOM, 0)}>
          −
        </button>
        <button type="button" className="map-button" aria-label={copy.MAP_TURN} onClick={() => fromButton(1, BUTTON_TURN)}>
          ↻
        </button>
        <button type="button" className="map-button" aria-label={copy.MAP_NORTH_UP} onClick={() => setView(MAP_HOME)}>
          N
        </button>
      </div>
    </>
  );
}
