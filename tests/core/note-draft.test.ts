import { describe, expect, it } from 'vitest';

import type { FlagStore } from '../../src/core/acknowledgement';
import { NOTE_DRAFT_KEY_PREFIX, NOTE_MAX_CHARS } from '../../src/core/constants';
import { clearNoteDraft, readNoteDraft, writeNoteDraft } from '../../src/core/note-draft';

const memoryStore = (seed: Record<string, string> = {}): FlagStore => ({
  getItem: (key) => seed[key] ?? null,
  setItem: (key, value) => { seed[key] = value; },
  removeItem: (key) => { delete seed[key]; },
});
const throwing: FlagStore = {
  getItem: () => { throw new Error('blocked'); },
  setItem: () => { throw new Error('blocked'); },
  removeItem: () => { throw new Error('blocked'); },
};

describe('note drafts', () => {
  it('keeps one draft per pack, and clears it', () => {
    const store = memoryStore();
    writeNoteDraft(store, 'a', { id: 'n1', text: 'Spare key', isNew: false });
    writeNoteDraft(store, 'b', { id: 'n2', text: 'Meet here', isNew: true });
    expect(readNoteDraft(store, 'a')).toEqual({ id: 'n1', text: 'Spare key', isNew: false });

    clearNoteDraft(store, 'a');
    expect(readNoteDraft(store, 'a')).toBeNull();
    expect(readNoteDraft(store, 'b')).toEqual({ id: 'n2', text: 'Meet here', isNew: true });
  });

  it('reads nothing from a missing, malformed, oversized or throwing store', () => {
    const key = `${NOTE_DRAFT_KEY_PREFIX}a`;
    expect(readNoteDraft(null, 'a')).toBeNull();
    expect(readNoteDraft(memoryStore({ [key]: '{not json' }), 'a')).toBeNull();
    expect(readNoteDraft(memoryStore({ [key]: '{"id":1,"text":"x","isNew":false}' }), 'a')).toBeNull();
    const long = JSON.stringify({ id: 'n', text: 'x'.repeat(NOTE_MAX_CHARS + 1), isNew: false });
    expect(readNoteDraft(memoryStore({ [key]: long }), 'a')).toBeNull();
    expect(readNoteDraft(throwing, 'a')).toBeNull();
    expect(() => writeNoteDraft(throwing, 'a', { id: 'n', text: 'x', isNew: true })).not.toThrow();
    expect(() => clearNoteDraft(throwing, 'a')).not.toThrow();
  });
});
