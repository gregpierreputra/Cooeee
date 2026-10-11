import * as copy from '../../core/copy';
import type { Mark } from '../../core/word';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

/** A tapped or clicked key does not take the focus, so Enter on a keyboard
 *  afterwards still enters the guess rather than pressing that key again. A
 *  key reached with Tab is pressed by Enter, as any button is. */
const keepFocus = (event: { preventDefault: () => void }) => event.preventDefault();

/** Large keys for the letters, with Enter and Delete named in words. A key
 *  says what is known of its letter, in its name and its shape. */
export default function WordKeyboard({ marks, onKey }: { marks: Record<string, Mark>; onKey: (key: string) => void }) {
  return (
    <div className="word-keyboard" role="group" aria-label={copy.WORD_KEYBOARD_LABEL}>
      {ROWS.map((row, i) => (
        <div key={row} className="word-keys">
          {i === 2 ? (
            <button type="button" className="word-key wide" onMouseDown={keepFocus} onClick={() => onKey('Enter')}>
              {copy.WORD_ENTER}
            </button>
          ) : null}
          {[...row].map((letter) => {
            const mark = marks[letter];
            return (
              <button
                key={letter}
                type="button"
                className={mark ? `word-key mark-${mark}` : 'word-key'}
                aria-label={mark ? copy.LETTER_LABEL(letter, copy.LETTER_MARK[mark]) : letter.toUpperCase()}
                onMouseDown={keepFocus}
                onClick={() => onKey(letter)}
              >
                {letter.toUpperCase()}
              </button>
            );
          })}
          {i === 2 ? (
            <button type="button" className="word-key wide" aria-label={copy.WORD_DELETE} onMouseDown={keepFocus} onClick={() => onKey('Backspace')}>
              <span aria-hidden="true">⌫</span>
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
