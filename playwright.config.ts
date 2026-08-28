import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

// The service worker only behaves like production in a production build, and the
// offline claim is a claim about production. So e2e always runs the real bundle.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: [
    {
      command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}/`,
      reuseExistingServer: true,
      timeout: 180_000,
    },
    {
      command: 'vite --config e2e/harness/vite.config.ts',
      url: 'http://127.0.0.1:4174/',
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
