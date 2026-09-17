import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // The gate covers the pure decision layer. Every file under src/core is
      // measured whether or not a test imports it, so an untested core module
      // pulls the number down. The 90 percent holds across the layer as a
      // whole, not file by file: a small untested file can hide in the total,
      // so a new core module still needs its own test asked for in review.
      include: ['src/core/**'],
      exclude: ['src/core/types.ts'],
      reporter: ['text-summary'],
      thresholds: { branches: 90, functions: 90, lines: 90, statements: 90 },
    },
  },
});
