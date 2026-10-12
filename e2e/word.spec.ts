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
    await expect(page.locator('.word-result .game-facts')).toContainText('1 day streak');

    // A finished day reads the same when opened again, and takes no more guesses.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Solved in two guesses' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Letters' })).toHaveCount(0);
  });

  test('a solved day adds to the streak from the days before', async ({ page }) => {
    await open(page, '?history=lost,won,won');
    await type(page, answer.word);
    await expect(page.getByRole('heading', { name: 'Solved in one guess' })).toBeVisible();
    await expect(page.locator('.word-result .game-facts li').first()).toHaveText('3 day streak');
    await expect(page.locator('.word-result .game-facts li').nth(1)).toHaveText('4 days played');
  });

  test('the result lists the words of the days before, newest first', async ({ page }) => {
    const later = WORD_ANSWERS[answerIndexFor(DAY + 10, WORD_ANSWERS.length)];
    await page.goto(`${HARNESS}/word?day=10&history=lost,won`);
    await expect(page.getByRole('heading', { name: 'Word 11' })).toBeVisible();
    await type(page, later.word);
    // Closed at first, so Done stays near the result.
    const toggle = page.getByRole('button', { name: 'Past words', exact: true });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.word-past-list')).toHaveCount(0);
    await toggle.click();
    const past = page.getByRole('region', { name: 'Past words' });
    await expect(past.getByRole('listitem')).toHaveText([
      /^Word 10\s*Solved in 1\s*EMBER/,
      /^Word 9\s*Not solved\s*EMBER/,
    ]);
    // Each opens why it matters, one at a time.
    const ember = WORD_ANSWERS.find((entry) => entry.word === 'ember')!;
    const [newest, older] = await past.getByRole('listitem').getByRole('button').all();
    await newest.click();
    await expect(newest).toHaveAttribute('aria-expanded', 'true');
    await expect(past.locator('.word-fact')).toHaveCount(1);
    await expect(past.locator('.word-fact')).toContainText(ember.fact);
    await older.click();
    await expect(newest).toHaveAttribute('aria-expanded', 'false');
    await expect(past.locator('.word-fact')).toHaveCount(1);
    await older.click();
    await expect(past.locator('.word-fact')).toHaveCount(0);
  });

  test('seven past words show first, and Show more brings the rest', async ({ page }) => {
    const later = WORD_ANSWERS[answerIndexFor(DAY + 20, WORD_ANSWERS.length)];
    await page.goto(`${HARNESS}/word?day=20&history=${Array(9).fill('won').join(',')}`);
    await expect(page.getByRole('heading', { name: 'Word 21' })).toBeVisible();
    await type(page, later.word);
    await page.getByRole('button', { name: 'Past words', exact: true }).click();
    const past = page.getByRole('region', { name: 'Past words' });
    await expect(past.locator('.word-past-row')).toHaveCount(7);
    await past.getByRole('button', { name: 'Show 2 more' }).click();
    await expect(past.locator('.word-past-row')).toHaveCount(9);
    await expect(past.locator('.word-past-row').last()).toContainText('Word 12');
    await past.getByRole('button', { name: 'Show fewer' }).click();
    await expect(past.locator('.word-past-row')).toHaveCount(7);
  });

  test('a first day has no past words', async ({ page }) => {
    await open(page);
    await type(page, answer.word);
    await expect(page.getByRole('heading', { name: 'Solved in one guess' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Past words/ })).toHaveCount(0);
  });

  test('six misses end the day and give the word', async ({ page }) => {
    await open(page);
    const others = WORD_ANSWERS.filter((entry) => entry.word.length === answer.word.length && entry.word !== answer.word).slice(0, 6);
    for (const other of others) await type(page, other.word);
    await expect(page.getByRole('heading', { name: 'Not this time' })).toBeVisible();
    await expect(page.getByRole('img', { name: `The word was ${answer.word.toUpperCase()}.` })).toHaveText(answer.word.toUpperCase());
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
