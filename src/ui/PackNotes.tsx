import { useEffect, useRef, useState } from 'react';

import { NOTE_MAX_CHARS } from '../core/constants';
import * as copy from '../core/copy';
import type { PackNote } from '../core/types';
import { clearNoteDraft, readNoteDraft, writeNoteDraft } from '../core/note-draft';
import { localFlagStore } from '../data/acknowledgement';
import { deleteNote, putNote } from '../data/db';
import Glyph from './components/Glyph';
import NoteText from './components/NoteText';
import { continueBullets, typeBullets } from './components/bulletTyping';

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
 *  unsaved, and kept on the phone as a draft, so leaving the page or a flat
 *  battery never loses them: the note opens again with them on the next
 *  visit. The browser also warns before a reload or a closed tab. Delete asks
 *  first, as every removal in the app does. */
export function PackNotes({ packId, notes: stored, save = putNote, remove = deleteNote }: PackNotesProps) {
  const [notes, setNotes] = useState(stored);
  // A draft left from an earlier visit opens its note again with the words.
  // Words the same as the saved note are no draft at all.
  const [editing, setEditing] = useState<Editing | null>(() => {
    const draft = readNoteDraft(localFlagStore(), packId);
    const saved = draft && stored.find((note) => note.id === draft.id);
    if (!draft || saved?.text === draft.text) return null;
    // A note deleted since its draft was kept comes back as a new note.
    return { id: draft.id, draft: draft.text, isNew: !saved, asking: false, failed: false };
  });
  // The answer to the last finished action, said once under the notes.
  const [status, setStatus] = useState<'saved' | 'deleted' | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  // The note whose Edit takes focus back when editing ends; null for Add.
  const returnTo = useRef<string | null>(null);


  const savedText = editing ? (notes.find((note) => note.id === editing.id)?.text ?? '') : '';
  const unsaved = editing !== null && editing.draft !== savedText;

  // The unsaved words are kept as they are typed, and cleared once they are
  // saved, cancelled or deleted.
  useEffect(() => {
    if (editing && unsaved) {
      writeNoteDraft(localFlagStore(), packId, { id: editing.id, text: editing.draft, isNew: editing.isNew });
    } else {
      clearNoteDraft(localFlagStore(), packId);
    }
  }, [editing, unsaved, packId]);

  // Leaving the page with unsaved words: the browser's own warning.
  useEffect(() => {
    if (!unsaved) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  // Focus follows the step: into the words, onto Keep it when Delete asks, and
  // back to the note's Edit (or to Add a note) when editing ends.
  // Focus moves only when the open note or its question changes, never on the
  // page's first paint, so a draft opened from an earlier visit takes no focus.
  const editingId = editing?.id;
  const asking = editing?.asking;
  const shown = useRef({ editingId, asking });
  useEffect(() => {
    const before = shown.current;
    if (before.editingId === editingId && before.asking === asking) return;
    shown.current = { editingId, asking };
    if (asking) keepRef.current?.focus();
    else if (editingId) textRef.current?.focus();
    else {
      const edit = returnTo.current
        ? listRef.current?.querySelector<HTMLButtonElement>(`[data-note="${returnTo.current}"] .note-edit`)
        : null;
      (edit ?? addRef.current)?.focus();
      returnTo.current = null;
    }
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
        onChange={(event) => change({ draft: typeBullets(event), failed: false })}
        onKeyDown={(event) => continueBullets(event, (draft) => change({ draft, failed: false }))}
      />
      {unsaved ? (
        <p id="note-unsaved" className="field-message with-glyph">
          <Glyph kind="caution" line />
          {copy.NOTE_UNSAVED}
        </p>
      ) : null}
      {current.failed ? (
        <p className="field-message with-glyph" role="status">
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
              <div className="note-text">
                <NoteText text={note.text} />
              </div>
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
