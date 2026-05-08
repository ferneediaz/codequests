import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env.test before defineConfig so values are visible to webServer
// env, baseURL overrides, etc. .env.test is git-ignored — see
// e2e/.env.test.example for required keys.
const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, '.env.test') });

// Authenticated specs depend on the `setup` project, which writes per-user
// storageState files into e2e/.auth/. Public smoke tests skip the
// dependency so they still run on a fresh checkout without bootstrap.

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'list',
    timeout: 120_000,
    expect: { timeout: 15_000 },
    use: {
        // Vite dev server runs on 5174 (vite.config.ts pins it via strictPort).
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5174',
        trace: 'on-first-retry',
        video: 'retain-on-failure',
    },
    projects: [
        {
            name: 'public',
            testMatch: /public\.spec\.ts/,
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'setup',
            testMatch: /auth\.setup\.ts/,
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'chromium',
            testIgnore: [/public\.spec\.ts/, /auth\.setup\.ts/],
            dependencies: ['setup'],
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: process.env.PLAYWRIGHT_BASE_URL
        ? undefined
        : {
              command: 'npm run dev',
              url: 'http://localhost:5174',
              reuseExistingServer: !process.env.CI,
              timeout: 120_000,
          },
});
