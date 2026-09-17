// Snapshot-age gate. Part of `npm run verify`: a build cannot ship snapshots the
// team has stopped refreshing, because a stale snapshot rendered without comment
// is exactly the silent all-clear the product forbids.
//
// Shape-agnostic on purpose — it collects every retrievedAt in the index and
// judges the oldest, so it keeps working as the index grows without pre-deciding
// a schema the data scripts have not written yet.

import { existsSync, readFileSync } from 'node:fs';

const INDEX = 'public/data/index.json';
const SOURCES = 'src/data/sources.json'; // the rendered source pages
const CONSTANTS = 'src/core/constants.ts';

// The app cannot load its data without the index, so a missing one fails the
// gate. It used to pass, which would have let a deleted snapshot ship.
if (!existsSync(INDEX)) {
  console.error(`snapshot-age: ${INDEX} is missing, so the app would have no snapshots to load`);
  process.exit(1);
}

// The limit is read straight out of constants.ts so the threshold has ONE home.
// A rename or reformat there fails here loudly rather than drifting silently.
const match = readFileSync(CONSTANTS, 'utf8').match(/SNAPSHOT_MAX_AGE_DAYS = (\d+)/);
if (!match) {
  console.error(`snapshot-age: SNAPSHOT_MAX_AGE_DAYS not found in ${CONSTANTS}`);
  process.exit(1);
}
const SNAPSHOT_MAX_AGE_DAYS = Number(match[1]);
const MS_PER_DAY = 86_400_000;

const stamps = [];
const collect = (node) => {
  if (Array.isArray(node)) return node.forEach(collect);
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'retrievedAt' && typeof value === 'number') stamps.push(value);
      else collect(value);
    }
  }
};
const index = JSON.parse(readFileSync(INDEX, 'utf8'));
collect(index);

// Every snapshot file the index names must be there to be loaded.
const named = [];
const collectFiles = (node) => {
  if (Array.isArray(node)) return node.forEach(collectFiles);
  if (node && typeof node === 'object') return Object.values(node).forEach(collectFiles);
  if (typeof node === 'string' && /\.json$/.test(node)) named.push(node);
};
collectFiles(index);
const missing = named.filter((file) => !existsSync(`public/data/${file.replace(/^\/?(data\/)?/, '')}`));
if (missing.length > 0) {
  console.error(`snapshot-age: the index names ${missing.join(', ')}, which is not in public/data`);
  process.exit(1);
}
if (existsSync(SOURCES)) collect(JSON.parse(readFileSync(SOURCES, 'utf8')));

if (stamps.length === 0) {
  console.error(`snapshot-age: ${INDEX} carries no retrievedAt — provenance is not optional`);
  process.exit(1);
}

// A date in the future is a clock or a typing mistake, and would read as fresh for ever.
if (Math.max(...stamps) > Date.now() + MS_PER_DAY) {
  console.error('snapshot-age: a snapshot is dated in the future');
  process.exit(1);
}

const oldest = Math.min(...stamps);
const days = Math.floor((Date.now() - oldest) / MS_PER_DAY);

if (days > SNAPSHOT_MAX_AGE_DAYS) {
  console.error(
    `snapshot-age: oldest snapshot is ${days} days old, over the ${SNAPSHOT_MAX_AGE_DAYS}-day limit`,
  );
  process.exit(1);
}

console.log(
  `snapshot-age: ${stamps.length} snapshot(s), oldest ${days} days (limit ${SNAPSHOT_MAX_AGE_DAYS})`,
);
