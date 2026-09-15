import * as copy from '../../core/copy';
import Glyph, { type GlyphKind } from '../components/Glyph';

/** The rehearsal kicker with its glyph, in the pack page's section-head
 *  treatment. One component, so every rehearsal screen opens the same way.
 *  The glyph is decorative: the word beside it is what is read. */
export default function Head({ kind = 'rehearse' }: { kind?: GlyphKind }) {
  return (
    <p className="pack-section-head rehearsal-head">
      <Glyph kind={kind} />
      <span className="kicker">{copy.REHEARSAL_LABEL}</span>
    </p>
  );
}
