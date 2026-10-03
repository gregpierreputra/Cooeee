import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

// The service worker only behaves like production in a production build, and the
// offline claim is a claim about production. So e2e always runs the real bundle.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // A committed test.only would shrink the suite to one test and still pass.
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: [
    {
      command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}/`,
      // Always a fresh build: a preview left running would serve an old dist/
      // and the suite would test it without a word. With the port taken, the
      // run stops instead. PW_REUSE=1 opts in when the build is known current.
      reuseExistingServer: Boolean(process.env.PW_REUSE),
      timeout: 180_000,
    },
    {
      command: 'vite --config e2e/harness/vite.config.ts',
      url: 'http://127.0.0.1:4174/',
      // On CI the suite always tests a fresh build, never a server left running.
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
