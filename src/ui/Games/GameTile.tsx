import type { ReactNode } from 'react';
import Glyph, { type GlyphKind } from '../components/Glyph';

type Props = {
  /** Which game: each wears its own colour, set in theme.css. */
  variant: 'drill' | 'word' | 'block';
  glyph: GlyphKind;
  title: string;
  detail: string;
  /** A rule of the game for now, such as the drill's twist: a line in the
   *  game's colour, kept apart from the pills, which are the person's own. */
  note?: string;
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
export default function GameTile({ variant, glyph, title, detail, note, pills, children, onPlay }: Props) {
  return (
    <button type="button" className={`game-tile ${variant}-tile`} onClick={onPlay}>
      <Glyph kind={glyph} />
      <span className="game-tile-text">
        <span className="game-tile-title">{title}</span>
        <span className="game-tile-detail">{detail}</span>
        {note ? (
          <span className="game-tile-note with-glyph">
            <Glyph kind="clock" line />
            {note}
          </span>
        ) : null}
        {pills.length > 0 ? (
          <span className="game-tile-pills">
            {pills.map((pill) => (
              <span key={pill} className="game-tile-pill">
                {/* Every number in a pill is set bold, so the score is what is seen first. */}
                {pill.split(/(\d+)/).map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))}
              </span>
            ))}
          </span>
        ) : null}
        {children}
      </span>
      <span className="game-tile-go" aria-hidden="true">›</span>
    </button>
  );
}
