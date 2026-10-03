import { KEY_TERMS } from '../../core/copy';

// One capturing group, so split() keeps each matched term at an odd index.
const PATTERN = new RegExp(`(${KEY_TERMS.join('|')})`);

/** A line of copy with its key terms in the attention colour, so the words
 *  that matter are seen first. The words alone still carry the meaning. */
export default function KeyTerms({ text }: { text: string }) {
  return (
    <>
      {text.split(PATTERN).map((part, index) =>
        index % 2 === 1 ? (
          <strong key={index} className="key-term">
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}
