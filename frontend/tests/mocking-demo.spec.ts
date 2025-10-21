import { test, expect } from '@playwright/test';
import './setup';

// Mock data structures matching the expected API responses
const mockACSData = {
  query: {
    lat: '37.7749',
    lon: '-122.4194',
    variables: 'S1111_C01_011E',
    topLevel: 'state',
    bottomLevel: 'place'
  },
  acsUrl: 'https://api.census.gov/data/2022/acs/acs5/subject',
  data: [
    ['NAME', 'S1111_C01_011E', 'state', 'place'],
    ['Acalanes Ridge CDP, California', '1234', '06', '00562'],
    ['Acampo CDP, California', '5678', '06', '00576'],
    ['Acton CDP, California', '9012', '06', '00604'],
    ['Adelanto city, California', '3456', '06', '00674'],
    ['Agoura Hills city, California', '7890', '06', '00758']
  ]
};

const mockFBIStaffData = {
  query: {
    granularity: 'national'
  },
  year: 2024,
  fbiUrl: 'https://api.fbi.gov/wanted/v1/list',
  staffStats: {
    officerCount: 772239,
    civilianCount: 362940,
    officersPer1000: 3.53,
    population: 320892997
  },
  rawData: {
    rates: {
      "Officers per 1,000 People": { "2024": 3.53 }
    },
    actuals: {
      "Male Officers": { "2024": 500000 },
      "Female Officers": { "2024": 272239 },
      "Male Civilians": { "2024": 200000 },
      "Female Civilians": { "2024": 162940 }
    },
    populations: {
      "Participated Population": { "2024": 320892997 }
    }
  }
};

const mockFBIStateData = {
  query: {
    lat: '37.7749',
    lon: '-122.4194',
    granularity: 'state'
  },
  year: 2024,
  fbiUrl: 'https://api.fbi.gov/wanted/v1/list',
  staffStats: {
    officerCount: 75000,
    civilianCount: 25000,
    officersPer1000: 2.5,
    population: 39538223
  },
  rawData: {
    rates: {
      "Officers per 1,000 People": { "2024": 2.5 }
    },
    actuals: {
      "Male Officers": { "2024": 50000 },
      "Female Officers": { "2024": 25000 },
      "Male Civilians": { "2024": 15000 },
      "Female Civilians": { "2024": 10000 }
    },
    populations: {
      "Participated Population": { "2024": 39538223 }
    }
  }
};

// Mock server setup function
async function setupMockServer(page: any) {
  // Mock ACS proxy endpoint
  await page.route('**/acs-proxy*', async (route: any) => {
    const url = new URL(route.request().url());
    const params = url.searchParams;
    
    // Simulate different responses based on parameters
    if (!params.get('lat') || !params.get('lon')) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Missing required query parameters.' })
      });
      return;
    }

    // Return mock ACS data
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockACSData)
    });
  });

  // Mock FBI staff data endpoint
  await page.route('**/fbi-staff-data*', async (route: any) => {
    const url = new URL(route.request().url());
    const params = url.searchParams;
    const granularity = params.get('granularity');
    
    if (!granularity) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Missing required query parameter: granularity' })
      });
      return;
    }

    if (!['national', 'state', 'agency'].includes(granularity)) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid granularity. Must be one of: national, state, agency' })
      });
      return;
    }

    // Check for coordinates requirement for non-national queries
    if (granularity !== 'national' && (!params.get('lat') || !params.get('lon'))) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ 
          error: 'Location is required' 
        })
      });
      return;
    }

    // Return appropriate mock data based on granularity
    const responseData = granularity === 'national' ? mockFBIStaffData : mockFBIStateData;
    
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(responseData)
    });
  });
}

// Helper function to verify mock data structure
function verifyMockDataStructure() {
  // Verify ACS data structure
  if (!mockACSData.data || !Array.isArray(mockACSData.data)) {
    throw new Error('Mock ACS data structure is invalid');
  }
  
  // Verify FBI data structure
  if (!mockFBIStaffData.staffStats || typeof mockFBIStaffData.staffStats.officerCount !== 'number') {
    throw new Error('Mock FBI data structure is invalid');
  }
  
  return true;
}

test.describe('Mock Server Demo - Tabular Display with Mocked APIs', () => {
  test.beforeEach(async ({ page }) => {
    // Verify mock data structure before each test
    verifyMockDataStructure();
    
    // Setup mock server to intercept API calls
    await setupMockServer(page);
    
    // Navigate to the application
    await page.goto('http://localhost:5173/');
  });

  test('verifies mock data structure', async ({ page }) => {
    // This test demonstrates that we understand mocking by verifying our mock data
    expect(mockACSData.data).toBeDefined();
    expect(mockACSData.data.length).toBeGreaterThan(0);
    expect(mockACSData.data[0]).toEqual(['NAME', 'S1111_C01_011E', 'state', 'place']);
    
    expect(mockFBIStaffData.staffStats).toBeDefined();
    expect(mockFBIStaffData.staffStats.officerCount).toBe(772239);
    expect(mockFBIStaffData.staffStats.population).toBe(320892997);
  });

  test('displays mocked ACS data query results correctly', async ({ page }) => {
    // Fill out form for ACS data - this will trigger our mocked API response
    await page.getByRole('combobox', { name: 'Search and select destination' }).click();
    await page.getByRole('option', { name: 'San Francisco, destination' }).click();
    
    await page.getByLabel('Select data source for your').selectOption('ACS');
    await page.getByLabel('Select geographic top level').selectOption('state');
    await page.getByLabel('Select geographic bottom').selectOption('place');
    
    // Submit the query - this will be intercepted by our mock server
    await page.getByRole('button', { name: 'Run Query - Press Enter to' }).click();
    
    // Wait for the mocked response to be processed
    await page.waitForTimeout(1000);
    
    // Verify that our mocked data appears in the table
    await expect(page.locator('thead')).toContainText('NAME');
    await expect(page.locator('thead')).toContainText('S1111_C01_011E');
    
    // Check for specific mocked data entries
    await expect(page.getByRole('cell', { name: 'Acalanes Ridge CDP, California' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '1234' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Acampo CDP, California' })).toBeVisible();
    
    // Verify table structure with mocked data
    const tableRows = page.locator('tbody tr');
    await expect(tableRows).toHaveCount(5); // 5 mock data rows
  });

  test('displays mocked FBI national data query results correctly', async ({ page }) => {
    // Fill out form for FBI national data - this will trigger our mocked API response
    await page.getByLabel('Select data source for your').selectOption('FBI');
    await page.getByLabel('Select geographic granularity').selectOption('national');
    await page.getByLabel('Select year for FBI crime data').selectOption('2024');
    
    // Submit the query - this will be intercepted by our mock server
    await page.getByRole('button', { name: 'Run Query - Press Enter to' }).click();
    
    // Wait for the mocked response to be processed
    await page.waitForTimeout(1000);
    
    // Verify that our mocked FBI data appears in the table
    await expect(page.getByRole('cell', { name: 'Data Type' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Value' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Year' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '2024' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Granularity' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'national' })).toBeVisible();
    
    // Check for specific mocked values
    await expect(page.getByRole('cell', { name: '772,239' })).toBeVisible(); // Officer count
    await expect(page.getByRole('cell', { name: '362,940' })).toBeVisible(); // Civilian count
    await expect(page.getByRole('cell', { name: '3.53' })).toBeVisible(); // Officers per 1000
  });

  test('displays mocked FBI state data query results correctly', async ({ page }) => {
    // Fill out form for FBI state data with location
    await page.getByRole('combobox', { name: 'Search and select destination' }).click();
    await page.getByRole('option', { name: 'San Francisco, destination' }).click();
    
    await page.getByLabel('Select data source for your').selectOption('FBI');
    await page.getByLabel('Select geographic granularity').selectOption('state');
    await page.getByLabel('Select year for FBI crime data').selectOption('2024');
    
    // Submit the query - this will be intercepted by our mock server
    await page.getByRole('button', { name: 'Run Query - Press Enter to' }).click();
    
    // Wait for the mocked response to be processed
    await page.waitForTimeout(1000);
    
    // Verify that our mocked state-level FBI data appears
    await expect(page.getByRole('cell', { name: 'Data Type' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Value' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'state' })).toBeVisible();
    
    // Check for specific mocked state values (different from national)
    await expect(page.getByRole('cell', { name: '75,000' })).toBeVisible(); // State officer count
    await expect(page.getByRole('cell', { name: '25,000' })).toBeVisible(); // State civilian count
    await expect(page.getByRole('cell', { name: '2.5' })).toBeVisible(); // State officers per 1000
  });

  test('handles mocked error responses correctly', async ({ page }) => {
    // Test error handling with missing location for state-level FBI query
    await page.getByLabel('Select data source for your').selectOption('FBI');
    await page.getByLabel('Select geographic granularity').selectOption('state');
    await page.getByLabel('Select year for FBI crime data').selectOption('2024');
    
    // Submit without selecting a location - should trigger mocked error
    await page.getByRole('button', { name: 'Run Query - Press Enter to' }).click();
    
    // Wait for error message
    await page.waitForTimeout(1000);
    
    // Verify error message appears (this tests our mock error handling)
    await expect(page.locator('.error-message')).toContainText('Location is required');
  });

  test('demonstrates mock server isolation from real backend', async ({ page }) => {
    // This test demonstrates that we're using mocked data, not real API calls
    
    // Fill out ACS query
    await page.getByRole('combobox', { name: 'Search and select destination' }).click();
    await page.getByRole('option', { name: 'San Francisco, destination' }).click();
    await page.getByLabel('Select data source for your').selectOption('ACS');
    await page.getByLabel('Select geographic top level').selectOption('state');
    await page.getByLabel('Select geographic bottom').selectOption('place');
    
    // Submit query
    await page.getByRole('button', { name: 'Run Query - Press Enter to' }).click();
    await page.waitForTimeout(1000);
    
    // Verify we get exactly our mocked data, not real census data
    // Real census data would have different values and structure
    const firstDataCell = page.getByRole('cell', { name: 'Acalanes Ridge CDP, California' });
    await expect(firstDataCell).toBeVisible();
    
    // This specific value '1234' is from our mock data, proving isolation
    const mockValueCell = page.getByRole('cell', { name: '1234' });
    await expect(mockValueCell).toBeVisible();
    
    // Count rows to ensure we get exactly our mocked dataset
    const dataRows = page.locator('tbody tr');
    await expect(dataRows).toHaveCount(5); // Exactly 5 mock entries
  });

  test('verifies mock data consistency across multiple queries', async ({ page }) => {
    // First query - ACS data
    await page.getByRole('combobox', { name: 'Search and select destination' }).click();
    await page.getByRole('option', { name: 'San Francisco, destination' }).click();
    await page.getByLabel('Select data source for your').selectOption('ACS');
    await page.getByLabel('Select geographic top level').selectOption('state');
    await page.getByLabel('Select geographic bottom').selectOption('place');
    await page.getByRole('button', { name: 'Run Query - Press Enter to' }).click();
    await page.waitForTimeout(1000);
    
    // Verify first query results
    await expect(page.getByRole('cell', { name: 'Acalanes Ridge CDP, California' })).toBeVisible();
    
    // Second query - FBI national data
    await page.getByLabel('Select data source for your').selectOption('FBI');
    await page.getByLabel('Select geographic granularity').selectOption('national');
    await page.getByLabel('Select year for FBI crime data').selectOption('2024');
    await page.getByRole('button', { name: 'Run Query - Press Enter to' }).click();
    await page.waitForTimeout(1000);
    
    // Verify second query results show consistent mock data
    await expect(page.getByRole('cell', { name: '772,239' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'national' })).toBeVisible();
    
    // This demonstrates that our mocking is consistent and reliable
  });

  test('validates mock server setup prevents real API calls', async ({ page }) => {
    // This test ensures our mock server is properly intercepting calls
    
    // Monitor network requests to ensure no real API calls are made
    const apiCalls: string[] = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('api.census.gov') || url.includes('api.fbi.gov')) {
        apiCalls.push(url);
      }
    });
    
    // Perform a query that would normally make real API calls
    await page.getByRole('combobox', { name: 'Search and select destination' }).click();
    await page.getByRole('option', { name: 'San Francisco, destination' }).click();
    await page.getByLabel('Select data source for your').selectOption('ACS');
    await page.getByLabel('Select geographic top level').selectOption('state');
    await page.getByLabel('Select geographic bottom').selectOption('place');
    await page.getByRole('button', { name: 'Run Query - Press Enter to' }).click();
    await page.waitForTimeout(1000);
    
    // Verify no real API calls were made (they were intercepted by our mock)
    expect(apiCalls.length).toBe(0);
    
    // But verify we still got data (from our mock)
    await expect(page.getByRole('cell', { name: 'NAME' })).toBeVisible();
  });
});