import { useState } from 'react';
import * as copy from '../core/copy';
import Glyph, { type GlyphKind } from './components/Glyph';
import InfoGlyph from './components/InfoGlyph';
import KeyTerms from './components/KeyTerms';
import Mark from './components/Mark';

/** E1-US1-AC0. The first screen anyone sees, and the only one that stands
 *  between a fresh install and the app. It states in full what Cooeee does,
 *  what it does not do, where the address goes and when the position is asked —
 *  as on-screen text, not behind a link — and it cannot be passed without the
 *  box being ticked.
 *
 *  It makes no network request and asks for no position. There is nothing here
 *  to fetch: every string is in the bundle and every drawing is inline. */
export default function FirstOpen({ onAcknowledge }: { onAcknowledge: () => void }) {
  // The ONLY state on this screen. The button's disabled attribute is bound to
  // this same value, so there is no second flag that could disagree with the
  // box the user is looking at.
  const [accepted, setAccepted] = useState(false);

  // One statement per row. The drawing is a picture of the sentence beside it
  // and carries nothing the sentence does not already say, so it is hidden
  // from assistive technology; the four statements remain the on-screen text
  // the criterion asks for, unchanged and unabbreviated. The drawings are the
  // tour's own for the same ideas, and never a lock: the address is kept on
  // the phone, not locked.
  const statements: { heading: string; body: string; glyph: GlyphKind }[] = [
    { heading: copy.DISCLOSURE_DOES_HEADING, body: copy.DISCLOSURE_DOES, glyph: 'does' },
    { heading: copy.DISCLOSURE_DOES_NOT_HEADING, body: copy.DISCLOSURE_DOES_NOT, glyph: 'not' },
    { heading: copy.DISCLOSURE_ADDRESS_HEADING, body: copy.DISCLOSURE_ADDRESS, glyph: 'stays' },
    { heading: copy.DISCLOSURE_POSITION_HEADING, body: copy.DISCLOSURE_POSITION, glyph: 'locate' },
  ];

  return (
    <main className="page first-open">
      <header className="hero first-open-hero">
        {/* Decorative: the wordmark beside it carries the name in text. In its
            ring, as on the welcome before it. */}
        <span className="first-open-mark">
          <Mark className="mark" size={40} />
        </span>
        <h1>{copy.APP_NAME}</h1>
        <p className="muted welcome-tagline">{copy.FIRST_OPEN_PURPOSE}</p>
      </header>

      {/* ONE card, four rows, a hairline between them: the four statements are
          one disclosure, and reading them takes little or no scrolling on a
          phone. The card is the product's standard card — only the container
          changed, never a word inside it. */}
      <ul className="list disclosure-list card">
        {statements.map(({ heading, body, glyph }) => (
          <li key={heading} className="disclosure-row">
            <Glyph kind={glyph} />
            <h2>{heading}</h2>
            <p className="muted">{body}</p>
          </li>
        ))}
      </ul>

      <p className="official-channels emergency-line">
        <InfoGlyph size={22} />
        {/* The number to call stands out in bold within the red line, in the
            line's own colour: amber is for caution, not an emergency. */}
        <span>
          <KeyTerms text={copy.OFFICIAL_CHANNELS_LINE} terms={[copy.TRIPLE_ZERO_LABEL]} className="emergency-term" />
        </span>
      </p>

      <div className="actions">
        {/* The box is the one thing standing between the reader and the app,
            so it is framed as a step of its own: a kicker naming it, an
            accent border, and a line under the inactive button saying what
            makes it active. */}
        <div className="acknowledge">
          <span className="kicker">{copy.BEFORE_YOU_CONTINUE}</span>
          <input
            id="acknowledge"
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.currentTarget.checked)}
          />
          <label htmlFor="acknowledge">{copy.ACKNOWLEDGE_CHECKBOX}</label>
        </div>
        <button
          type="button"
          className="action main-action"
          disabled={!accepted}
          aria-describedby={accepted ? undefined : 'acknowledge-hint'}
          onClick={onAcknowledge}
        >
          {copy.CONTINUE}
        </button>
        {accepted ? null : (
          <p id="acknowledge-hint" className="acknowledge-hint" role="status">
            {copy.ACKNOWLEDGE_HINT}
          </p>
        )}
      </div>
    </main>
  );
}
