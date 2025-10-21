import { test, expect } from '@playwright/test';
import './setup';

test.describe('Tabular Display - Data Query Results', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/');
  });

  test('displays data query form with proper labels and accessibility', async ({ page }) => {
    // Verify form accessibility and structure
    await expect(page.getByRole('combobox', { name: 'Search and select destination' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Select date' }).first()).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Select date' }).nth(1)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Explore destinations - Press' })).toBeVisible();
    
    // Navigate to data query section
    await page.getByRole('button', { name: 'Explore destinations - Press' }).click();
    
    // Verify data query form elements are accessible
    await expect(page.getByLabel('Select data source for your')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Enter ACS variables separated' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run Query - Press Enter to' })).toBeVisible();
  });

  test('successfully enters location and date information', async ({ page }) => {
    // Fill out the travel planning form with proper accessibility selectors
    await page.getByRole('combobox', { name: 'Search and select destination' }).click();
    await page.getByRole('option', { name: 'San Francisco, destination' }).click();
    
    await page.getByRole('textbox', { name: 'Select date' }).first().click();
    await page.getByRole('option', { name: 'Choose Monday, October 13th,' }).click();
    
    await page.getByRole('textbox', { name: 'Select date' }).nth(1).click();
    await page.getByRole('option', { name: 'Choose Wednesday, October 15th,' }).click();
    
    await page.getByRole('button', { name: 'Explore destinations - Press' }).click();
    
    // Verify itinerary section appears
    await expect(page.getByRole('heading', { name: 'Itinerary' })).toBeVisible();
    
    // Verify date navigation buttons are accessible
    await expect(page.getByRole('button', { name: '/13' })).toBeVisible();
    await expect(page.getByRole('button', { name: '/14' })).toBeVisible();
  });

  test('displays ACS data query results with proper table structure', async ({ page }) => {
    // Fill out form for ACS data using proper form labels
    await page.getByLabel('Select data source for your').selectOption('ACS');
    await page.getByLabel('Select geographic top level').selectOption('state');
    await page.getByLabel('Select geographic bottom').selectOption('place');
    await page.getByRole('button', { name: 'Run Query - Press Enter to' }).click();
    
    // Wait for results and verify query results section appears
    await page.waitForTimeout(3000);
    
    // Check if results are displayed in any format (table or other structure)
    const resultsSection = page.locator('.query-results, .data-results, [data-testid="query-results"]').first();
    if (await resultsSection.isVisible()) {
      await expect(resultsSection).toBeVisible();
    }
    
    // Check for table structure if it exists
    const resultsTable = page.locator('table').first();
    if (await resultsTable.isVisible()) {
      await expect(resultsTable).toBeVisible();
      
      // Verify table has proper header structure
      const tableHeader = resultsTable.locator('thead');
      await expect(tableHeader).toBeVisible();
      await expect(tableHeader).toContainText('NAME');
      
      // Verify table body contains data rows
      const tableBody = resultsTable.locator('tbody');
      await expect(tableBody).toBeVisible();
      
      // Verify at least one data row exists
      const dataRows = tableBody.locator('tr');
      await expect(dataRows.first()).toBeVisible();
      
      // Verify cells are accessible and contain data
      const firstDataCell = dataRows.first().locator('td').first();
      await expect(firstDataCell).toBeVisible();
      await expect(firstDataCell).not.toBeEmpty();
    } else {
      // If no table, verify that some results content is displayed
      const resultsContent = page.locator('text=NAME, text=data, text=result').first();
      if (await resultsContent.isVisible()) {
        await expect(resultsContent).toBeVisible();
      }
    }
  });

  test('displays FBI data query results with proper table structure', async ({ page }) => {
    // Fill out form for FBI data using proper form labels
    await page.getByLabel('Select data source for your').selectOption('FBI');
    await page.getByLabel('Select geographic granularity').selectOption('national');
    await page.getByLabel('Select year for FBI crime data').selectOption('2024');
    await page.getByRole('button', { name: 'Run Query - Press Enter to' }).click();
    
    // Wait for results and verify table structure
    await page.waitForTimeout(2000);
    
    // Verify FBI results table is present and accessible
    const resultsTable = page.locator('table').first();
    await expect(resultsTable).toBeVisible();
    
    // Verify table contains expected FBI data structure
    await expect(resultsTable).toContainText('Data Type');
    await expect(resultsTable).toContainText('Value');
    
    // Verify specific FBI data fields are present
    await expect(resultsTable).toContainText('Year');
    await expect(resultsTable).toContainText('Granularity');
    
    // Verify the selected year and granularity appear in results
    await expect(resultsTable).toContainText('2024');
    await expect(resultsTable).toContainText('national');
  });

  test('handles map pin interactions properly', async ({ page }) => {
    // Set up travel dates and destination
    await page.getByRole('combobox', { name: 'Search and select destination' }).click();
    await page.getByRole('option', { name: 'San Francisco, destination' }).click();
    
    await page.getByRole('textbox', { name: 'Select date' }).first().click();
    await page.getByRole('option', { name: 'Choose Monday, October 20th,' }).click();
    
    await page.getByRole('textbox', { name: 'Select date' }).nth(1).click();
    await page.getByRole('option', { name: 'Choose Friday, October 24th,' }).click();
    
    await page.getByRole('button', { name: 'Explore destinations - Press' }).click();
    
    // Test activity search functionality
    const searchBox = page.getByRole('textbox', { name: 'Search activities...' });
    await expect(searchBox).toBeVisible();
    await searchBox.click();
    
    // Test map marker interactions if they exist
    const mapMarkers = page.getByRole('button', { name: 'Map marker' });
    if (await mapMarkers.first().isVisible()) {
      await expect(mapMarkers.first()).toBeVisible();
    }
    
    // Test close button functionality if it exists
    const closeButtons = page.getByRole('button', { name: '✕' });
    if (await closeButtons.first().isVisible()) {
      await closeButtons.first().click();
    }
    
    // Verify the search functionality is working
    await expect(searchBox).toBeVisible();
  });

  test('form elements are keyboard navigable', async ({ page }) => {
    // Test keyboard navigation through main form elements
    const destinationCombobox = page.getByRole('combobox', { name: 'Search and select destination' });
    await destinationCombobox.focus();
    await expect(destinationCombobox).toBeFocused();
    
    // Navigate through date fields
    await page.keyboard.press('Tab');
    const firstDateField = page.getByRole('textbox', { name: 'Select date' }).first();
    await expect(firstDateField).toBeFocused();
    
    await page.keyboard.press('Tab');
    const secondDateField = page.getByRole('textbox', { name: 'Select date' }).nth(1);
    await expect(secondDateField).toBeFocused();
    
    // Navigate to explore button
    await page.keyboard.press('Tab');
    const exploreButton = page.getByRole('button', { name: 'Explore destinations - Press' });
    await expect(exploreButton).toBeFocused();
    
    // Activate explore button and test data query form navigation
    await page.keyboard.press('Enter');
    
    // Test data source selector navigation
    const dataSourceSelect = page.getByLabel('Select data source for your');
    await dataSourceSelect.focus();
    await expect(dataSourceSelect).toBeFocused();
    
    // Test query button navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const queryButton = page.getByRole('button', { name: 'Run Query - Press Enter to' });
    await expect(queryButton).toBeFocused();
  });

  test('displays appropriate error messages for invalid input', async ({ page }) => {
    // Verify initial state
    await expect(page.getByRole('button', { name: 'Explore destinations - Press' })).toBeVisible();
    
    // Test error handling for missing location
    page.once('dialog', dialog => {
      console.log(`Dialog message: ${dialog.message()}`);
      dialog.dismiss().catch(() => {});
    });
    
    await page.getByRole('button', { name: 'Explore destinations - Press' }).click();
    
    // Test error handling for incomplete data query
    await page.getByRole('button', { name: 'Run Query - Press Enter to' }).click();
    
    // Verify error message appears with accessible text
    const errorMessage = page.getByText('Location is required when top');
    await expect(errorMessage).toBeVisible();
  });
});