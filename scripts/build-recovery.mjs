// Builds the precached recovery programs snapshot from the hand-maintained list
// in scripts/recovery-sources.json: facts and links only, no publisher text.
// Every URL must sit on OFFICIAL_DOMAINS and every program must carry a need.
// Writes public/data/recovery.v<date>.json and registers it in index.json.
// Run: npm run build:data:recovery (only when the program list changes).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const NEEDS = ['stay', 'money', 'food', 'property', 'health', 'documents'];
const TELEPHONE = /^[0-9 +]+$/;
const isoDate = (epochMs) => new Date(epochMs).toISOString().slice(0, 10);

// The allow-list is read straight out of constants.ts so it has ONE home.
const constants = readFileSync(new URL('../src/core/constants.ts', import.meta.url), 'utf8');
const domainsBlock = constants.match(/OFFICIAL_DOMAINS = \[([^\]]+)\]/);
if (!domainsBlock) throw new Error('OFFICIAL_DOMAINS not found in src/core/constants.ts');
const OFFICIAL_DOMAINS = [...domainsBlock[1].matchAll(/'([^']+)'/g)].map(([, domain]) => domain);

const isOfficial = (text) => {
  const url = new URL(text);
  return url.protocol === 'https:'
    && OFFICIAL_DOMAINS.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
};

const retrievedAt = Date.now();
const snapshotDate = isoDate(retrievedAt);
const sources = JSON.parse(readFileSync(new URL('recovery-sources.json', import.meta.url), 'utf8'));

const programs = sources.map((row) => {
  const needs = row.needs ?? [];
  if (needs.length === 0 || needs.some((need) => !NEEDS.includes(need))) {
    throw new Error(`${row.id}: every program needs at least one known need`);
  }
  if (!isOfficial(row.officialUrl)) throw new Error(`${row.id}: officialUrl is not on OFFICIAL_DOMAINS`);
  if (row.telephone !== undefined && !TELEPHONE.test(row.telephone)) {
    throw new Error(`${row.id}: telephone must hold digits, spaces and a plus only`);
  }
  return {
    // The date is part of the id, so a later snapshot never overwrites rows an
    // older pack has already hashed into its manifest.
    id: `${row.id}@${snapshotDate}`,
    org: row.org,
    title: row.title,
    covers: row.covers,
    needs,
    officialUrl: row.officialUrl,
    ...(row.telephone ? { telephone: row.telephone } : {}),
    snapshotDate,
    source: { publisher: row.publisher, url: row.officialUrl, licence: row.licence, retrievedAt },
  };
});

const file = `recovery.v${snapshotDate}.json`;
const outputDir = new URL('../public/data/', import.meta.url);
mkdirSync(outputDir, { recursive: true });
writeFileSync(new URL(file, outputDir), `${JSON.stringify({ snapshotDate, retrievedAt, programs })}\n`);

// index.json is shared with the other data scripts: merge this key, keep the rest.
const indexUrl = new URL('index.json', outputDir);
const index = existsSync(indexUrl) ? JSON.parse(readFileSync(indexUrl, 'utf8')) : {};
index.recovery = { file, retrievedAt };
writeFileSync(indexUrl, `${JSON.stringify(index, null, 2)}\n`);

console.log(`recovery: wrote ${programs.length} programs as at ${snapshotDate} to ${file}`);
