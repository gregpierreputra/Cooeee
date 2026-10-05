import { KEY_TERMS } from '../../core/copy';

// One capturing group, so split() keeps each matched term at an odd index.
const pattern = (terms: readonly string[]) => new RegExp(`(${terms.join('|')})`);
const KEY_PATTERN = pattern(KEY_TERMS);

/** A line of copy with its key terms in the attention colour, so the words
 *  that matter are seen first. The words alone still carry the meaning. A line
 *  with its own terms, such as the tour's welcome, passes them with the class
 *  that colours them. */
export default function KeyTerms({
  text,
  terms,
  className = 'key-term',
}: {
  text: string;
  terms?: readonly string[];
  className?: string;
}) {
  return (
    <>
      {text.split(terms ? pattern(terms) : KEY_PATTERN).map((part, index) =>
        index % 2 === 1 ? (
          <strong key={index} className={className}>
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}
