import { useState, type ReactNode } from 'react';
import * as copy from '../core/copy';
import Mark from './components/Mark';

/** E1-US1-AC0. The first screen anyone sees, and the only one that stands
 *  between a fresh install and the app. It states in full what Cooeee does,
 *  what it does not do, where the address goes and when the position is asked —
 *  as on-screen text, not behind a link — and it cannot be passed without the
 *  box being ticked.
 *
 *  It makes no network request and asks for no position. There is nothing here
 *  to fetch: every string is in the bundle and every drawing is inline. */
export default function FirstOpen({ onAcknowledge }: { onAcknowledge: () => void }) {
  // The ONLY state on this screen. The button's disabled attribute is bound to
  // this same value, so there is no second flag that could disagree with the
  // box the user is looking at.
  const [accepted, setAccepted] = useState(false);

  // One statement per row. The icon is a picture of the sentence beside it and
  // carries nothing the sentence does not already say, so it is hidden from
  // assistive technology; the four statements remain the on-screen text the
  // criterion asks for, unchanged and unabbreviated.
  const statements = [
    { heading: copy.DISCLOSURE_DOES_HEADING, body: copy.DISCLOSURE_DOES, icon: <SavesIcon /> },
    {
      heading: copy.DISCLOSURE_DOES_NOT_HEADING,
      body: copy.DISCLOSURE_DOES_NOT,
      icon: <DoesNotIcon />,
    },
    {
      heading: copy.DISCLOSURE_ADDRESS_HEADING,
      body: copy.DISCLOSURE_ADDRESS,
      icon: <AddressIcon />,
    },
    {
      heading: copy.DISCLOSURE_POSITION_HEADING,
      body: copy.DISCLOSURE_POSITION,
      icon: <PositionIcon />,
    },
  ];

  return (
    <main className="page first-open">
      <header className="hero first-open-hero">
        {/* Decorative: the wordmark beside it carries the name in text. */}
        <Mark className="mark" size={44} />
        <h1>{copy.APP_NAME}</h1>
        <p className="muted">{copy.FIRST_OPEN_PURPOSE}</p>
      </header>

      {/* ONE card, four rows, a hairline between them: the four statements are
          one disclosure, and reading them takes little or no scrolling on a
          phone. The card is the product's standard card — only the container
          changed, never a word inside it. */}
      <ul className="list disclosure-list card">
        {statements.map(({ heading, body, icon }) => (
          <li key={heading} className="disclosure-row">
            <span className="disclosure-icon">{icon}</span>
            <h2>{heading}</h2>
            <p className="muted">{body}</p>
          </li>
        ))}
      </ul>

      <p className="official-channels">
        <InfoIcon />
        <span>{copy.OFFICIAL_CHANNELS_LINE}</span>
      </p>

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

/* The row icons. Same convention as the mark: inline, no request, a 24-unit
   box drawn in the current text colour, hidden from assistive technology. */

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** A page: the preparation pack this saves. */
function SavesIcon() {
  return (
    <Glyph>
      <path d="M13.5 2.5H7a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M13.5 2.5V8H19" />
      <path d="M8.5 13h7M8.5 17h5" />
    </Glyph>
  );
}

/** The struck-through circle: what this does not do. */
function DoesNotIcon() {
  return (
    <Glyph>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 6l12 12" />
    </Glyph>
  );
}

/** A padlock: where the address stays once it is saved. */
function AddressIcon() {
  return (
    <Glyph>
      <rect x="4.5" y="10.5" width="15" height="10.5" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15.75" r="1.25" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** A pin: the device position, asked for only where it is used. */
function PositionIcon() {
  return (
    <Glyph>
      <path d="M12 21.5s6.5-6 6.5-10.5a6.5 6.5 0 0 0-13 0C5.5 15.5 12 21.5 12 21.5Z" />
      <circle cx="12" cy="11" r="2.25" />
    </Glyph>
  );
}

/** The quieter note under the statements. */
function InfoIcon() {
  return (
    <Glyph>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.75" r="1" fill="currentColor" stroke="none" />
    </Glyph>
  );
}
