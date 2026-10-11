import type { ReactNode } from 'react';
import Glyph, { type GlyphKind } from './Glyph';

/** One block of a pack tab: a glyph and a title in the head, an optional
 *  count, then its content. The tabs above do the hiding. `heading` makes the
 *  title an h2, for a screen whose sections are reached by heading. */
export default function Section({
  kind,
  title,
  count,
  heading = false,
  className,
  children,
}: {
  kind: GlyphKind;
  title: string;
  count?: number;
  heading?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const Title = heading ? 'h2' : 'span';
  return (
    <section className={className ? `pack-section ${className}` : 'pack-section'}>
      <div className="pack-section-head">
        <Glyph kind={kind} />
        <Title className="kicker">{title}</Title>
        {count === undefined ? null : <span className="section-count">{count}</span>}
      </div>
      {children}
    </section>
  );
}
