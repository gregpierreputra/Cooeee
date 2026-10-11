import Glyph, { type GlyphKind } from '../components/Glyph';

type Props = {
  /** Which game: each wears its own colour, set in theme.css. */
  variant: 'drill' | 'word' | 'block';
  glyph: GlyphKind;
  title: string;
  detail: string;
  /** A third line: where the game stands today. Words only, never colour. */
  status?: string;
  onPlay: () => void;
};

/** A way into one of the games from the Rehearse screens: warm and coloured
 *  where every other row there is neutral, with its own glyph and a way on,
 *  so it reads as a different thing to do, not one more choice. */
export default function GameTile({ variant, glyph, title, detail, status, onPlay }: Props) {
  return (
    <button type="button" className={`game-tile ${variant}-tile`} onClick={onPlay}>
      <Glyph kind={glyph} />
      <span className="game-tile-text">
        <span className="game-tile-title">{title}</span>
        <span className="game-tile-detail">{detail}</span>
        {status ? <span className="game-tile-status">{status}</span> : null}
      </span>
      <span className="game-tile-go" aria-hidden="true">›</span>
    </button>
  );
}
