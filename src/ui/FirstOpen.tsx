import { useState } from 'react';
import * as copy from '../core/copy';

/** E1-US1-AC0. The first screen anyone sees, and the only one that stands
 *  between a fresh install and the app. It states in full what Cooeee does,
 *  what it does not do, where the address goes and when the position is asked —
 *  as on-screen text, not behind a link — and it cannot be passed without the
 *  box being ticked.
 *
 *  It makes no network request and asks for no position. There is nothing here
 *  to fetch: every string is in the bundle and the mark is a precached icon. */
export default function FirstOpen({ onAcknowledge }: { onAcknowledge: () => void }) {
  // The ONLY state on this screen. The button's disabled attribute is bound to
  // this same value, so there is no second flag that could disagree with the
  // box the user is looking at.
  const [accepted, setAccepted] = useState(false);

  const statements = [
    { heading: copy.DISCLOSURE_DOES_HEADING, body: copy.DISCLOSURE_DOES },
    { heading: copy.DISCLOSURE_DOES_NOT_HEADING, body: copy.DISCLOSURE_DOES_NOT },
    { heading: copy.DISCLOSURE_ADDRESS_HEADING, body: copy.DISCLOSURE_ADDRESS },
    { heading: copy.DISCLOSURE_POSITION_HEADING, body: copy.DISCLOSURE_POSITION },
  ];

  return (
    <main className="page first-open">
      <header className="hero first-open-hero">
        {/* Decorative: the wordmark beside it carries the name in text. */}
        <img className="mark" src="/icons/icon-192.png" alt="" width={56} height={56} />
        <h1>{copy.APP_NAME}</h1>
        <p className="muted">{copy.FIRST_OPEN_PURPOSE}</p>
      </header>

      <ul className="list disclosure-list">
        {statements.map(({ heading, body }) => (
          <li key={heading} className="card">
            <h2>{heading}</h2>
            <p>{body}</p>
          </li>
        ))}
      </ul>

      <p className="muted official-channels">{copy.OFFICIAL_CHANNELS_LINE}</p>

      <div className="actions">
        <div className="acknowledge">
          <input
            id="acknowledge"
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.currentTarget.checked)}
          />
          <label htmlFor="acknowledge">{copy.ACKNOWLEDGE_CHECKBOX}</label>
        </div>
        <button
          type="button"
          className="action main-action"
          disabled={!accepted}
          onClick={onAcknowledge}
        >
          {copy.CONTINUE}
        </button>
      </div>
    </main>
  );
}
