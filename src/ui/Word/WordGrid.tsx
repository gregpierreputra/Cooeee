import * as copy from '../../core/copy';
import { WORD_GUESSES, markGuess } from '../../core/word';

/** The six rows of guesses. Each finished row is read out as one line ("E,
 *  right place; M, not in the word; ..."), and each letter's mark is drawn
 *  as a shape as well as a colour, so it reads in greyscale too. */
export default function WordGrid({ answer, guesses, typed }: { answer: string; guesses: string[]; typed: string }) {
  const length = answer.length;
  return (
    <ol className="word-grid" aria-label={copy.WORD_GRID_LABEL} style={{ ['--word-length' as string]: length }}>
      {Array.from({ length: WORD_GUESSES }, (_, row) => {
        const guess = guesses[row];
        if (guess) {
          const marks = markGuess(guess, answer);
          const label = `${copy.WORD_ROW_LABEL(row + 1)}: ${marks
            .map((mark, i) => copy.LETTER_LABEL(guess[i], copy.LETTER_MARK[mark]))
            .join('; ')}`;
          return (
            <li key={row} className="word-row" aria-label={label}>
              {[...guess].map((letter, i) => (
                <span key={i} className={`word-cell mark-${marks[i]}`} aria-hidden="true">
                  {letter.toUpperCase()}
                </span>
              ))}
            </li>
          );
        }
        const current = row === guesses.length;
        const letters = current ? typed : '';
        return (
          <li
            key={row}
            className={current ? 'word-row current' : 'word-row'}
            aria-label={`${copy.WORD_ROW_LABEL(row + 1)}: ${letters ? letters.toUpperCase().split('').join(' ') : copy.WORD_EMPTY}`}
          >
            {Array.from({ length }, (_, i) => (
              <span key={i} className={letters[i] ? 'word-cell typed' : 'word-cell'} aria-hidden="true">
                {letters[i]?.toUpperCase() ?? ''}
              </span>
            ))}
          </li>
        );
      })}
    </ol>
  );
}
