import { test } from '@playwright/test';

// Simple setup file for Playwright tests
// Mock server setup is handled individually in each test file

test.beforeAll(() => {
  // Global test setup if needed
  console.log('Starting test suite');
});

test.afterEach(() => {
  // Reset any global state after each test
});

test.afterAll(() => {
  // Global cleanup after all tests
  console.log('Test suite completed');
});
