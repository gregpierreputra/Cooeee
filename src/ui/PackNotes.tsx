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

/** The pack's notes: read, changed, removed and added here, online or off —
 *  every write is to the device alone. Each note is its own box with its own
 *  Save, so one edit never waits on another. A new note exists only on screen
 *  until it is saved; its updatedAt of 0 says so. */
export function PackNotes({ packId, notes: stored, save = putNote, remove = deleteNote }: PackNotesProps) {
  const [notes, setNotes] = useState(stored);
  const [status, setStatus] = useState('');

  const replace = (next: PackNote) =>
    setNotes((current) => current.map((note) => (note.id === next.id ? next : note)));

  async function saveNote(note: PackNote) {
    if (note.text.trim().length === 0) {
      setStatus(copy.NOTE_EMPTY);
      return;
    }
    const saved = { ...note, updatedAt: Date.now() };
    try {
      await save(saved);
      replace(saved);
      setStatus(copy.NOTE_SAVED);
    } catch {
      setStatus(copy.NOTE_CHANGE_FAILED);
    }
  }

  async function removeNote(note: PackNote) {
    try {
      if (note.updatedAt > 0) await remove(note.id);
      setNotes((current) => current.filter((kept) => kept.id !== note.id));
      setStatus('');
    } catch {
      setStatus(copy.NOTE_CHANGE_FAILED);
    }
  }

  const addNote = () =>
    setNotes([...notes, { id: crypto.randomUUID(), packId, text: '', updatedAt: 0 }]);

  return (
    <section className="pack-notes">
      <span className="kicker">{copy.NOTES}</span>
      <ul className="list">
        {notes.map((note) => (
          <li key={note.id} className="card note-card">
            <textarea
              aria-label={copy.NOTE_LABEL}
              value={note.text}
              maxLength={NOTE_MAX_CHARS}
              onChange={(event) => replace({ ...note, text: event.currentTarget.value })}
            />
            <div className="note-actions">
              <button type="button" onClick={() => void saveNote(note)}>
                {copy.SAVE_NOTE}
              </button>
              <button type="button" onClick={() => void removeNote(note)}>
                {copy.DELETE_NOTE}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="muted" role="status" aria-live="polite">{status}</p>
      <button type="button" onClick={addNote}>
        {copy.ADD_NOTE}
      </button>
    </section>
  );
}
