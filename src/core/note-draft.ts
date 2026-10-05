// The unsaved words of one note on the pack page, kept on the phone so leaving
// the page, a reload or a flat battery never loses them. Only the pack page's
// note box reads it: every other screen shows the last saved notes.

import type { FlagStore } from './acknowledgement';
import { NOTE_DRAFT_KEY_PREFIX, NOTE_MAX_CHARS } from './constants';

/** Which note the words belong to, the words, and whether the note is new. */
export type NoteDraft = { id: string; text: string; isNew: boolean };

const key = (packId: string) => `${NOTE_DRAFT_KEY_PREFIX}${packId}`;

/** The pack's draft, or none: an absent key, malformed or oversized text, or a
 *  store that throws all read as no draft, never as an error. */
export function readNoteDraft(store: FlagStore | null, packId: string): NoteDraft | null {
  try {
    const draft: unknown = JSON.parse(store?.getItem(key(packId)) ?? 'null');
    if (typeof draft !== 'object' || draft === null) return null;
    const { id, text, isNew } = draft as Record<string, unknown>;
    return typeof id === 'string' && typeof text === 'string' && text.length <= NOTE_MAX_CHARS && typeof isNew === 'boolean'
      ? { id, text, isNew }
      : null;
  } catch {
    return null;
  }
}

export function writeNoteDraft(store: FlagStore | null, packId: string, draft: NoteDraft): void {
  try {
    store?.setItem(key(packId), JSON.stringify(draft));
  } catch {
    // Storage refused: the words last for this visit only.
  }
}

export function clearNoteDraft(store: FlagStore | null, packId: string): void {
  try {
    store?.removeItem(key(packId));
  } catch {
    // Storage refused: nothing more can be done from here.
  }
}
