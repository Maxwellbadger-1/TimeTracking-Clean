import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for TimeTracking E2E Tests
 *
 * Tests the Desktop App running on Tauri Dev Server (http://localhost:1420)
 * with Backend Server on http://localhost:3000
 */
export default defineConfig({
  testDir: './tests',

  // Run tests sequentially to avoid database conflicts
  fullyParallel: false,
  workers: 1,

  // Fail fast on CI
  forbidOnly: !!process.env.CI,

  // Retry failed tests
  retries: process.env.CI ? 2 : 0,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  // Shared test configuration
  use: {
    // Base URL for Tauri Dev Server
    baseURL: 'http://localhost:1420',

    // Trace & Screenshots
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Timeouts
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  // Test projects (browsers)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Dev server configuration (optional - start Tauri automatically)
  // webServer: {
  //   command: 'npm run tauri dev',
  //   url: 'http://localhost:1420',
  //   timeout: 120000,
  //   reuseExistingServer: true,
  // },
});
