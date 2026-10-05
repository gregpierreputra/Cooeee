import { useEffect, useRef, useState } from 'react';

import { NOTE_MAX_CHARS } from '../core/constants';
import * as copy from '../core/copy';
import type { PackNote } from '../core/types';
import { deleteNote, putNote } from '../data/db';
import Glyph from './components/Glyph';

type PackNotesProps = {
  packId: string;
  notes: PackNote[];
  save?: typeof putNote;
  remove?: typeof deleteNote;
};

/** The one note open for editing: its words as typed, whether it is new (not
 *  yet stored), whether Delete is asking, and whether the last write failed. */
type Editing = { id: string; draft: string; isNew: boolean; asking: boolean; failed: boolean };

/** How many letters of a note name its Edit button for a screen reader. */
const EDIT_NAME_CHARS = 40;

/** The pack's notes, online or off: every write is to the device alone. They
 *  read as plain cards, and one at a time opens for editing, with Save, Cancel
 *  and Delete only there. Words that differ from the saved note are said to be
 *  unsaved, and the browser warns before the page is left with them. Delete
 *  asks first, as every removal in the app does. */
export function PackNotes({ packId, notes: stored, save = putNote, remove = deleteNote }: PackNotesProps) {
  const [notes, setNotes] = useState(stored);
  const [editing, setEditing] = useState<Editing | null>(null);
  // The answer to the last finished action, said once under the notes.
  const [status, setStatus] = useState<'saved' | 'deleted' | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  // The note whose Edit takes focus back when editing ends; null for Add.
  const returnTo = useRef<string | null>(null);
  // Whether a note was open at the last step, so the page's first paint never
  // moves focus: only the end of an edit hands it back.
  const wasEditing = useRef(false);

  const savedText = editing ? (notes.find((note) => note.id === editing.id)?.text ?? '') : '';
  const unsaved = editing !== null && editing.draft !== savedText;

  // Leaving the page with unsaved words: the browser's own warning.
  useEffect(() => {
    if (!unsaved) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  // Focus follows the step: into the words, onto Keep it when Delete asks, and
  // back to the note's Edit (or to Add a note) when editing ends.
  const editingId = editing?.id;
  const asking = editing?.asking;
  useEffect(() => {
    if (asking) keepRef.current?.focus();
    else if (editingId) textRef.current?.focus();
    else if (wasEditing.current) {
      const edit = returnTo.current
        ? listRef.current?.querySelector<HTMLButtonElement>(`[data-note="${returnTo.current}"] .note-edit`)
        : null;
      (edit ?? addRef.current)?.focus();
      returnTo.current = null;
    }
    wasEditing.current = editingId !== undefined;
  }, [editingId, asking]);

  const change = (next: Partial<Editing>) => setEditing((current) => current && { ...current, ...next });

  const startEdit = (note: PackNote) => {
    setStatus(null);
    setEditing({ id: note.id, draft: note.text, isNew: false, asking: false, failed: false });
  };
  const addNote = () => {
    setStatus(null);
    setEditing({ id: crypto.randomUUID(), draft: '', isNew: true, asking: false, failed: false });
  };
  const cancel = () => {
    returnTo.current = editing && !editing.isNew ? editing.id : null;
    setEditing(null);
  };

  async function saveNote() {
    if (!editing || editing.draft.trim() === '') return;
    const note = { id: editing.id, packId, text: editing.draft.trim(), updatedAt: Date.now() };
    try {
      await save(note);
    } catch {
      change({ failed: true });
      return;
    }
    setNotes((current) => (editing.isNew ? [...current, note] : current.map((row) => (row.id === note.id ? note : row))));
    returnTo.current = note.id;
    setEditing(null);
    setStatus('saved');
  }

  async function removeNote() {
    if (!editing) return;
    try {
      await remove(editing.id);
    } catch {
      change({ asking: false, failed: true });
      return;
    }
    setNotes((current) => current.filter((note) => note.id !== editing.id));
    returnTo.current = null;
    setEditing(null);
    setStatus('deleted');
  }

  const editor = (current: Editing) => (
    <li key={current.id} className="card note-card note-editing">
      <textarea
        ref={textRef}
        aria-label={copy.NOTE_LABEL}
        aria-describedby={unsaved ? 'note-unsaved' : undefined}
        value={current.draft}
        maxLength={NOTE_MAX_CHARS}
        onChange={(event) => change({ draft: event.currentTarget.value, failed: false })}
      />
      {unsaved ? (
        <p id="note-unsaved" className="field-message with-glyph">
          <Glyph kind="caution" line />
          {copy.NOTE_UNSAVED}
        </p>
      ) : null}
      {current.failed ? (
        <p className="field-message with-glyph" role="alert">
          <Glyph kind="caution" line />
          {copy.NOTE_CHANGE_FAILED}
        </p>
      ) : null}
      {current.asking ? (
        <>
          <p>{copy.DELETE_NOTE_QUESTION}</p>
          <div className="card-confirm-actions">
            <button ref={keepRef} type="button" className="card-confirm-no" onClick={() => change({ asking: false })}>
              {copy.KEEP_IT}
            </button>
            <button type="button" className="card-confirm-yes with-glyph" onClick={() => void removeNote()}>
              <Glyph kind="trash" line />
              {copy.DELETE_NOTE}
            </button>
          </div>
        </>
      ) : (
        <div className="note-actions">
          <button type="button" onClick={cancel}>{copy.CANCEL}</button>
          <button type="button" className="main-action" disabled={current.draft.trim() === ''} onClick={() => void saveNote()}>
            {copy.SAVE_NOTE}
          </button>
          {/* A new note is not stored yet: Cancel is all it needs. */}
          {current.isNew ? null : (
            <button type="button" className="note-delete with-glyph" onClick={() => change({ asking: true })}>
              <Glyph kind="trash" line />
              {copy.DELETE_NOTE}
            </button>
          )}
        </div>
      )}
    </li>
  );

  return (
    <div className="pack-notes" ref={listRef}>
      <ul className="list">
        {notes.map((note) =>
          editing?.id === note.id ? editor(editing) : (
            <li key={note.id} className="card note-card note-read" data-note={note.id}>
              <p className="note-text">{note.text}</p>
              {/* One note at a time is edited, so Edit waits while another is open. */}
              {editing ? null : (
                <button type="button" className="note-edit with-glyph" onClick={() => startEdit(note)}>
                  <Glyph kind="edit" line />
                  {copy.EDIT_NOTE}
                  <span className="visually-hidden"> {note.text.slice(0, EDIT_NAME_CHARS)}</span>
                </button>
              )}
            </li>
          ))}
        {editing?.isNew ? editor(editing) : null}
      </ul>
      {/* Always present, so the live region exists before it speaks. */}
      <p
        className={`note-mark${status === 'saved' ? ' note-mark-saved' : ''}`}
        role="status"
        onAnimationEnd={() => setStatus(null)}
      >
        {status === 'saved' ? copy.NOTE_SAVED : status === 'deleted' ? copy.NOTE_DELETED : ''}
      </p>
      {editing ? null : (
        <button ref={addRef} type="button" className="note-add with-glyph" onClick={addNote}>
          <Glyph kind="plus" line />
          {copy.ADD_NOTE}
        </button>
      )}
    </div>
  );
}
