// Banned-terms scan. Part of `npm run verify`, so a forbidden wording fails the
// build rather than reaching a screen. Word-boundary, case-insensitive, over
// every string literal and template chunk under src/.
//
// The lists are read from src/core/banned-terms.ts itself — one source of truth,
// shared with the unit test.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

// Defaults to src/. A root can be passed so the test suite can run the real
// scanner over fixtures rather than reimplementing the match and drifting from it.
const SRC = process.argv[2] ?? 'src';
const LISTS = join('src', 'core', 'banned-terms.ts');

const loadLists = async () => {
  const js = ts.transpileModule(readFileSync(LISTS, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
};

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(full) ? [full] : [];
  });

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A module specifier is not user-facing, and 'react-router' is not a promise of
// turn-by-turn navigation.
const isModuleSpecifier = (node) => {
  const p = node.parent;
  return (
    p &&
    (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) &&
    p.moduleSpecifier === node
  );
};

const literalsIn = (file) => {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true);
  const found = [];
  const visit = (node) => {
    const kind = node.kind;
    const isChunk =
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      kind === ts.SyntaxKind.TemplateHead ||
      kind === ts.SyntaxKind.TemplateMiddle ||
      kind === ts.SyntaxKind.TemplateTail;
    if (isChunk && !isModuleSpecifier(node)) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      found.push({ text: node.text, line: line + 1 });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
};

const { BANNED, ALLOWED } = await loadLists();

const allowed = ALLOWED.map((phrase) => new RegExp(escape(phrase), 'gi'));
const banned = BANNED.map((term) => ({ term, re: new RegExp(`\\b${escape(term)}\\b`, 'i') }));

const hits = [];
for (const file of walk(SRC)) {
  if (relative('.', file) === relative('.', LISTS)) continue; // it IS the list
  for (const { text, line } of literalsIn(file)) {
    const stripped = allowed.reduce((acc, re) => acc.replace(re, ' '), text);
    for (const { term, re } of banned) {
      if (re.test(stripped)) hits.push({ file, line, term, text });
    }
  }
}

if (hits.length > 0) {
  for (const h of hits) {
    console.error(`${h.file}:${h.line}  banned term "${h.term}" in ${JSON.stringify(h.text)}`);
  }
  console.error(`\nbanned-terms: ${hits.length} hit(s)`);
  process.exit(1);
}

console.log('banned-terms: clean');
