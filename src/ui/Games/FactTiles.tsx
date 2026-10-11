/** The three things to know before a game, each a big figure over a few
 *  words, in the game's own colour. One layout for every game's first screen. */
export default function FactTiles({ facts }: { facts: { figure: string; label: string }[] }) {
  return (
    <ul className="game-facts">
      {facts.map(({ figure, label }) => (
        <li key={label}>
          <span className="game-fact-figure figure">{figure}</span>{' '}
          <span className="game-fact-label">{label}</span>
        </li>
      ))}
    </ul>
  );
}
