// Snapshot-age gate. Part of `npm run verify`: a build cannot ship snapshots the
// team has stopped refreshing, because a stale snapshot rendered without comment
// is exactly the silent all-clear the product forbids.
//
// Shape-agnostic on purpose — it collects every retrievedAt in the index and
// judges the oldest, so it keeps working as the index grows without pre-deciding
// a schema the data scripts have not written yet.

import { existsSync, readFileSync } from 'node:fs';
import ts from 'typescript';

const INDEX = 'public/data/index.json';
const CONSTANTS = 'src/core/constants.ts';

if (!existsSync(INDEX)) {
  console.log(`snapshot-age: no snapshots present (${INDEX} not built yet)`);
  process.exit(0);
}

const js = ts.transpileModule(readFileSync(CONSTANTS, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { SNAPSHOT_MAX_AGE_DAYS, MS_PER_DAY } = await import(
  'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
);

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
collect(JSON.parse(readFileSync(INDEX, 'utf8')));

if (stamps.length === 0) {
  console.error(`snapshot-age: ${INDEX} carries no retrievedAt — provenance is not optional`);
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
