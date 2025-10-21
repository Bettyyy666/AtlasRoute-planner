import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src/tests',
  testMatch: '**/*.playwright.test.ts',
  use: {
    baseURL: 'http://localhost:3002',
    trace: 'on-first-retry',
  },
  workers: 1,
  reporter: 'html',
});