import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { answerIndexFor, inWordList } from '../src/core/word';
import { WORD_ANSWERS } from '../src/core/word-answers';
import { HARNESS } from './helpers';

// Cooee Word, on the harness's fixed day (word number 1).
const DAY = 20_736;
const answer = WORD_ANSWERS[answerIndexFor(DAY, WORD_ANSWERS.length)];
const list = JSON.parse(readFileSync(`public/word/words-${answer.word.length}.json`, 'utf8')) as string;
// A real word of the same length that is not the answer, for a wrong guess.
const wrong = WORD_ANSWERS.find((entry) => entry.word.length === answer.word.length && entry.word !== answer.word)!.word;

/** Open the day's word and wait for it to be ready to type into. */
const open = async (page: Page, query = '') => {
  await page.goto(`${HARNESS}/word${query}`);
  await expect(page.getByRole('heading', { name: 'Word 1' })).toBeVisible();
};

const type = async (page: Page, word: string) => {
  await page.keyboard.type(word);
  await page.keyboard.press('Enter');
};

test.describe('Cooee Word', () => {
  test('a guess must be whole and a real word', async ({ page }) => {
    expect(inWordList(list, answer.word.length, wrong)).toBe(true);
    await open(page);
    await type(page, wrong.slice(0, 2));
    await expect(page.locator('.word-message')).toContainText('letters first');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await type(page, 'q'.repeat(answer.word.length));
    await expect(page.locator('.word-message')).toHaveText('That is not in the word list. Try another word.');
  });

  test('marks a guess in words, keeps it over a reload, and shows the fact when solved', async ({ page }) => {
    await open(page);
    await type(page, wrong);
    const first = page.getByRole('list', { name: 'Your guesses' }).getByRole('listitem').first();
    await expect(first).toHaveAttribute('aria-label', new RegExp(`^Guess 1: ${wrong[0].toUpperCase()}, `));
    await expect(page.locator('.word-message')).toHaveText('Five guesses left');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Word 1' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Your guesses' }).getByRole('listitem').first()).toHaveAttribute('aria-label', /^Guess 1: /);

    // The on screen keys type too.
    for (const letter of answer.word) await page.getByRole('button', { name: new RegExp(`^${letter.toUpperCase()}(,|$)`) }).click();
    await page.getByRole('button', { name: 'Enter' }).click();
    await expect(page.getByRole('heading', { name: 'Solved in two guesses' })).toBeVisible();
    await expect(page.locator('.word-fact')).toContainText(answer.fact);
    await expect(page.locator('.word-counts')).toHaveText('1 day streak · 1 day played');

    // A finished day reads the same when opened again, and takes no more guesses.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Solved in two guesses' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Letters' })).toHaveCount(0);
  });

  test('a solved day adds to the streak from the days before', async ({ page }) => {
    await open(page, '?history=lost,won,won');
    await type(page, answer.word);
    await expect(page.getByRole('heading', { name: 'Solved in one guess' })).toBeVisible();
    await expect(page.locator('.word-counts')).toHaveText('3 day streak · 4 days played');
  });

  test('six misses end the day and give the word', async ({ page }) => {
    await open(page);
    const others = WORD_ANSWERS.filter((entry) => entry.word.length === answer.word.length && entry.word !== answer.word).slice(0, 6);
    for (const other of others) await type(page, other.word);
    await expect(page.getByRole('heading', { name: 'Not this time' })).toBeVisible();
    await expect(page.locator('.word-answer')).toHaveText(`The word was ${answer.word.toUpperCase()}.`);
  });

  test('keys are large enough to hit', async ({ page }) => {
    await open(page);
    const keys = page.locator('.word-key');
    await expect(keys).toHaveCount(28);
    for (const key of await keys.all()) {
      const box = (await key.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(24);
    }
  });
});
