import type { ReactNode } from 'react';
import Glyph, { type GlyphKind } from '../components/Glyph';

type Props = {
  /** Which game: each wears its own colour, set in theme.css. */
  variant: 'drill' | 'word' | 'block';
  glyph: GlyphKind;
  title: string;
  detail: string;
  /** Where the game stands, each in a small pill of the game's colour. Words
   *  only, never colour alone. */
  pills: string[];
  /** A picture under the pills, such as the Word card's week of dots. */
  children?: ReactNode;
  onPlay: () => void;
};

/** A way into one of the games from the Rehearse screens: warm and coloured
 *  where every other row there is neutral, with its own glyph and a way on,
 *  so it reads as a different thing to do, not one more choice. */
export default function GameTile({ variant, glyph, title, detail, pills, children, onPlay }: Props) {
  return (
    <button type="button" className={`game-tile ${variant}-tile`} onClick={onPlay}>
      <Glyph kind={glyph} />
      <span className="game-tile-text">
        <span className="game-tile-title">{title}</span>
        <span className="game-tile-detail">{detail}</span>
        {pills.length > 0 ? (
          <span className="game-tile-pills">
            {pills.map((pill) => (
              <span key={pill} className="game-tile-pill">{pill}</span>
            ))}
          </span>
        ) : null}
        {children}
      </span>
      <span className="game-tile-go" aria-hidden="true">›</span>
    </button>
  );
}
