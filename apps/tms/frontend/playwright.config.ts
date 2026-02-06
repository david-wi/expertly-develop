import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for TMS E2E tests.
 *
 * By default tests run against a local dev server on port 5175.
 * Set BASE_URL=https://tms.ai.devintensive.com to test against production.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 30_000,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5175',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  /* Only start local dev server when not using an external BASE_URL */
  ...(process.env.BASE_URL
    ? {}
    : {
        webServer: {
          command: 'npm run dev -- --port 5175',
          url: 'http://localhost:5175',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
