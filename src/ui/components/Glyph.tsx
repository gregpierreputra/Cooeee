import type { Choice } from '../../core/recover';

/** One line drawing per kind: the six needs, every program, kept, and the pack
 *  page's sections. Drawn inline like the bottom bar's icons, so it costs no
 *  request and renders with the radios off. Decorative: the words beside it
 *  are the accessible ones. */
export type GlyphKind =
  | Choice
  | 'map' | 'layer' | 'place' | 'note'
  | 'what' | 'why' | 'does' | 'not' | 'stays' | 'relief' | 'locate';

const GLYPH_PATHS: Record<GlyphKind, string> = {
  stay: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  money: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5M6 12h.01M18 12h.01',
  food: 'M5 4h11v9a5.5 5.5 0 0 1-11 0zM16 7h2a2.5 2.5 0 0 1 0 5h-2M4 21h13',
  property: 'M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.3 2.3-2.4-2.4z',
  health: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  documents: 'M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h5M9.5 16h5',
  all: 'M5 7h14M5 12h14M5 17h14',
  kept: 'M7 4h10v17l-5-3.5L7 21z',
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
  calls: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
};

export default function Glyph({ kind }: { kind: GlyphKind }) {
  return (
    <span className="glyph">
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
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
