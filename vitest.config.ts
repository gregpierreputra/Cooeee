import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // The gate covers the pure decision layer. Every file under src/core is
      // measured whether or not a test imports it, so an untested core module
      // fails the build rather than quietly diluting the number.
      include: ['src/core/**'],
      exclude: ['src/core/types.ts'],
      reporter: ['text-summary'],
      thresholds: { branches: 90, functions: 90, lines: 90, statements: 90 },
    },
  },
});
