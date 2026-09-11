import { useState, type ReactNode } from 'react';
import * as copy from '../../core/copy';
import Glyph, { type GlyphKind } from './Glyph';

/** One block of the pack page: a glyph and a title in the head, one control
 *  that shows or hides everything beneath, and an optional count. Open or
 *  closed lives in component state for the visit only. */
export default function Section({
  kind,
  title,
  count,
  defaultOpen = true,
  children,
}: {
  kind: GlyphKind;
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="pack-section">
      <div className="pack-section-head">
        <Glyph kind={kind} />
        <span className="kicker">{title}</span>
        {count === undefined ? null : <span className="section-count">{count}</span>}
        <button
          type="button"
          className="section-toggle"
          aria-expanded={open}
          aria-label={open ? copy.HIDE_SECTION(title) : copy.SHOW_SECTION(title)}
          onClick={() => setOpen(!open)}
        >
          {open ? copy.HIDE : copy.SHOW}
        </button>
      </div>
      {open ? children : null}
    </section>
  );
}
