import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { MAP_HOME, MAP_MAX_SCALE, clampView, mapPoint, zoomAbout, type MapBox, type MapView } from '../../core/area-map-view';
import { siteNameBlock } from '../../core/blacksky-dial';
import * as copy from '../../core/copy';
import { formatDistanceM, placeName } from '../../core/destination';
import type { Destination } from '../../core/types';
import Glyph, { type GlyphKind } from './Glyph';

type Point = { x: number; y: number };

/** One place on the map. Nearby marks two kinds, so a place can carry its own
 *  drawing and the kind its label names; a pack's places use the defaults. */
export type MapPlace = Pick<Destination, 'id' | 'name' | 'lat' | 'lon' | 'distanceM'> & { glyph?: GlyphKind; kind?: string };

const WHEEL_STEP = 0.01; // zoom per pixel of wheel travel, with Ctrl held or a trackpad pinch
const WHEEL_MAX = 50; // one wheel notch zooms about as much as a button press
const KEY_PAN = 48; // pixels an arrow key moves the map
const BUTTON_ZOOM = 1.6;
// css pixels a marker's label needs above it, and to each side of its middle,
// before it would run past the map's edge
const LABEL_ROOM_Y = 90;
const LABEL_ROOM_X = 110;

/** The stored map of the pack's area, to explore with a finger or a mouse: one
 *  finger drags it, two pinch to zoom, a wheel zooms at the pointer, and round
 *  buttons zoom for anyone who cannot. North stays up, and the picture always
 *  fills the frame, as nothing was saved past its edge. The
 *  saved place sits at the middle by construction; each official place of
 *  last resort is placed from its own coordinates. Everything is drawn from
 *  bytes already on the phone, so it works the same with no signal. */
export default function AreaMap({
  src,
  picture,
  box,
  places,
  address,
  hereTitle = copy.AREA_MAP_KEY.place,
  scale,
}: {
  /** The stored picture, or, in its place, a picture drawn on the phone. */
  src?: string;
  picture?: ReactNode;
  box: MapBox | null;
  places: MapPlace[];
  /** The centre marker's line and name: the saved place's address, or where
   *  Nearby measures from. */
  address: string;
  hereTitle?: string;
  /** How far the map reaches, shown in its corner as a map's scale is. */
  scale?: string;
}) {
  const howId = useId();
  // The marker whose label is open: 'here' for the saved place, or a place id.
  const [labelled, setLabelled] = useState<string | null>(null);
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
    setLabelled(null); // a press on the map itself closes an open label
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
          {picture ?? <img src={src} alt={copy.AREA_MAP_ALT} draggable={false} />}
          <Marker
            id="here"
            className="area-map-pin"
            title={hereTitle}
            line={address || null}
            labelled={labelled}
            onLabel={setLabelled}
          />
          {places.map((place) => {
            const at = !box || place.lat === undefined || place.lon === undefined ? null : mapPoint(box, { lat: place.lat, lon: place.lon });
            if (!at) return null;
            const { site, line } = siteNameBlock(placeName(place));
            return (
              <Marker
                key={place.id}
                id={place.id}
                className="area-map-mark"
                at={at}
                title={typeof place.distanceM === 'number' ? `${site} · ${formatDistanceM(place.distanceM)}` : site}
                line={place.kind ?? line}
                labelled={labelled}
                onLabel={setLabelled}
              >
                <Glyph kind={place.glyph ?? 'place'} size={16} />
              </Marker>
            );
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

/** One marker on the map, a button named after its place. A tap opens a small
 *  label above it, never a hover; a second tap, or a press on the map,
 *  closes it. The label sits inside the marker, so it keeps the marker's size at any
 *  zoom and moves with the map. A press here never starts a drag. */
function Marker({
  id,
  className,
  at,
  title,
  line,
  labelled,
  onLabel,
  children,
}: {
  id: string;
  className: string;
  /** Where it sits, as fractions of the picture; the saved place is the middle. */
  at?: { x: number; y: number };
  title: string;
  line: string | null;
  labelled: string | null;
  onLabel: (id: string | null) => void;
  children?: ReactNode;
}) {
  const open = labelled === id;
  // Where the label opens, chosen as it opens so it stays inside the map:
  // below a marker near the top edge, and held to a side near either edge.
  const [place, setPlace] = useState('');
  const choosePlace = (marker: HTMLElement) => {
    const frame = marker.closest('.area-map-frame')?.getBoundingClientRect();
    const at = marker.getBoundingClientRect();
    if (!frame) return;
    const below = at.top - frame.top < LABEL_ROOM_Y ? ' below' : '';
    const side = at.left - frame.left < LABEL_ROOM_X ? ' start' : frame.right - at.right < LABEL_ROOM_X ? ' end' : '';
    setPlace(below + side);
  };
  return (
    <button
      type="button"
      className={`area-map-marker ${className}`}
      style={at ? { left: `${at.x * 100}%`, top: `${at.y * 100}%` } : undefined}
      aria-label={line ? `${title}, ${line}` : title}
      aria-expanded={open}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        if (!open) choosePlace(event.currentTarget);
        onLabel(open ? null : id);
      }}
    >
      {children}
      {open ? (
        <span className={`area-map-label${place}`} aria-hidden="true">
          <b>{title}</b>
          {line ? <span>{line}</span> : null}
        </span>
      ) : null}
    </button>
  );
}
