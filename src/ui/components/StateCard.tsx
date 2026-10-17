import type { ReactNode } from 'react';
import Glyph, { type GlyphKind } from './Glyph';

/** The one card treatment. Presence and absence use it identically, so an
 *  absence never renders as an error and never renders as reassurance. A
 *  glyph marks a card about the phone's own state, such as its location,
 *  outlined so it stands apart from the cards about what is saved. */
export default function StateCard({
  heading,
  detail,
  glyph,
  children,
}: {
  heading: string;
  detail?: string;
  glyph?: GlyphKind;
  children?: ReactNode;
}) {
  return (
    <section className={glyph ? 'card state-card-status' : 'card'}>
      {glyph ? (
        <h2 className="with-glyph">
          <Glyph kind={glyph} line />
          {heading}
        </h2>
      ) : (
        <h2>{heading}</h2>
      )}
      {detail ? <p className="muted">{detail}</p> : null}
      {children}
    </section>
  );
}
