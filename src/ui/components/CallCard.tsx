import * as copy from '../../core/copy';
import Glyph from './Glyph';
import { useCopied } from './useCopied';

/** Red for an emergency, amber for caution: the colours the app already uses. */
const TONE_CLASS = { emergency: 'emergency-line', caution: 'caution-line' } as const;

/** One number to call: who answers with Copy beside the name, then Call across
 *  the card, carrying the number in large figures so it can be read out. Copy is for a number to text to someone or dial
 *  from another phone. The button says what happened for a few seconds and
 *  then reads Copy again: it reports a moment, not what the clipboard holds
 *  later. The emergency card (000) carries the red rule and the screen's one filled
 *  button. A caution card (the hotline) carries the amber rule: important,
 *  but not the number to call in an emergency. */
export default function CallCard({
  name,
  detail,
  number,
  tone,
}: {
  name: string;
  detail?: string;
  number: string;
  tone?: 'emergency' | 'caution';
}) {
  const [copied, showCopied] = useCopied();

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(number);
      showCopied('copied');
    } catch {
      // No clipboard here (an old browser, or a page that is not secure).
      showCopied('failed');
    }
  }

  const copyLabel = copied === 'copied' ? copy.COPIED : copied === 'failed' ? copy.NOT_COPIED : copy.COPY;

  return (
    <li className={tone ? `card call-card ${TONE_CLASS[tone]}` : 'card call-card'}>
      {/* In the order they are seen: the name and Copy on one row, what the
          line is for, then Call. The name is read with each button, so a
          screen reader's list of controls says whose number it is. */}
      <h3>{name}</h3>
      <button type="button" className="action with-glyph call-copy" onClick={() => void copyNumber()}>
        <Glyph kind={copied === 'copied' ? 'check' : 'copy'} line />
        {copyLabel}
        <span className="visually-hidden"> {name}</span>
      </button>
      {detail ? <p className="muted">{detail}</p> : null}
      <a
        className={tone === 'emergency' ? 'action main-action with-glyph call-link' : 'action call-button with-glyph call-link'}
        href={`tel:${number.replaceAll(' ', '')}`}
      >
        <Glyph kind="calls" line />
        {copy.CALL}
        <span className="visually-hidden"> {name}</span>
        <span className="call-number figure">{number}</span>
      </a>
      <p className="visually-hidden" role="status">
        {copied === 'copied' ? copy.NUMBER_COPIED(name) : ''}
      </p>
    </li>
  );
}
