import { useState } from 'react';

import { NOTE_MAX_CHARS } from '../../core/constants';
import * as copy from '../../core/copy';
import Glyph from '../components/Glyph';
import { continueBullets, typeBullets } from '../components/bulletTyping';
import FlowSteps from './FlowSteps';

type NoteProps = {
  example: string;
  /** The note written before, when the person comes back to this step. */
  initial?: string;
  /** The note to keep, or undefined to go on without one. */
  onContinue: (text?: string) => void;
};

/** The personal-note step: one box, pre-filled with an example written for
 *  this place, and a plain way past it. Nothing is written here; the parent
 *  carries the text into the pack save. */
export function Note({ example, initial, onContinue }: NoteProps) {
  const [text, setText] = useState(initial ?? example);

  return (
    <main className="page note-page">
      <div className="confirm-content">
        <header className="hero">
          <FlowSteps at={3} />
          <h1>{copy.NOTE_STEP_TITLE}</h1>
          <p className="muted with-glyph">
            <Glyph kind="lock" line />
            {copy.NOTE_DISCLOSURE}
          </p>
        </header>
        <label htmlFor="pack-note">{copy.NOTE_LABEL}</label>
        <textarea
          id="pack-note"
          value={text}
          maxLength={NOTE_MAX_CHARS}
          onChange={(event) => setText(typeBullets(event))}
          onKeyDown={(event) => continueBullets(event, setText)}
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
