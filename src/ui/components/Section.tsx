import type { ReactNode } from 'react';
import Glyph, { type GlyphKind } from './Glyph';

/** One block of a pack tab: a glyph and a title in the head, an optional
 *  count, then its content. The tabs above do the hiding. */
export default function Section({
  kind,
  title,
  count,
  children,
}: {
  kind: GlyphKind;
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="pack-section">
      <div className="pack-section-head">
        <Glyph kind={kind} />
        <span className="kicker">{title}</span>
        {count === undefined ? null : <span className="section-count">{count}</span>}
      </div>
      {children}
    </section>
  );
}
