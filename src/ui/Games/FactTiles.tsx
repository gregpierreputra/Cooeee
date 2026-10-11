import type { ReactNode } from 'react';

/** The three things to know before a game, each a big figure over a few
 *  words, in the game's own colour. One layout for every game's first screen.
 *  A figure may be a drawing, as the drill draws its clock, bag and door. */
export default function FactTiles({ facts, className }: { facts: { figure: ReactNode; label: string }[]; className?: string }) {
  return (
    <ul className={className ? `game-facts ${className}` : 'game-facts'}>
      {facts.map(({ figure, label }) => (
        <li key={label}>
          <span className="game-fact-figure figure">{figure}</span>{' '}
          <span className="game-fact-label">{label}</span>
        </li>
      ))}
    </ul>
  );
}
