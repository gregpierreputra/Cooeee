import { useState } from 'react';

import { NOTE_MAX_CHARS } from '../../core/constants';
import * as copy from '../../core/copy';

type NoteProps = {
  example: string;
  /** The note to keep, or undefined to go on without one. */
  onContinue: (text?: string) => void;
};

/** The personal-note step: one box, pre-filled with an example written for
 *  this place, and a plain way past it. Nothing is written here; the parent
 *  carries the text into the pack save. */
export function Note({ example, onContinue }: NoteProps) {
  const [text, setText] = useState(example);

  return (
    <main className="page note-page">
      <div className="confirm-content">
        <header className="hero">
          <span className="kicker">{copy.EYEBROW_SAVE_YOUR_PACK}</span>
          <h1>{copy.NOTE_STEP_TITLE}</h1>
          <p className="muted">{copy.NOTE_DISCLOSURE}</p>
        </header>
        <label htmlFor="pack-note">{copy.NOTE_LABEL}</label>
        <textarea
          id="pack-note"
          value={text}
          maxLength={NOTE_MAX_CHARS}
          onChange={(event) => setText(event.currentTarget.value)}
        />
      </div>
      <div className="actions confirm-actions">
        <button className="main-action" type="button" onClick={() => onContinue(text.trim() || undefined)}>
          {copy.KEEP_NOTE}
        </button>
        <button type="button" onClick={() => onContinue()}>
          {copy.SKIP_NOTE}
        </button>
      </div>
    </main>
  );
}
