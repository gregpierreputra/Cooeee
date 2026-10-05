import type { Choice } from '../../core/recover';
import type { PackIcon } from '../../core/types';

/** One line drawing per kind: the six needs, every program, kept, and the pack
 *  page's sections. Drawn inline like the bottom bar's icons, so it costs no
 *  request and renders with the radios off. Decorative: the words beside it
 *  are the accessible ones. */
export type GlyphKind =
  | Choice
  | 'map' | 'layer' | 'place' | 'note'
  | 'what' | 'why' | 'does' | 'not' | 'stays' | 'relief' | 'locate'
  | 'rehearse' | 'go' | 'found' | 'drill' | 'door' | 'bag'
  | 'plus' | 'trash' | 'clock' | 'lock' | 'share' | 'print' | 'online' | 'offline'
  | 'caution' | 'web' | 'tour' | 'moon' | 'copy' | 'check' | 'edit' | 'close'
  | Exclude<PackIcon, 'place'>;

const GLYPH_PATHS: Record<GlyphKind, string> = {
  stay: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  money: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5M6 12h.01M18 12h.01',
  food: 'M5 4h11v9a5.5 5.5 0 0 1-11 0zM16 7h2a2.5 2.5 0 0 1 0 5h-2M4 21h13',
  property: 'M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.3 2.3-2.4-2.4z',
  health: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  documents: 'M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h5M9.5 16h5',
  all: 'M5 7h14M5 12h14M5 17h14',
  kept: 'M7 4h10v17l-5-3.5L7 21z',
  // A winding way between a start and an end: the recovery roadmap.
  roadmap: 'M6 19a2 2 0 1 0 0 .01M18 5a2 2 0 1 0 0 .01M8 19h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7',
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  layer: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  place: 'M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11zM12 7.8a2.2 2.2 0 1 0 0 4.4a2.2 2.2 0 1 0 0-4.4',
  note: 'M4 20h4l11-11-4-4L4 16zM13 7l4 4',
  what: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17M12 11v5.5M12 7.75v.01',
  why: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17v.01',
  does: 'M5 12.5l4.5 4.5L19 7.5',
  not: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17M6 6l12 12',
  stays: 'M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5zM11 18h2',
  relief: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM12 10v6M9 13h6',
  locate: 'M12 3v3M12 18v3M3 12h3M18 12h3M12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9',
  // E5 Rehearsal: a replay arrow, the same drawing as the bar's Rehearse.
  rehearse: 'M4 12a8 8 0 1 1 2.3 5.7M4 18v-4h4M12 8v4l2.5 2.5',
  // Going: an arrow leaving a starting point.
  go: 'M5 12h13M13 6l6 6-6 6M5 7v10',
  door: 'M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21M3 21h18M14.5 12.5h.01',
  bag: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2',
  drill: 'M12 21c-3.9 0-6.5-2.7-6.5-6.2 0-3.3 2.4-5.4 3.8-8.3.5 2 1.6 3.2 2.9 3.8.3-2.7 1.4-4.8 3.3-6.3.2 3.3 3 5.5 3 9.2 0 4.3-2.6 7.8-6.5 7.8zM12 21c-1.7 0-3-1.3-3-3 0-1.9 1.6-2.8 2.4-4.4.9 1.1 3.6 2.2 3.6 4.5 0 1.6-1.2 2.9-3 2.9z',
  // What was found: a magnifier.
  found: 'M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13M15.5 15.5 20 20',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6',
  clock: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17M12 7.5V12l3 2',
  lock: 'M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  share: 'M12 15V3.5M8 7.5l4-4 4 4M5 12v8h14v-8',
  print: 'M7 9V4h10v5M7 17H4V9h16v8h-3M7 14h10v7H7z',
  online: 'M4 9.5a12 12 0 0 1 16 0M7 12.8a7.5 7.5 0 0 1 10 0M10 16a3 3 0 0 1 4 0M12 19.5v.01',
  offline: 'M4 9.5a12 12 0 0 1 16 0M7 12.8a7.5 7.5 0 0 1 10 0M10 16a3 3 0 0 1 4 0M12 19.5v.01M4 4l16 16',
  caution: 'M12 4 21 20H3zM12 10v4.5M12 17.5v.01',
  web: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5',
  tour: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17M10 8.5v7l5.5-3.5z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  calls: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  copy: 'M9 9h11v11H9zM15 9V4H4v11h5',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  // The pack drawings (the pin is 'place' above).
  home: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  work: 'M3 8h18v11H3zM9 8V5h6v3M3 13h18',
  family: 'M9 11a3 3 0 1 0 0-6a3 3 0 1 0 0 6M3 20a6 6 0 0 1 12 0M16.5 11a2.5 2.5 0 1 0 0-5M16 14.2a5 5 0 0 1 5 5.8',
  holiday: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  school: 'M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5M22 9v6',
  // A wheat ear, in open strokes: a barn read as a second house at this size.
  farm: 'M12 22V3M12 7.5 8 4M12 7.5l4-3.5M12 12.5 6.5 8.5M12 12.5l5.5-4M12 17.5 5.5 13M12 17.5l6.5-4.5',
  close: 'M6 6l12 12M18 6 6 18',
};

/** `line` drops the tinted circle, for a glyph inside a button or a line of text. */
export default function Glyph({ kind, size = 22, line = false }: { kind: GlyphKind; size?: number; line?: boolean }) {
  return (
    <span className={line ? 'glyph line-glyph' : 'glyph'}>
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d={GLYPH_PATHS[kind]} />
      </svg>
    </span>
  );
}
