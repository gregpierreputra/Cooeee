import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { hazardsForDay } from '../../src/core/block';
import type { BlockPlay, WordDay } from '../../src/core/types';
import {
  db,
  deleteCompletePack,
  getWordDay,
  isBlockPlay,
  isWordDay,
  listBlockPlays,
  listWordDays,
  ownedTables,
  saveBlockPlay,
  saveWordDay,
} from '../../src/data/db';
import { pack } from '../fixtures';

const AT = 1_756_100_000_000;
const word = (over: Partial<WordDay> = {}): WordDay => ({ day: 20_736, answer: 'ember', guesses: ['smoke'], status: 'playing', updatedAt: AT, ...over });
const hazards = hazardsForDay(20_736).map((hazard) => hazard.id);
const play = (over: Partial<BlockPlay> = {}): BlockPlay => ({
  id: 'b1', day: 20_736, finishedAt: AT, score: 46, hazards, found: hazards.slice(0, 4), wrongTaps: 1, hints: 0, ...over,
});

describe('the games stores', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('keeps a word day after each guess, and reads it back to carry on', async () => {
    await saveWordDay(word());
    await saveWordDay(word({ guesses: ['smoke', 'flame'], updatedAt: AT + 1 }));
    expect((await getWordDay(20_736))?.guesses).toEqual(['smoke', 'flame']);
    expect(await getWordDay(20_737)).toBeUndefined();
  });

  it('never changes a finished day, nor a day’s answer', async () => {
    await saveWordDay(word({ guesses: ['smoke', 'ember'], status: 'won', finishedAt: AT }));
    await expect(saveWordDay(word({ guesses: ['smoke'] }))).rejects.toThrow(RangeError);
    await db.wordDays.clear();
    await saveWordDay(word());
    await expect(saveWordDay(word({ answer: 'flame', guesses: ['smoke'] }))).rejects.toThrow(RangeError);
  });

  it('refuses a word day the game could not have produced, and drops one on read', async () => {
    expect(isWordDay(word())).toBe(true);
    expect(isWordDay(word({ answer: 'Ember' }))).toBe(false);
    expect(isWordDay(word({ guesses: ['smok'] }))).toBe(false);
    expect(isWordDay(word({ guesses: Array(7).fill('smoke') }))).toBe(false);
    expect(isWordDay(word({ status: 'won', finishedAt: AT }))).toBe(false);
    expect(isWordDay(word({ guesses: Array(6).fill('smoke'), status: 'lost' }))).toBe(false);
    expect(isWordDay(word({ guesses: Array(6).fill('smoke'), status: 'lost', finishedAt: AT }))).toBe(true);
    expect(isWordDay(word({ guesses: ['ember'], status: 'playing' }))).toBe(false);
    expect(isWordDay(word({ day: 1.5 }))).toBe(false);
    expect(isWordDay(null)).toBe(false);
    await expect(saveWordDay(word({ status: 'won' }))).rejects.toThrow(RangeError);
    await db.wordDays.put({ ...word({ day: 1 }), guesses: ['x'] });
    expect(await listWordDays()).toEqual([]);
  });

  it('keeps every Ready the Block play', async () => {
    await saveBlockPlay(play());
    await saveBlockPlay(play({ id: 'b2', score: 90 }));
    expect((await listBlockPlays()).map((row) => row.score).sort()).toEqual([46, 90]);
  });

  it('refuses a play the game could not have produced', async () => {
    expect(isBlockPlay(play())).toBe(true);
    expect(isBlockPlay(play({ score: 101 }))).toBe(false);
    expect(isBlockPlay(play({ hazards: hazards.slice(0, 7) }))).toBe(false);
    expect(isBlockPlay(play({ found: ['not-a-risk'] }))).toBe(false);
    expect(isBlockPlay(play({ found: [hazards[0], hazards[0]] }))).toBe(false);
    expect(isBlockPlay(play({ wrongTaps: -1 }))).toBe(false);
    expect(isBlockPlay(play({ id: '' }))).toBe(false);
    await expect(saveBlockPlay(play({ score: 3.5 }))).rejects.toThrow(RangeError);
    await db.blockPlays.put({ ...play({ id: 'bad' }), hints: -2 });
    expect(await listBlockPlays()).toEqual([]);
  });

  it('belongs to the phone, not to a pack: deleting a pack leaves both', async () => {
    expect(ownedTables()).not.toContain(db.wordDays);
    expect(ownedTables()).not.toContain(db.blockPlays);
    await db.packs.put({ ...pack(), id: 'p1', status: 'complete' });
    await saveWordDay(word());
    await saveBlockPlay(play());
    await deleteCompletePack('p1');
    expect(await listWordDays()).toHaveLength(1);
    expect(await listBlockPlays()).toHaveLength(1);
  });
});
