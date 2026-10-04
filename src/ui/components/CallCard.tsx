import { useEffect, useRef, useState } from 'react';
import { COPY_CONFIRM_MS } from '../../core/constants';
import * as copy from '../../core/copy';
import Glyph from './Glyph';

/** Clears the one card now saying Copied or Not copied, so a copy on another
 *  card never leaves two cards claiming the clipboard. */
let clearShownCard: (() => void) | null = null;

/** Red for danger, amber for caution: the colours the app already uses. */
const TONE_CLASS = { danger: 'emergency-line', caution: 'caution-line' } as const;

/** One number to call: who answers, the number large enough to read out, then
 *  Call and Copy side by side. Copy is for a number to text to someone or dial
 *  from another phone. The button says what happened for a few seconds and
 *  then reads Copy again: it reports a moment, not what the clipboard holds
 *  later. A danger card (000) carries the red rule and the screen's one filled
 *  button. A caution card (the hotline) carries the amber rule: important,
 *  but not the number to call in danger. */
export default function CallCard({
  name,
  detail,
  number,
  tone,
}: {
  name: string;
  detail?: string;
  number: string;
  tone?: 'danger' | 'caution';
}) {
  const [copied, setCopied] = useState<'copied' | 'failed' | null>(null);
  const timer = useRef<number | undefined>(undefined);

  // Leaving the page stops the timer with the card.
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copyNumber() {
    let result: 'copied' | 'failed';
    try {
      await navigator.clipboard.writeText(number);
      result = 'copied';
    } catch {
      // No clipboard here (an old browser, or a page that is not secure).
      result = 'failed';
    }
    const clear = () => {
      window.clearTimeout(timer.current);
      setCopied(null);
    };
    clearShownCard?.();
    clearShownCard = clear;
    setCopied(result);
    timer.current = window.setTimeout(clear, COPY_CONFIRM_MS);
  }

  const copyLabel = copied === 'copied' ? copy.COPIED : copied === 'failed' ? copy.NOT_COPIED : copy.COPY;

  return (
    <li className={tone ? `card call-card ${TONE_CLASS[tone]}` : 'card call-card'}>
      <div className="card-head">
        <Glyph kind="calls" />
        <div>
          <h3>{name}</h3>
          {detail ? <p className="muted">{detail}</p> : null}
        </div>
      </div>
      <p className="call-number figure">{number}</p>
      {/* The name is read with each button, so a screen reader's list of
          controls says whose number it is, not Call, Call, Call. */}
      <div className="program-actions">
        <a
          className={tone === 'danger' ? 'action main-action with-glyph' : 'action call-button with-glyph'}
          href={`tel:${number.replaceAll(' ', '')}`}
        >
          <Glyph kind="calls" line />
          {copy.CALL}
          <span className="visually-hidden"> {name}</span>
        </a>
        <button type="button" className="action with-glyph" onClick={() => void copyNumber()}>
          <Glyph kind={copied === 'copied' ? 'check' : 'copy'} line />
          {copyLabel}
          <span className="visually-hidden"> {name}</span>
        </button>
      </div>
      <p className="visually-hidden" role="status">
        {copied === 'copied' ? copy.NUMBER_COPIED(name) : ''}
      </p>
    </li>
  );
}
