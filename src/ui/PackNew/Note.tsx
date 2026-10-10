import { useState } from 'react';

import { NOTE_MAX_CHARS } from '../../core/constants';
import * as copy from '../../core/copy';
import type { PackNote } from '../../core/types';
import Glyph from '../components/Glyph';
import NoteText from '../components/NoteText';
import { continueBullets, typeBullets } from '../components/bulletTyping';
import FlowSteps from './FlowSteps';

type NoteProps = {
  example: string;
  /** The note written before, when the person comes back to this step. */
  initial?: string;
  /** The note to keep, or undefined to go on without one. */
  onContinue: (text?: string) => void;
  /** Replacing a pack that holds notes: the notes, whether they are kept, and
   *  the choice to start without them. */
  replacing?: { notes: PackNote[]; keep: boolean; onKeep: (keep: boolean) => void };
};

/** The personal-note step: one box, pre-filled with an example written for
 *  this place, and a plain way past it. Nothing is written here; the parent
 *  carries the text into the pack save. */
export function Note({ example, initial, onContinue, replacing }: NoteProps) {
  const [text, setText] = useState(initial ?? example);

  return (
    // A replace starts empty under the notes already saved, so its box is the
    // usual size, not tall enough for the whole example.
    <main className={replacing ? 'page note-page replacing' : 'page note-page'}>
      <div className="confirm-content">
        <header className="hero">
          <FlowSteps at={3} />
          <h1>{copy.NOTE_STEP_TITLE}</h1>
          <p className="muted with-glyph">
            <Glyph kind="lock" line />
            {copy.NOTE_DISCLOSURE}
          </p>
        </header>
        {/* A replace shows the notes already written for the place before the
            box, as they are, and what happens to them. Nothing is removed until
            the new pack is saved. */}
        {replacing ? (
          <section className={replacing.keep ? 'notes-saved' : 'notes-saved notes-dropped'} aria-labelledby="notes-saved-heading">
            <h2 id="notes-saved-heading" className="kicker">{copy.NOTES_SAVED_HEADING}</h2>
            {/* What happens to them, said before they are listed. */}
            <p className={replacing.keep ? 'muted place-note' : 'tone-amber place-note'} role="status">
              {replacing.keep ? copy.NOTES_KEPT(replacing.notes.length) : copy.NOTES_DROPPED(replacing.notes.length)}
            </p>
            <ul className="list">
              {replacing.notes.map((note) => (
                <li key={note.id} className="card note-card">
                  <div className="note-text">
                    <NoteText text={note.text} />
                  </div>
                </li>
              ))}
            </ul>
            {/* A choice about the person's own words, so a button: red where it
                removes them, teal where it keeps them, as on every question
                that removes something. It only takes effect when the new pack
                is saved, so it can be switched back until then. */}
            <button
              type="button"
              className={replacing.keep ? 'notes-choice card-confirm-yes with-glyph' : 'notes-choice card-confirm-no with-glyph'}
              onClick={() => replacing.onKeep(!replacing.keep)}
            >
              <Glyph kind={replacing.keep ? 'trash' : 'check'} line />
              {replacing.keep ? copy.START_WITHOUT_NOTES(replacing.notes.length) : copy.KEEP_OLD_NOTES(replacing.notes.length)}
            </button>
          </section>
        ) : null}
        <label htmlFor="pack-note">{replacing ? copy.NOTE_ADD_ANOTHER : copy.NOTE_LABEL}</label>
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
