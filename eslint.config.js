import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// The UI reads packs through the two sanctioned functions. A raw table handle in
// a component is exactly how a half-built pack becomes visible, so it is blocked
// here rather than left to convention.
const NO_RAW_DB = {
  paths: [
    {
      name: '../data/db',
      importNames: ['db'],
      message: 'Use a complete-pack read API. A raw table read can expose a building pack.',
    },
    {
      name: '../../data/db',
      importNames: ['db'],
      message: 'Use a complete-pack read API. A raw table read can expose a building pack.',
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'dev-dist/**',
      'coverage/**',
      'node_modules/**',
      '**/worktrees/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { import: importPlugin },
    rules: {
      'import/first': 'error',
      'import/no-duplicates': 'error',
    },
  },

  { files: ['src/ui/**/*.tsx'], ...jsxA11y.flatConfigs.recommended },

  // RULE 1 — src/core imports nothing with an I/O surface. All decision logic
  // lives here and is unit-tested; pure computation packages are permitted.
  {
    files: ['src/core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['react*', 'dexie*', '../data/*', '../ui/*'] },
      ],
    },
  },

  { files: ['src/ui/**'], rules: { 'no-restricted-imports': ['error', NO_RAW_DB] } },

  // RULE 2 — the offline surfaces import no network path and cannot call fetch.
  // Recovery.tsx reaches probe.ts only, the one sanctioned same-origin request.
  {
    files: ['src/ui/BlackSky.tsx', 'src/ui/Recovery.tsx', 'src/ui/PackDetail.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        { ...NO_RAW_DB, patterns: ['**/wfs', '**/tiles', '**/snapshots'] },
      ],
      'no-restricted-globals': ['error', 'fetch'],
    },
  },

  {
    files: ['scripts/**/*.mjs', '*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
);
