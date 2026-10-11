import { useEffect, useState } from 'react';
import { NOTE_MAX_CHARS } from '../../core/constants';
import * as copy from '../../core/copy';
import { wayNote } from '../../core/rehearsal-note';
import type { PackNote } from '../../core/types';
import { putNote } from '../../data/db';
import Glyph from '../components/Glyph';
import Section from '../components/Section';
import { continueBullets, typeBullets } from '../components/bulletTyping';

type Mark = 'saved' | 'empty' | 'failed';

const MARK_TEXT: Record<Mark, string> = {
  saved: copy.NOTE_SAVED,
  empty: copy.NOTE_EMPTY,
  failed: copy.NOTE_CHANGE_FAILED,
};

/** E5-US1-AC5 — her note about the way, offered after a walked rehearsal.
 *
 *  One optional field. Nothing waits on it: the result is whole without it, and
 *  leaving writes nothing. What she writes is saved as an ordinary note in this
 *  pack, through putNote, so it is read back to her in BlackSky on the day. It is
 *  her words alone, with no mark that a rehearsal produced it, and it changes no
 *  gap and enters no comparison.
 *
 *  The card treatment, the Save control and the saved, empty and failed answers
 *  are the pack page's own, so a note written here reads like any other. Saving
 *  again rewrites the same note rather than adding a second. */
export default function WayNote({
  packId,
  save = putNote,
  now = Date.now,
}: {
  packId: string;
  save?: (note: PackNote) => Promise<void>;
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

  async function keep() {
    if (text.trim().length === 0) {
      setMark('empty');
      return;
    }
    try {
      await save(wayNote(packId, text, id, now()));
      setSavedText(text);
      setMark('saved');
    } catch {
      setMark('failed');
    }
  }

  return (
    <Section kind="note" title={copy.WAY_NOTE_HEADING} heading className="way-note">
      <p className="muted place-note">{copy.WAY_NOTE_DETAIL}</p>
      <div className="card note-card">
        <textarea
          aria-label={copy.WAY_NOTE_LABEL}
          aria-describedby={unsaved ? 'way-note-unsaved' : undefined}
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
        {unsaved ? (
          <p id="way-note-unsaved" className="field-message with-glyph">
            <Glyph kind="caution" line />
            {copy.NOTE_UNSAVED}
          </p>
        ) : null}
        {/* Always present, so the live region exists before it speaks. */}
        <p
          className={`note-mark${mark === 'saved' ? ' note-mark-saved' : ''}`}
          role="status"
          onAnimationEnd={() => setMark(null)}
        >
          {mark ? MARK_TEXT[mark] : ''}
        </p>
        <div className="note-actions">
          <button type="button" onClick={() => void keep()}>
            {copy.SAVE_NOTE}
          </button>
        </div>
      </div>
    </Section>
  );
}
