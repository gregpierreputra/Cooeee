import * as copy from '../../core/copy';
import type { PackIcon } from '../../core/types';
import Glyph, { type GlyphKind } from '../components/Glyph';
import TabLabel from '../components/TabLabel';

/** The Rehearse tab's label, set as Recover and Nearby open: the tab's name in
 *  teal capitals with its bar drawing, then the screen's large title where it has one. One
 *  component, so every rehearsal screen opens the same way. */
export default function Head({
  title,
  detail,
  detailGlyph,
  pack,
}: {
  title?: string;
  detail?: string;
  /** A drawing to lead the line under the title, where it states a fact. */
  detailGlyph?: GlyphKind;
  /** The pack being rehearsed, led by its own drawing and in the teal its name
   *  wears on Rehearse, so it reads as the pack and not as a note. */
  pack?: { name: string; icon: PackIcon };
}) {
  return (
    <header className="hero">
      <TabLabel tab="rehearse" text={copy.NAV_REHEARSE} />
      {title ? <h1>{title}</h1> : null}
      {pack?.name ? (
        <p className="hero-pack with-glyph">
          <span className="hero-pack-lead">{copy.REHEARSING_PACK}</span>
          <Glyph kind={pack.icon} line />
          <span className="pack-name">{pack.name}</span>
        </p>
      ) : null}
      {detail ? (
        <p className={detailGlyph ? 'muted with-glyph' : 'muted'}>
          {detailGlyph ? <Glyph kind={detailGlyph} line /> : null}
          {detail}
        </p>
      ) : null}
    </header>
  );
}
