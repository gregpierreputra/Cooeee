import type { Choice } from '../../core/recover';

/** One line drawing per Recover choice: the six needs, every program, kept.
 *  Drawn inline like the bottom bar's icons, so it costs no request and renders
 *  with the radios off. Decorative: the phrase beside it is the accessible one. */
const GLYPH_PATHS: Record<Choice, string> = {
  stay: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  money: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5M6 12h.01M18 12h.01',
  food: 'M5 4h11v9a5.5 5.5 0 0 1-11 0zM16 7h2a2.5 2.5 0 0 1 0 5h-2M4 21h13',
  property: 'M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.3 2.3-2.4-2.4z',
  health: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  documents: 'M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h5M9.5 16h5',
  all: 'M5 7h14M5 12h14M5 17h14',
  kept: 'M7 4h10v17l-5-3.5L7 21z',
};

export default function ChoiceGlyph({ choice }: { choice: Choice }) {
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
        <path d={GLYPH_PATHS[choice]} />
      </svg>
    </span>
  );
}
