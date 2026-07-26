// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8877',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'python3 -m http.server 8877',
    url: 'http://localhost:8877/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // This repo's pinned @playwright/test version may not match whatever
        // browser revision is pre-installed in a given CI/dev environment.
        // Point straight at a system Chromium when one is available (set
        // PLAYWRIGHT_CHROMIUM_PATH) instead of requiring `playwright install`.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],
});
