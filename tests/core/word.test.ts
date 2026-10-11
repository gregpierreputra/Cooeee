import { describe, expect, it } from 'vitest';
import * as copy from '../../src/core/copy';
import type { WordDay } from '../../src/core/types';
import {
  WORD_EPOCH_DAY,
  answerIndexFor,
  checkGuess,
  daysPlayed,
  inWordList,
  keyboardMarks,
  markGuess,
  PAST_WORDS_SHOWN,
  pastWords,
  puzzleNumber,
  statusAfter,
  wordStreak,
  wordTileView,
} from '../../src/core/word';

const row = (day: number, status: WordDay['status'], guesses = ['ember']): WordDay => ({
  day,
  answer: 'ember',
  guesses,
  status,
  updatedAt: 1_700_000_000_000,
  ...(status === 'playing' ? {} : { finishedAt: 1_700_000_000_000 }),
});

describe('Cooee Word marks', () => {
  it('marks right, present and absent letters', () => {
    expect(markGuess('smoke', 'ember')).toEqual(['absent', 'right', 'absent', 'absent', 'present']);
    expect(markGuess('ember', 'ember')).toEqual(['right', 'right', 'right', 'right', 'right']);
  });

  it('marks a letter only as often as the answer holds it, places that match first', () => {
    // EERIE against EMBER: the first E is right, the second present, the last absent.
    expect(markGuess('eerie', 'ember')).toEqual(['right', 'present', 'present', 'absent', 'absent']);
    // A repeated letter after the answer's only copy is used up is absent.
    expect(markGuess('geese', 'ember')).toEqual(['absent', 'present', 'present', 'absent', 'absent']);
    expect(markGuess('lever', 'ember')).toEqual(['absent', 'present', 'absent', 'right', 'right']);
  });

  it('keeps the strongest mark each key has earned', () => {
    const keys = keyboardMarks(['eerie', 'ember'], 'ember');
    expect(keys.e).toBe('right');
    expect(keys.r).toBe('right');
    expect(keys.i).toBe('absent');
    expect(keys.z).toBeUndefined();
  });
});

describe('Cooee Word guesses', () => {
  const list = ['blaze', 'ember', 'flame', 'smoke'].join('');

  it('finds words in a list stored end to end, at either end and between', () => {
    expect(inWordList(list, 5, 'blaze')).toBe(true);
    expect(inWordList(list, 5, 'smoke')).toBe(true);
    expect(inWordList(list, 5, 'flame')).toBe(true);
    expect(inWordList(list, 5, 'aaaaa')).toBe(false);
    expect(inWordList(list, 5, 'zzzzz')).toBe(false);
    expect(inWordList(list, 5, 'fire')).toBe(false);
    expect(inWordList('abc', 5, 'abcde')).toBe(false);
  });

  it('says why a guess cannot be entered', () => {
    expect(checkGuess('emb', 5, true, [])).toBe('short');
    expect(checkGuess('ember', 5, true, ['ember'])).toBe('repeat');
    expect(checkGuess('qqqqq', 5, false, [])).toBe('not-a-word');
    expect(checkGuess('ember', 5, true, [])).toBe('ok');
  });

  it('wins on the answer, loses after six', () => {
    expect(statusAfter(['smoke', 'ember'], 'ember')).toBe('won');
    expect(statusAfter(['smoke'], 'ember')).toBe('playing');
    expect(statusAfter(['smoke', 'smoke', 'smoke', 'smoke', 'smoke', 'flame'], 'ember')).toBe('lost');
  });
});

describe('Cooee Word past words', () => {
  const today = WORD_EPOCH_DAY + 20;

  it('lists the days before today that were played, newest first, with how each went', () => {
    const rows = [
      row(today - 3, 'lost', ['a', 'b', 'c', 'd', 'e', 'f']),
      row(today, 'won'),
      { ...row(today - 1, 'won', ['a', 'b']), answer: 'smoke' },
      row(today - 2, 'playing', ['a']),
    ];
    expect(pastWords(rows, today)).toEqual([
      { number: 20, word: 'smoke', status: 'won', guesses: 2 },
      { number: 19, word: 'ember', status: 'playing', guesses: 1 },
      { number: 18, word: 'ember', status: 'lost', guesses: 6 },
    ]);
  });

  it('lists every earlier day, seven of them shown first, and none before any is played', () => {
    const rows = Array.from({ length: 12 }, (_, i) => row(today - 1 - i, 'won'));
    const listed = pastWords(rows, today);
    expect(PAST_WORDS_SHOWN).toBe(7);
    expect(listed).toHaveLength(12);
    expect(listed.map((past) => past.number)).toEqual([20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9]);
    expect(pastWords([row(today, 'won')], today)).toEqual([]);
  });
});

describe('Cooee Word days', () => {
  it('numbers the words from the first day', () => {
    expect(puzzleNumber(WORD_EPOCH_DAY)).toBe(1);
    expect(puzzleNumber(WORD_EPOCH_DAY + 9)).toBe(10);
  });

  it('gives every answer once in each thousand days', () => {
    const picks = new Set(Array.from({ length: 1000 }, (_, i) => answerIndexFor(WORD_EPOCH_DAY + i, 1000)));
    expect(picks.size).toBe(1000);
    expect(answerIndexFor(WORD_EPOCH_DAY + 3, 1000)).toBe(answerIndexFor(WORD_EPOCH_DAY + 3, 1000));
  });

  it('counts a streak of days solved, up to today', () => {
    const today = 500;
    expect(wordStreak([row(498, 'won'), row(499, 'won'), row(500, 'won')], today)).toBe(3);
    // Today not played yet: the run up to yesterday still stands.
    expect(wordStreak([row(498, 'won'), row(499, 'won')], today)).toBe(2);
    expect(wordStreak([row(498, 'won'), row(499, 'won'), row(500, 'playing')], today)).toBe(2);
    // A day lost, or a day missed, ends it.
    expect(wordStreak([row(499, 'won'), row(500, 'lost')], today)).toBe(0);
    expect(wordStreak([row(497, 'won'), row(499, 'won')], today)).toBe(1);
    expect(wordStreak([row(497, 'won'), row(498, 'lost'), row(499, 'won')], today)).toBe(1);
    expect(wordStreak([], today)).toBe(0);
  });

  it('counts every finished day as played, solved or not', () => {
    expect(daysPlayed([row(1, 'won'), row(2, 'lost'), row(3, 'playing')])).toBe(2);
  });

  it('says where today stands for the card', () => {
    expect(wordTileView([], 10)).toEqual({ streak: 0, played: 0, today: 'not-yet', guessesUsed: 0 });
    expect(wordTileView([row(10, 'won')], 10).today).toBe('solved');
    expect(wordTileView([row(10, 'lost', Array(6).fill('smoke'))], 10).today).toBe('not-solved');
    expect(wordTileView([row(10, 'playing', [])], 10).today).toBe('not-yet');
    expect(wordTileView([row(10, 'playing', ['smoke', 'flame'])], 10)).toMatchObject({ today: 'in-progress', guessesUsed: 2 });
  });
});

describe('Cooee Word words on screen', () => {
  it('says the streak, the days played and the guesses as figures', () => {
    expect(copy.WORD_RESULT_STATS(1, 1, 2).map((stat) => `${stat.figure} ${stat.label}`)).toEqual(['1 day streak', '1 day played', '2/6 guesses']);
    expect(copy.WORD_RESULT_STATS(4, 23, 6)[1].label).toBe('days played');
    expect(copy.WORD_TILE_TODAY['in-progress'](2)).toBe('2 of 6 guesses');
  });

  it('names letters and counts in words', () => {
    expect(copy.LETTER_LABEL('e', copy.LETTER_MARK.right)).toBe('E, right place');
    expect(copy.WORD_FACTS(5)[0]).toEqual({ figure: '5', label: 'letters' });
    expect(copy.WORD_TOO_SHORT(7)).toBe('Type all seven letters first.');
    expect(copy.WORD_GUESSES_LEFT(1)).toBe('One guess left');
    expect(copy.WORD_SOLVED(3)).toBe('Solved in three guesses');
    expect(copy.WORD_SOLVED(1)).toBe('Solved in one guess');
    expect(copy.WORD_ANSWER_WAS('ember')).toBe('The word was EMBER.');
    expect(copy.NUMBER_WORD(13)).toBe('13');
  });
});
