import { describe, expect, it } from 'vitest';
import * as copy from '../../src/core/copy';
import { offersWayNote, wayNote } from '../../src/core/rehearsal-note';

// E5-US1-AC5, step 3 — her note about the way, into this pack's personal note.
describe('her note about the way', () => {
  it('is offered after a walked rehearsal only', () => {
    expect(offersWayNote({ ending: 'walked' })).toBe(true);
    expect(offersWayNote({ ending: 'dry-run' })).toBe(false);
    // A rehearsal recorded before the endings existed took no known way either.
    expect(offersWayNote({})).toBe(false);
  });

  it('is an ordinary pack note: her words exactly, and nothing added to mark where it was written', () => {
    const words = 'Left at the church, not the second gate.\nThe footbridge floods — use the road.';
    const note = wayNote('pack-1', words, 'note-1', 1_756_100_900_000);
    expect(note).toEqual({ id: 'note-1', packId: 'pack-1', text: words, updatedAt: 1_756_100_900_000 });
    expect(Object.keys(note).sort()).toEqual(['id', 'packId', 'text', 'updatedAt']);
  });
});

describe('the words that offer it', () => {
  const words = [copy.WAY_NOTE_HEADING, copy.WAY_NOTE_DETAIL, copy.WAY_NOTE_LABEL];

  it('are exactly the draft wording, pending the copy review', () => {
    expect(words).toEqual([
      'What you learnt about the way',
      "If you like, write what the app cannot tell you: the turns, what you met on the way, what you would do differently. It is kept with this pack's notes, which BlackSky shows you without a connection.",
      'Your note about the way',
    ]);
  });

  it('say it is optional, and where it goes', () => {
    expect(copy.WAY_NOTE_DETAIL.startsWith('If you like,')).toBe(true);
    expect(copy.WAY_NOTE_DETAIL).toContain("this pack's notes");
    expect(copy.WAY_NOTE_DETAIL).toContain('BlackSky');
  });

  it('never judge her, count her notes, or read as a plan for the day', () => {
    const joined = words.join(' ');
    expect(joined).not.toMatch(
      /\b(required|must|should|fast|slow|target|score|grade|count|total|best|record|partial|incomplete|so far)\b/i,
    );
    expect(joined).not.toMatch(/\b(route|directions|turn-by-turn|eta|arrival|arrive by|destination|your plan)\b/i);
    expect(joined).not.toMatch(/\d/);
  });
});
