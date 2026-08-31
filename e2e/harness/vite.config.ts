import { defineConfig } from 'vite';

export default defineConfig({
  root: 'e2e/harness',
  // The harness mounts real components with the real stylesheet, so it must
  // also serve the real static assets (the self-hosted font above all: several
  // specs assert ZERO runtime requests, which only holds when the font resolves
  // and is preloaded before the test starts counting).
  publicDir: '../../public',
  server: {
    host: '127.0.0.1',
    port: 4174,
    strictPort: true,
  },
});
