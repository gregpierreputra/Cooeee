// Builds the real words Cooee Word accepts as guesses: public/word/words-4.json
// to words-7.json, each one string of that length's words, sorted, end to end
// (src/core/word.ts reads them with a binary search). The words come from the
// ENABLE list, which is in the public domain, plus every answer in
// src/core/word-answers.ts, so no answer can ever be refused as a guess.
//
// The files are JSON, not TypeScript, on purpose: the banned terms scan reads
// every string under src/, and a real dictionary holds words the app may never
// say, such as "safe". A guess is the player's word, not the app's.
//
// Run: npm run build:word:list            (downloads ENABLE, checks its hash)
//      node scripts/build-word-list.mjs enable1.txt   (uses a local copy)

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { WORD_ANSWERS } from '../src/core/word-answers.ts';

const ENABLE_URL = 'https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt';
const ENABLE_SHA256 = '3f16130220645692ed49c7134e24a18504c2ca55b3c012f7290e3e77c63b1a89';

const local = process.argv[2];
const text = local ? readFileSync(local, 'utf8') : await (await fetch(ENABLE_URL)).text();
const hash = createHash('sha256').update(text).digest('hex');
if (hash !== ENABLE_SHA256) throw new Error(`the ENABLE list has changed (sha256 ${hash}); check it before using it`);

const outDir = new URL('../public/word/', import.meta.url);
mkdirSync(outDir, { recursive: true });
for (let length = 4; length <= 7; length++) {
  const words = new Set(text.split(/\r?\n/).filter((word) => word.length === length && /^[a-z]+$/.test(word)));
  for (const { word } of WORD_ANSWERS) if (word.length === length) words.add(word);
  const joined = [...words].sort().join('');
  writeFileSync(new URL(`words-${length}.json`, outDir), JSON.stringify(joined));
  console.log(`public/word/words-${length}.json`, words.size, 'words', joined.length + 2, 'bytes');
}
