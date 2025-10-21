import { test, expect } from '@playwright/test';
import './setup';

test.describe('State Changes - Data Query Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/');
  });

  test('rapid data switching within ACS maintains form state', async ({ page }) => {
    // Verify we start with ACS selected
    await expect(page.getByLabel('Select data source for your query')).toHaveValue('ACS');
    
    // Select location and run initial ACS query
    await page.getByRole('combobox', { name: 'Search and select destination' }).click();
    await page.getByRole('option', { name: 'San Francisco, destination' }).click();
    await page.getByRole('button', { name: 'Run Query - Press Enter to activate' }).click();
    
    // Wait for results table to appear and verify ACS data structure
    await expect(page.locator('.results-table')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('table')).toBeVisible();
    
    // Change location and verify table updates
    await page.getByRole('combobox', { name: 'Search and select destination' }).click();
    await page.getByRole('combobox', { name: 'Search and select destination' }).fill('');
    await page.getByRole('option', { name: 'New York, destination option 2 of' }).click();
    await page.getByRole('button', { name: 'Run Query - Press Enter to activate' }).click();
    
    // Verify new results loaded (table should still be visible with new data)
    await expect(page.getByRole('table')).toBeVisible();
    
    // Test rapid location switching
    await page.getByRole('combobox', { name: 'Search and select destination' }).click();
    await page.getByRole('combobox', { name: 'Search and select destination' }).fill('');
    await page.getByRole('option', { name: 'Los Angeles, destination' }).click();
    await page.getByRole('button', { name: 'Run Query - Press Enter to activate' }).click();
    
    await expect(page.getByRole('table')).toBeVisible();
    
    // Final location change
    await page.getByRole('combobox', { name: 'Search and select destination' }).click();
    await page.getByRole('combobox', { name: 'Search and select destination' }).fill('');
    await page.getByRole('option', { name: 'Seattle, destination option 4 of' }).click();
    await page.getByRole('button', { name: 'Run Query - Press Enter to activate' }).click();
    
    // Verify final results and that we're still on ACS
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByLabel('Select data source for your query')).toHaveValue('ACS');
  });

  test('rapid data switching within FBI maintains form state', async ({ page }) => {
    // Switch to FBI data source
    await page.getByLabel('Select data source for your query').selectOption('FBI');
    await expect(page.getByLabel('Select data source for your query')).toHaveValue('FBI');
    
    // Verify FBI-specific form fields are visible
    await expect(page.getByLabel('Select geographic granularity for FBI crime data')).toBeVisible();
    await expect(page.getByLabel('Select year for FBI crime data')).toBeVisible();
    
    // Select location and run initial FBI query
    await page.getByRole('combobox', { name: 'Search and select destination' }).click();
    await page.getByRole('option', { name: 'San Francisco, destination' }).click();
    await page.getByRole('button', { name: 'Run Query - Press Enter to activate' }).click();
    
    // Wait for FBI results table
    await expect(page.locator('.results-table')).toBeVisible({ timeout: 10000 });
    
    // Change location and granularity
    await page.getByRole('combobox', { name: 'Search and select destination' }).click();
    await page.getByRole('combobox', { name: 'Search and select destination' }).fill('');
    await page.getByRole('option', { name: 'New York, destination option 2 of' }).click();
    await page.getByLabel('Select geographic granularity for FBI crime data').selectOption('state');
    await page.getByRole('button', { name: 'Run Query - Press Enter to activate' }).click();
    
    await expect(page.getByRole('table')).toBeVisible();
    
    // Test rapid location switching with FBI
    await page.getByRole('combobox', { name: 'Search and select destination' }).click();
    await page.getByRole('combobox', { name: 'Search and select destination' }).fill('');
    await page.getByRole('option', { name: 'Los Angeles, destination' }).click();
    await page.getByRole('button', { name: 'Run Query - Press Enter to activate' }).click();
    
    await expect(page.getByRole('table')).toBeVisible();
    
    // Final location change
    await page.getByRole('combobox', { name: 'Search and select destination' }).click();
    await page.getByRole('combobox', { name: 'Search and select destination' }).fill('');
    await page.getByRole('option', { name: 'Seattle, destination option 4 of' }).click();
    await page.getByRole('button', { name: 'Run Query - Press Enter to activate' }).click();
    
    // Verify final results and that we're still on FBI
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByLabel('Select data source for your query')).toHaveValue('FBI');
  });

  test('rapid data source switching preserves location and updates form correctly', async ({ page }) => {
    // Select location first
    await page.getByRole('combobox', { name: 'Search and select destination' }).click();
    await page.getByRole('option', { name: 'San Francisco, destination' }).click();
    
    // Start with ACS query
    await expect(page.getByLabel('Select data source for your query')).toHaveValue('ACS');
    await page.getByRole('button', { name: 'Run Query - Press Enter to activate' }).click();
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
    
    // Switch to FBI and verify form changes
    await page.getByLabel('Select data source for your query').selectOption('FBI');
    await expect(page.getByLabel('Select geographic granularity for FBI crime data')).toBeVisible();
    await expect(page.getByLabel('Select year for FBI crime data')).toBeVisible();
    
    // Run FBI query
    await page.getByRole('button', { name: 'Run Query - Press Enter to activate' }).click();
    await expect(page.getByRole('table')).toBeVisible();
    
    // Switch back to ACS and verify form changes back
    await page.getByLabel('Select data source for your query').selectOption('ACS');
    await expect(page.getByLabel('Enter ACS variables separated by commas')).toBeVisible();
    await expect(page.getByLabel('Select geographic top level for ACS data')).toBeVisible();
    await expect(page.getByLabel('Select geographic bottom level for ACS data')).toBeVisible();
    
    // Run ACS query again
    await page.getByRole('button', { name: 'Run Query - Press Enter to activate' }).click();
    await expect(page.getByRole('table')).toBeVisible();
    
    // Final switch to FBI
    await page.getByLabel('Select data source for your query').selectOption('FBI');
    await page.getByRole('button', { name: 'Run Query - Press Enter to activate' }).click();
    await expect(page.getByRole('table')).toBeVisible();
    
    // Final switch back to ACS
    await page.getByLabel('Select data source for your query').selectOption('ACS');
    await page.getByRole('button', { name: 'Run Query - Press Enter to activate' }).click();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('table data replacement works correctly for different data sources', async ({ page }) => {
    // Select location
    await page.getByRole('combobox', { name: 'Search and select destination' }).click();
    await page.getByRole('option', { name: 'San Francisco, destination' }).click();
    
    // Run ACS query and verify table structure
    await page.getByRole('button', { name: 'Run Query - Press Enter to activate' }).click();
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
    
    // Store reference to first table content
    const acsTableContent = await page.locator('.results-table tbody').textContent();
    
    // Switch to FBI and run query
    await page.getByLabel('Select data source for your query').selectOption('FBI');
    await page.getByRole('button', { name: 'Run Query - Press Enter to activate' }).click();
    await expect(page.getByRole('table')).toBeVisible();
    
    // Verify table content changed (FBI has different structure)
    const fbiTableContent = await page.locator('.results-table tbody').textContent();
    expect(fbiTableContent).not.toBe(acsTableContent);
    
    // Switch back to ACS and verify content changes again
    await page.getByLabel('Select data source for your query').selectOption('ACS');
    await page.getByRole('button', { name: 'Run Query - Press Enter to activate' }).click();
    await expect(page.getByRole('table')).toBeVisible();
    
    const finalAcsTableContent = await page.locator('.results-table tbody').textContent();
    expect(finalAcsTableContent).not.toBe(fbiTableContent);
  });

  test('error handling during state transitions', async ({ page }) => {
    // Test error handling when no location is selected for FBI
    await page.getByLabel('Select data source for your query').selectOption('FBI');
    await page.getByLabel('Select geographic granularity for FBI crime data').selectOption('state');
    
    // Try to run query without location (should show error)
    await page.getByRole('button', { name: 'Run Query - Press Enter to activate' }).click();
    
    // Check for error message
    await expect(page.locator('.error-message')).toBeVisible({ timeout: 5000 });
    
    // Add location and verify error clears
    await page.getByRole('combobox', { name: 'Search and select destination' }).click();
    await page.getByRole('option', { name: 'San Francisco, destination' }).click();
    await page.getByRole('button', { name: 'Run Query - Press Enter to activate' }).click();
    
    // Error should be gone and table should appear
    await expect(page.locator('.error-message')).not.toBeVisible();
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
  });
});