import { useState } from 'react';

import { NOTE_MAX_CHARS } from '../core/constants';
import * as copy from '../core/copy';
import type { PackNote } from '../core/types';
import { deleteNote, putNote } from '../data/db';

type PackNotesProps = {
  packId: string;
  notes: PackNote[];
  save?: typeof putNote;
  remove?: typeof deleteNote;
};

/** What a note card says about its own last action. Each card answers for
 *  itself, on the card, so the answer is never far from the note it concerns. */
type Mark = 'saved' | 'deleted' | 'empty' | 'failed';

const MARK_TEXT: Record<Mark, string> = {
  saved: copy.NOTE_SAVED,
  deleted: copy.NOTE_DELETED,
  empty: copy.NOTE_EMPTY,
  failed: copy.NOTE_CHANGE_FAILED,
};

/** The pack's notes: read, changed, removed and added here, online or off —
 *  every write is to the device alone. Each note is its own box with its own
 *  Save, so one edit never waits on another. A new note exists only on screen
 *  until it is saved; its updatedAt of 0 says so. */
export function PackNotes({ packId, notes: stored, save = putNote, remove = deleteNote }: PackNotesProps) {
  const [notes, setNotes] = useState(stored);
  const [marks, setMarks] = useState<Record<string, Mark>>({});

  const mark = (id: string, value: Mark | null) =>
    setMarks((current) => {
      const next = { ...current };
      if (value) next[id] = value;
      else delete next[id];
      return next;
    });
  const replace = (next: PackNote) =>
    setNotes((current) => current.map((note) => (note.id === next.id ? next : note)));
  const drop = (id: string) => setNotes((current) => current.filter((note) => note.id !== id));

  async function saveNote(note: PackNote) {
    if (note.text.trim().length === 0) {
      mark(note.id, 'empty');
      return;
    }
    const saved = { ...note, updatedAt: Date.now() };
    try {
      await save(saved);
      replace(saved);
      mark(note.id, 'saved');
    } catch {
      mark(note.id, 'failed');
    }
  }

  // A deleted note's card stays long enough to say so, then removes itself
  // when its fade ends (onAnimationEnd below).
  async function removeNote(note: PackNote) {
    try {
      if (note.updatedAt > 0) await remove(note.id);
      mark(note.id, 'deleted');
    } catch {
      mark(note.id, 'failed');
    }
  }

  const addNote = () =>
    setNotes([...notes, { id: crypto.randomUUID(), packId, text: '', updatedAt: 0 }]);

  return (
    <section className="pack-notes">
      <span className="kicker">{copy.NOTES}</span>
      <ul className="list">
        {notes.map((note) => {
          const answer = marks[note.id] as Mark | undefined;
          if (answer === 'deleted') {
            return (
              <li
                key={note.id}
                className="card note-card note-card-gone"
                onAnimationEnd={() => drop(note.id)}
              >
                <p className="note-mark" role="status">{copy.NOTE_DELETED}</p>
              </li>
            );
          }
          return (
            <li key={note.id} className={`card note-card${answer === 'saved' ? ' note-card-saved' : ''}`}>
              <textarea
                aria-label={copy.NOTE_LABEL}
                value={note.text}
                maxLength={NOTE_MAX_CHARS}
                onChange={(event) => {
                  replace({ ...note, text: event.currentTarget.value });
                  mark(note.id, null); // changed since its last answer
                }}
              />
              {/* Always present, so the live region exists before it speaks and
                  the card never jumps. The saved answer fades, then clears. */}
              <p
                className={`note-mark${answer === 'saved' ? ' note-mark-saved' : ''}`}
                role="status"
                onAnimationEnd={() => mark(note.id, null)}
              >
                {answer ? MARK_TEXT[answer] : ''}
              </p>
              <div className="note-actions">
                <button type="button" onClick={() => void saveNote(note)}>{copy.SAVE_NOTE}</button>
                <button type="button" onClick={() => void removeNote(note)}>{copy.DELETE_NOTE}</button>
              </div>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={addNote}>{copy.ADD_NOTE}</button>
    </section>
  );
}
