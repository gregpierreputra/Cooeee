import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BANNED } from '../../src/core/banned-terms';
import { inWordList } from '../../src/core/word';
import { WORD_ANSWERS, WORD_SOURCES } from '../../src/core/word-answers';

const banned = new RegExp(`\\b(${BANNED.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');
const lists = Object.fromEntries(
  [4, 5, 6, 7].map((length) => [length, JSON.parse(readFileSync(`public/word/words-${length}.json`, 'utf8')) as string]),
);

describe('the Cooee Word answers', () => {
  it('are a thousand different words of four to seven letters', () => {
    expect(WORD_ANSWERS).toHaveLength(1000);
    expect(new Set(WORD_ANSWERS.map((entry) => entry.word)).size).toBe(1000);
    for (const { word } of WORD_ANSWERS) expect(word).toMatch(/^[a-z]{4,7}$/);
  });

  it('spread across every theme', () => {
    const themes = new Map<string, number>();
    for (const { theme } of WORD_ANSWERS) themes.set(theme, (themes.get(theme) ?? 0) + 1);
    expect(themes.size).toBe(8);
    for (const count of themes.values()) expect(count).toBeGreaterThanOrEqual(100);
  });

  it('are each a guess the game accepts', () => {
    for (const { word } of WORD_ANSWERS) expect(inWordList(lists[word.length], word.length, word), word).toBe(true);
  });

  it('never use a word the app may not say, as answer or in its fact', () => {
    for (const { word, fact } of WORD_ANSWERS) {
      expect(word, word).not.toMatch(banned);
      expect(fact.replace(/Neighbourhood Safer Places?/g, ''), word).not.toMatch(banned);
    }
  });

  it('each have one plain sentence of fact from a named source', () => {
    for (const { word, fact, source } of WORD_ANSWERS) {
      expect(fact.length, word).toBeLessThanOrEqual(150);
      expect(fact.endsWith('.'), word).toBe(true);
      expect(fact, word).not.toMatch(/[–—‘’“”]/);
      expect(WORD_SOURCES[source], word).toBeDefined();
    }
  });

  it('each have a short clue that never gives the word away', () => {
    for (const { word, clue } of WORD_ANSWERS) {
      expect(clue.length, word).toBeLessThanOrEqual(45);
      expect(clue.toLowerCase(), word).not.toContain(word.slice(0, 5));
      expect(clue, word).not.toMatch(banned);
      expect(clue, word).not.toMatch(/[\u2013\u2014;:]/);
    }
  });

  it('are loaded only by the game screen, so the main bundle stays small', () => {
    const importers: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && /from '[^']*word-answers'|import\('[^']*word-answers'\)/.test(readFileSync(path, 'utf8'))) importers.push(path);
      }
    };
    walk('src');
    expect(importers).toEqual([join('src', 'ui', 'Word', 'WordScreen.tsx')]);
    // There, only its types are imported at the top; the list itself comes in by import().
    const screen = readFileSync('src/ui/Word/WordScreen.tsx', 'utf8');
    expect(screen).toMatch(/import type \{[^}]*\} from '\.\.\/\.\.\/core\/word-answers'/);
    expect(screen).toContain("import('../../core/word-answers')");
  });
});
