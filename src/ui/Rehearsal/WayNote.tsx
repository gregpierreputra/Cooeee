import { useEffect, useState } from 'react';
import { NOTE_MAX_CHARS } from '../../core/constants';
import * as copy from '../../core/copy';
import { wayNote } from '../../core/rehearsal-note';
import type { PackNote } from '../../core/types';
import { deleteNote, putNote } from '../../data/db';
import Glyph, { type GlyphKind } from '../components/Glyph';
import Section from '../components/Section';
import { continueBullets, typeBullets } from '../components/bulletTyping';

/** What the last tap answered. Cleared by typing. */
type Mark = 'removed' | 'empty' | 'failed';

/** The one line under the field: its tone, its drawing and its words. */
type Status = { tone: 'saved' | 'caution' | 'quiet'; glyph: GlyphKind; text: string };

const SAVE_TICK = <Glyph kind="check" line />;

/** E5-US1-AC5 — her note about the way, offered after a walked rehearsal.
 *
 *  One optional field. Nothing waits on it: the result is whole without it, and
 *  leaving writes nothing. What she writes is saved as an ordinary note in this
 *  pack, through putNote, so it is read back to her in BlackSky on the day. It is
 *  her words alone, with no mark that a rehearsal produced it, and it changes no
 *  gap and enters no comparison.
 *
 *  The card treatment, the Save control and the empty and failed answers are
 *  the pack page's own, so a note written here reads like any other. Saving
 *  again rewrites the same note rather than adding a second. One line under the
 *  field says where the note stands, led by its drawing. */
export default function WayNote({
  packId,
  save = putNote,
  remove = deleteNote,
  now = Date.now,
}: {
  packId: string;
  save?: (note: PackNote) => Promise<void>;
  remove?: (id: string) => Promise<void>;
  now?: () => number;
}) {
  const [id] = useState(() => crypto.randomUUID());
  const [text, setText] = useState('');
  const [mark, setMark] = useState<Mark | null>(null);
  // As on the pack page: words typed and not yet saved are said, and leaving
  // the page with them asks first.
  const [savedText, setSavedText] = useState('');
  const unsaved = text.trim().length > 0 && text !== savedText;
  useEffect(() => {
    if (!unsaved) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  /** Takes the saved note back out of the pack. Her words stay in the field,
   *  unsaved again, so a mistaken tap loses nothing. */
  async function takeOut() {
    try {
      await remove(id);
      setSavedText('');
      setMark('removed');
    } catch {
      setMark('failed');
    }
  }

  async function keep() {
    if (text.trim().length === 0) {
      setMark('empty');
      return;
    }
    try {
      await save(wayNote(packId, text, id, now()));
      setSavedText(text);
      setMark(null);
    } catch {
      setMark('failed');
    }
  }

  // The last tap's answer first, then whether the words are kept.
  const status: Status | null =
    mark === 'removed'
      ? { tone: 'quiet', glyph: 'trash', text: copy.WAY_NOTE_REMOVED }
      : mark === 'failed'
        ? { tone: 'caution', glyph: 'caution', text: copy.NOTE_CHANGE_FAILED }
        : mark === 'empty'
          ? { tone: 'caution', glyph: 'caution', text: copy.NOTE_EMPTY }
          : unsaved
            ? { tone: 'caution', glyph: 'caution', text: copy.NOTE_UNSAVED }
            : savedText
              ? { tone: 'saved', glyph: 'check', text: copy.WAY_NOTE_KEPT }
              : null;
  // Kept and unchanged: the Save control itself says so.
  const kept = savedText !== '' && text === savedText;

  return (
    <Section kind="note" title={copy.WAY_NOTE_HEADING} heading className="way-note">
      <p className="muted place-note">{copy.WAY_NOTE_DETAIL}</p>
      <div className="card note-card">
        <textarea
          aria-label={copy.WAY_NOTE_LABEL}
          aria-describedby={status ? 'way-note-status' : undefined}
          value={text}
          maxLength={NOTE_MAX_CHARS}
          onChange={(event) => {
            setText(typeBullets(event));
            setMark(null);
          }}
          onKeyDown={(event) =>
            continueBullets(event, (next) => {
              setText(next);
              setMark(null);
            })
          }
        />
        {/* Always present, so the live region exists before it speaks. */}
        <p
          id="way-note-status"
          className={`way-note-status with-glyph${status ? ` way-note-${status.tone}` : ''}`}
          role="status"
        >
          {/* Saved is said by the control below, so here it is only heard. */}
          {status?.tone === 'saved' ? (
            <span className="visually-hidden">{status.text}</span>
          ) : status ? (
            <>
              <Glyph kind={status.glyph} line />
              {status.text}
            </>
          ) : null}
        </p>
        <div className="note-actions">
          {/* Kept and unchanged, Save reads as done in the teal outline and does
              nothing until the words change. aria-disabled, not disabled, so
              focus stays on it. Outlined, not filled: Done is the page's one
              filled control. */}
          <button
            type="button"
            className={kept ? 'way-note-kept with-glyph' : undefined}
            aria-disabled={kept || undefined}
            onClick={() => (kept ? undefined : void keep())}
          >
            {kept ? SAVE_TICK : null}
            {kept ? copy.WAY_NOTE_SAVED : copy.SAVE_NOTE}
          </button>
          {/* Changed since saving: put the saved words back. Kept: take the
              note back out of the pack. Nothing before the first save. */}
          {savedText && !kept ? (
            <button
              type="button"
              className="with-glyph"
              onClick={() => {
                setText(savedText);
                setMark(null);
              }}
            >
              <Glyph kind="undo" line />
              {copy.WAY_NOTE_UNDO}
            </button>
          ) : savedText ? (
            <button type="button" className="note-delete with-glyph" onClick={() => void takeOut()}>
              <Glyph kind="trash" line />
              {copy.WAY_NOTE_REMOVE}
            </button>
          ) : null}
        </div>
      </div>
    </Section>
  );
}
