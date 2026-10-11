// Cooee Word — the rules of the daily word game, kept apart from the screen so
// they can be tested without one. One word a Melbourne calendar day, the same
// on every phone, six guesses, and only real words count as guesses.
//
// The answers and their facts live in word-answers.ts, which is large and is
// loaded only by the game screen. Nothing here imports it.

import { cyclePick } from './seeded';
import type { WordDay } from './types';

export const WORD_GUESSES = 6;
export const WORD_MIN = 4;
export const WORD_MAX = 7;
/** The Melbourne day of the first word, 10 October 2026: word number 1. */
export const WORD_EPOCH_DAY = 20_736;

/** The word's number, counted from the first day. */
export const puzzleNumber = (day: number): number => day - WORD_EPOCH_DAY + 1;

/** Which answer a day has, out of `count`. Every answer comes once before any
 *  comes again, in an order shuffled afresh each time round. */
export const answerIndexFor = (day: number, count: number): number => cyclePick(day - WORD_EPOCH_DAY, count, 'cooee-word');

/** What one letter of a guess says about the answer: in that place, in the
 *  word elsewhere, or not in the word (or not as many times). */
export type Mark = 'right' | 'present' | 'absent';

/** The marks for a guess, letter by letter. A letter that appears more often
 *  in the guess than in the answer is marked only as often as the answer
 *  holds it, places that match first. */
export function markGuess(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array.from({ length: guess.length }, () => 'absent');
  const spare = new Map<string, number>();
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) marks[i] = 'right';
    else spare.set(answer[i], (spare.get(answer[i]) ?? 0) + 1);
  }
  for (let i = 0; i < guess.length; i++) {
    if (marks[i] === 'right') continue;
    const left = spare.get(guess[i]) ?? 0;
    if (left > 0) {
      marks[i] = 'present';
      spare.set(guess[i], left - 1);
    }
  }
  return marks;
}

const RANK: Record<Mark, number> = { absent: 0, present: 1, right: 2 };

/** What each letter key shows after these guesses: the most it has been
 *  known to be. A letter not yet tried has no mark. */
export function keyboardMarks(guesses: string[], answer: string): Record<string, Mark> {
  const keys: Record<string, Mark> = {};
  for (const guess of guesses) {
    markGuess(guess, answer).forEach((mark, i) => {
      const letter = guess[i];
      if (!(letter in keys) || RANK[mark] > RANK[keys[letter]]) keys[letter] = mark;
    });
  }
  return keys;
}

/** Whether `word` is in a list of words all `length` letters long, stored as
 *  one sorted string with the words end to end. A binary search, so the
 *  list never has to be split up. */
export function inWordList(list: string, length: number, word: string): boolean {
  if (word.length !== length || list.length % length !== 0) return false;
  let low = 0;
  let high = list.length / length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const candidate = list.slice(middle * length, middle * length + length);
    if (candidate === word) return true;
    if (candidate < word) low = middle + 1;
    else high = middle - 1;
  }
  return false;
}

/** Why a typed guess cannot be entered yet, or 'ok'. */
export type GuessCheck = 'ok' | 'short' | 'not-a-word' | 'repeat';

export function checkGuess(guess: string, length: number, known: boolean, tried: string[]): GuessCheck {
  if (guess.length < length) return 'short';
  if (tried.includes(guess)) return 'repeat';
  return known ? 'ok' : 'not-a-word';
}

/** Where a day stands after these guesses. */
export function statusAfter(guesses: string[], answer: string): WordDay['status'] {
  if (guesses.at(-1) === answer) return 'won';
  return guesses.length >= WORD_GUESSES ? 'lost' : 'playing';
}

/** Days solved in a row, up to today. Today still unplayed (or under way)
 *  does not break the run yet: the count runs from yesterday. A day not
 *  solved, or not played at all, ends it. */
export function wordStreak(rows: WordDay[], today: number): number {
  const status = new Map(rows.map((row) => [row.day, row.status]));
  const now = status.get(today);
  if (now === 'lost') return 0;
  let day = now === 'won' ? today : today - 1;
  let streak = 0;
  while (status.get(day) === 'won') {
    streak += 1;
    day -= 1;
  }
  return streak;
}

/** Every day with a finished game, solved or not. */
export const daysPlayed = (rows: WordDay[]): number => rows.filter((row) => row.status !== 'playing').length;

/** The last seven days, oldest first and ending today: true where solved. */
export function solvedWeek(rows: WordDay[], today: number): boolean[] {
  const solved = new Set(rows.filter((row) => row.status === 'won').map((row) => row.day));
  return Array.from({ length: 7 }, (_, i) => solved.has(today - 6 + i));
}

/** How many earlier words the result lists, so it stays one short glance. */
export const PAST_WORDS_LIMIT = 7;

/** One earlier word as the result lists it. */
export type PastWord = { number: number; word: string; status: WordDay['status']; guesses: number };

/** The words of the days before today that were played, newest first, at
 *  most PAST_WORDS_LIMIT. Today is never among them: its word is the one on
 *  screen. A day left part way is listed too, as its word can no longer be
 *  played. */
export function pastWords(rows: WordDay[], today: number): PastWord[] {
  return rows
    .filter((row) => row.day < today)
    .sort((a, b) => b.day - a.day)
    .slice(0, PAST_WORDS_LIMIT)
    .map((row) => ({ number: puzzleNumber(row.day), word: row.answer, status: row.status, guesses: row.guesses.length }));
}

/** What the game's card on the Rehearse screen says. */
export type WordTileView = {
  streak: number;
  played: number;
  today: 'solved' | 'not-yet' | 'in-progress' | 'not-solved';
  guessesUsed: number;
};

export function wordTileView(rows: WordDay[], today: number): WordTileView {
  const row = rows.find((candidate) => candidate.day === today);
  const state =
    row === undefined ? 'not-yet'
    : row.status === 'won' ? 'solved'
    : row.status === 'lost' ? 'not-solved'
    : row.guesses.length === 0 ? 'not-yet'
    : 'in-progress';
  return { streak: wordStreak(rows, today), played: daysPlayed(rows), today: state, guessesUsed: row?.guesses.length ?? 0 };
}
