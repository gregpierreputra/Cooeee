import * as copy from '../../core/copy';
import Glyph from '../components/Glyph';

/** E7-US4 — the way back into the drill from the Rehearse screens, at any
 *  time. Drawn unlike every other row there (amber, a flame, its own line), so
 *  it reads as a different thing to do rather than one more choice. */
export default function DrillTile({ onPlay }: { onPlay: () => void }) {
  return (
    <button type="button" className="drill-tile" onClick={onPlay}>
      <Glyph kind="drill" />
      <span className="drill-tile-text">
        <span className="drill-tile-title">{copy.DRILL_TILE_TITLE}</span>
        <span className="drill-tile-detail">{copy.DRILL_TILE_DETAIL}</span>
      </span>
      <span className="drill-tile-go" aria-hidden="true">›</span>
    </button>
  );
}
