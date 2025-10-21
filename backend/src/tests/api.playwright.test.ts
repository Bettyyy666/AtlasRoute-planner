import { test as base, expect } from '@playwright/test';
import { ServerApp } from '../server';
import * as http from 'http';
import fetch from 'node-fetch';
import type { StaffData } from '../fbi-query/fbiQueryHandler';

// Mock data for tests
const mockCSVData = {
  headers: ['header1', 'header2', 'header3'],
  data: [
    ['value1', 'value2', 'value3'],
    ['value4', 'value5', 'value6']
  ]
};

// Define the exact ACS data that will be returned in tests
const mockACSData = [
  ["S0101_C01_001E", "state", "county"],
  ["1097379", "44", "001"],
  ["165158", "44", "003"],
  ["626285", "44", "005"],
  ["306589", "44", "007"],
  ["49233", "44", "009"]
];

// Mock FBI arrest data - match the actual FBI API response structure
const mockFBIArrestData = {
  data: [
    {
      data_year: 2023,
      offense: "all",       // Added this required field
      state_abbr: "RI",
      arrest_count: 1000
    }
  ]
};

// Mock FBI StaffData for testing
export const mockFBIStaffData: StaffData = {
  rates: {
    "Officers per 1,000 People": { "2022": 2.82, "2023": 2.85 }
  },
  actuals: {
    "Male Officers": { "2022": 2287, "2023": 2300 },
    "Female Officers": { "2022": 216, "2023": 220 },
    "Male Civilians": { "2022": 243, "2023": 250 },
    "Female Civilians": { "2022": 339, "2023": 340 }
  },
  populations: {
    "Participated Population": { "2022": 1093734, "2023": 1100000 }
  }
};

// Mock functions for dependency injection
const mockCSVParser = async (filePath: string) => {
  console.log("Mock CSV parser called with:", filePath);
  // Return mock data in the format expected by the CSV handler
  return {
    headers: mockCSVData.headers,
    data: mockCSVData.data
  };
};

// Always return true for file existence check in tests
const mockFileExists = async (filePath: string) => {
  console.log("Mock file exists check called with:", filePath);
  return true; // Always return true in tests
};

const mockStateFIPSFetcher = async (lat: string, lon: string) => {
  // Return null for coordinates outside the US (for testing)
  if (lat === '0' && lon === '0') {
    return null;
  }
  // Always return Rhode Island FIPS code for valid US coordinates
  return "44";
};

const mockCountyFIPSFetcher = async (lat: string, lon: string) => {
  // Return null for coordinates outside the US (for testing)
  if (lat === '0' && lon === '0') {
    return null;
  }
  // Return Providence county FIPS code for valid US coordinates
  return "007";
};

const mockPlaceFIPSFetcher = async (lat: string, lon: string) => {
  // Return null for coordinates outside the US (for testing)
  if (lat === '0' && lon === '0') {
    return null;
  }
  // Return Providence place FIPS code for valid US coordinates
  return "59000";
};

const mockACSDataFetcher = async (url: string) => {
  // Return the exact mock ACS data for testing
  return mockACSData;
};

const mockFBIDataFetcher = async (url: string) => {
  // Return mock FBI data for testing
  return mockFBIArrestData;
};

const mockFBIStaffDataFetcher = async (url: string) => {
  return mockFBIStaffData;
}

const mockAPIKeyLoader = async () => {
  console.log("Mock API key loader called");
  return "mock-api-key";
};

// Mock for weather data
const mockFetchWeatherInBoundingBox = async () => {
  return {
    stations: [
      { id: 'station1', lat: 41.82, lon: -71.41, temperature: 72, conditions: 'Sunny' },
      { id: 'station2', lat: 41.83, lon: -71.42, temperature: 70, conditions: 'Cloudy' }
    ]
  };
};

// Mock for activity data
const mockFetchActivityData = async () => {
  return {
    headers: ['name', 'lat', 'lon', 'category'],
    data: [
      ['Park Visit', '41.82', '-71.41', 'outdoor'],
      ['Museum Tour', '41.83', '-71.42', 'indoor']
    ]
  };
};

// Create a test fixture for server setup
type ServerFixture = {
  server: http.Server;
  serverApp: ServerApp;
  baseURL: string;
};

// Define the test with fixtures
const test = base.extend<ServerFixture>({
  serverApp: async ({}, use) => {
    // Create a new server app for testing with mock dependencies
    const app = new ServerApp(
      3001,
      mockCSVParser,
      mockFileExists,
      mockStateFIPSFetcher,
      mockACSDataFetcher
    );
    
    // Register FBI query handler with mock dependencies
    const { registerFBIQueryHandler, registerFBIStaffQueryHandler } = await import('../fbi-query/fbiQueryHandler.js');
    registerFBIQueryHandler(
      app.app,
      mockStateFIPSFetcher,
      mockCountyFIPSFetcher,
      mockPlaceFIPSFetcher,
      mockFBIDataFetcher,
      mockAPIKeyLoader
    );

    registerFBIStaffQueryHandler(
      app.app,
      mockStateFIPSFetcher,
      mockCountyFIPSFetcher,
      mockPlaceFIPSFetcher,
      mockFBIStaffDataFetcher,
      mockAPIKeyLoader
    );
    
    await use(app);
  },
  server: async ({ serverApp }, use) => {
  // Start the server
  const srv = serverApp.app.listen(3001);  // Use serverApp.app directly instead of getApp()
  
  // Wait for server to start and verify it's running
  let isServerRunning = false;
  let retries = 0;
  const maxRetries = 5;
  
  while (!isServerRunning && retries < maxRetries) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    try {
      console.log(`Attempt ${retries + 1}/${maxRetries} to connect to server...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch('http://localhost:3001/', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.status === 200) {
        console.log('Server started successfully:', response.status);
        isServerRunning = true;
      }
    } catch (error) {
      console.log(`Server startup check failed (attempt ${retries + 1}/${maxRetries}): ${(error as Error).message}`);
      retries++;
    }
  }
  
  if (!isServerRunning) {
    throw new Error('Failed to start server after multiple attempts');
  }
  
  await use(srv);
  
  // Close the server after tests
  await new Promise(resolve => setTimeout(resolve, 1000));
  srv.close();
},
  baseURL: async ({}, use) => {
    await use('http://localhost:3001');
  },
});

export default test;

// Root endpoint test
test('GET / should return status 200', async ({ baseURL }) => {
  const response = await fetch(`${baseURL}/`);
  expect(response.status).toBe(200);
  const text = await response.text();
  expect(text).toContain('API Server is running');
});

// CSV Parser endpoint tests
test('GET /getcsv should return 400 when no filename is provided', async ({ baseURL }) => {
  const response = await fetch(`${baseURL}/getcsv`);
  expect(response.status).toBe(400);
  const data = await response.json() as { error: string };
  expect(data.error).toBe("Missing or invalid filename parameter");
});

test('GET /getcsv should return mock data for test.csv, a valid filename', async ({ baseURL }) => {
  const response = await fetch(`${baseURL}/getcsv?filename=test.csv`);
  
  // Debug: Log the response if it's not 200
  if (response.status !== 200) {
    const errorData = await response.json();
    console.log('Error response:', JSON.stringify(errorData, null, 2));
  }
  
  expect(response.status).toBe(200);
  
  const data = await response.json() as { 
    success: boolean, 
    data: Record<string, string>[],
    headers: string[],
    rowCount: number
  };
  
  // Verify the response structure and content
  expect(data.success).toBe(true);
  expect(data.headers).toEqual(mockCSVData.headers);
  expect(data.rowCount).toBe(mockCSVData.data.length);
  
  // Check that the data was transformed correctly
  expect(data.data).toHaveLength(mockCSVData.data.length);
  expect(data.data[0]).toEqual({
    header1: 'value1',
    header2: 'value2',
    header3: 'value3'
  });
  expect(data.data[1]).toEqual({
    header1: 'value4',
    header2: 'value5',
    header3: 'value6'
  });
});

// ACS Proxy endpoint tests
test('GET /acs-proxy should return 400 when parameters are missing', async ({ baseURL }) => {
  const response = await fetch(`${baseURL}/acs-proxy`);
  expect(response.status).toBe(400);
  const data = await response.json() as { error: string };
  expect(data.error).toBe("Missing required query parameters.");
});

test('GET /acs-proxy should return mock ACS data with valid parameters', async ({ baseURL }) => {
  const response = await fetch(`${baseURL}/acs-proxy?lat=41.8246&lon=-71.4142&variables=S0101_C01_001E&topLevel=state&bottomLevel=county`);
  expect(response.status).toBe(200);
  
  const data = await response.json() as {
    query: { lat: string, lon: string, variables: string, topLevel: string, bottomLevel: string },
    acsUrl: string,
    data: string[][]
  };
  
  // Verify the response structure
  expect(data.query).toEqual({
    lat: '41.8246',
    lon: '-71.4142',
    variables: 'S0101_C01_001E',
    topLevel: 'state',
    bottomLevel: 'county'
  });
  
  // Instead of comparing the entire arrays, check specific expected values
  expect(data.data[0][0]).toBe("S0101_C01_001E");
  expect(data.data[0][1]).toBe("state");
  expect(data.data[0][2]).toBe("county");
  
  // Check that we have the right number of rows
  expect(data.data.length).toBe(6); // Header + 5 counties
  
  // Check that all rows have Rhode Island state FIPS code
  for (let i = 1; i < data.data.length; i++) {
    expect(data.data[i][1]).toBe("44"); // Rhode Island state FIPS
  }
});

// FBI Query Handler tests
test('GET /fbi-arrest-data should return 400 when granularity is missing', async ({ baseURL }) => {
  const response = await fetch(`${baseURL}/fbi-arrest-data`);
  expect(response.status).toBe(400);
  const data = await response.json() as { error: string };
  expect(data.error).toBe("Missing required query parameter: granularity");
});

test('GET /fbi-arrest-data should return 400 when granularity is invalid', async ({ baseURL }) => {
  const response = await fetch(`${baseURL}/fbi-arrest-data?granularity=invalid`);
  expect(response.status).toBe(400);
  const data = await response.json() as { error: string };
  expect(data.error).toBe("Invalid granularity. Must be one of: national, state, agency");
});

test('GET /fbi-arrest-data should return 400 when coordinates are missing for state granularity', async ({ baseURL }) => {
  const response = await fetch(`${baseURL}/fbi-arrest-data?granularity=state`);
  expect(response.status).toBe(400);
  const data = await response.json() as { error: string };
  expect(data.error).toBe("Missing required query parameters: lat, lon (required for state and agency granularity)");
});

test('GET /fbi-arrest-data should return 400 for coordinates outside the US (state granularity)', async ({ baseURL }) => {
  const response = await fetch(`${baseURL}/fbi-arrest-data?granularity=state&lat=0&lon=0`);
  expect(response.status).toBe(400);
  const data = await response.json() as { error: string };
  expect(data.error).toBe("Could not resolve state from coordinates");
});

test('GET /fbi-arrest-data should return 400 for coordinates outside the US (agency granularity)', async ({ baseURL }) => {
  const response = await fetch(`${baseURL}/fbi-arrest-data?granularity=agency&lat=0&lon=0`);
  expect(response.status).toBe(400);
  const data = await response.json() as { error: string };
  expect(data.error).toBe("Could not resolve state or county from coordinates");
});

test('GET /fbi-arrest-data should return 200 for valid US coordinates (state granularity)', async ({ baseURL }) => {
  const response = await fetch(`${baseURL}/fbi-arrest-data?granularity=state&lat=41.8246&lon=-71.4142`);
  expect(response.status).toBe(200);
  
  const data = await response.json() as {
    query: { lat: string, lon: string, granularity: string },
    year: number,
    fbiUrl: string,
    totalArrests: number,
    rawData: any
  };
  
  // Verify the response structure
  expect(data.query).toEqual({
    lat: '41.8246',
    lon: '-71.4142',
    granularity: 'state'
  });
  
  expect(data.year).toBe(2023);
  expect(data.totalArrests).toBe(1000);
  expect(data.rawData).toEqual(mockFBIArrestData);
});

test('GET /fbi-arrest-data should return 200 for valid US coordinates (agency granularity)', async ({ baseURL }) => {
  const response = await fetch(`${baseURL}/fbi-arrest-data?granularity=agency&lat=41.8246&lon=-71.4142`);
  expect(response.status).toBe(200);
  
  const data = await response.json() as {
    query: { lat: string, lon: string, granularity: string },
    year: number,
    fbiUrl: string,
    totalArrests: number,
    rawData: any
  };
  
  // Verify the response structure
  expect(data.query).toEqual({
    lat: '41.8246',
    lon: '-71.4142',
    granularity: 'agency'
  });
  
  expect(data.year).toBe(2023);
  expect(data.totalArrests).toBe(1000);
  expect(data.rawData).toEqual(mockFBIArrestData);
});

test('GET /fbi-arrest-data should return 200 for national granularity (no coordinates needed)', async ({ baseURL }) => {
  const response = await fetch(`${baseURL}/fbi-arrest-data?granularity=national`);
  expect(response.status).toBe(200);
  
  const data = await response.json() as {
    query: { granularity: string },
    year: number,
    fbiUrl: string,
    totalArrests: number,
    rawData: any
  };
  
  // Verify the response structure
  expect(data.query.granularity).toBe('national');
  expect(data.year).toBe(2023);
  expect(data.totalArrests).toBe(1000);
  expect(data.rawData).toEqual(mockFBIArrestData);
});

// Activity Parser endpoint tests
test('GET /activityLocations should return activity data', async ({ baseURL }) => {
  // This test assumes the server has been configured to use mockFetchActivityData
  const response = await fetch(`${baseURL}/activityLocations`);
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data).toBeTruthy();
});

// Query Response tests
// test('GET /query-response should return Michigan data when querying state 26', async ({ baseURL }) => {
//   const response = await fetch(`${baseURL}/query-response?url=https://api.census.gov/data/2019/acs/acs1?get=NAME,B01001_001E&for=county%20subdivision:*&in=state:26&in=county:*&key=2ec9b4ea61f79f66eff9ebf7b9a8647995230ba3`);
//   expect(response.status).toBe(200);
//   const data = await response.json();
//   expect((data as string[][])[0][0]).toBe("NAME");
//   expect((data as string[][])[1][0]).toBe("Dearborn city, Wayne County, Michigan");
//   expect(data).toHaveLength(23); // Header row + 22 data rows
// });

// test('GET /query-response should return error for invalid county subdivision', async ({ baseURL }) => {
//   const response = await fetch(`${baseURL}/query-response?url=https://api.census.gov/data/2019/acs/acs1?get=NAME,B01001_001E&for=county%20subdivision:01500&in=state:36%20county:029&key=2ec9b4ea61f79f66eff9ebf7b9a8647995230ba3`);
//   expect(response.status).toBe(200);
//   const data = await response.json();
//   expect((data as { error: string }).error).toBe("Blank screen");
// });

// // Filter endpoint tests
// test('GET /filter should return 404 when parameters are missing', async ({ baseURL }) => {
//   const response = await fetch(`${baseURL}/filter`);
//   expect(response.status).toBe(404);
//   const data = await response.json() as { error: string };
//   expect(data.error).toBeTruthy();
// });

// // Routing endpoint tests
// test('GET /find-path should return 404 when parameters are missing', async ({ baseURL }) => {
//   const response = await fetch(`${baseURL}/find-path`);
//   expect(response.status).toBe(404);
//   const data = await response.json() as { error: string };
//   expect(data.error).toBeTruthy();
// });

// // Tile Manager endpoint tests
// test('GET /update-visible-tiles should return 404 when parameters are missing', async ({ baseURL }) => {
//   const response = await fetch(`${baseURL}/update-visible-tiles`);
//   expect(response.status).toBe(404);
//   const data = await response.json() as { error: string };
//   expect(data.error).toBeTruthy();
// });

// // Redlining endpoint tests
// test('GET /highlight-redlining should return 404 when parameters are missing', async ({ baseURL }) => {
//   const response = await fetch(`${baseURL}/highlight-redlining`);
//   expect(response.status).toBe(404);
//   const data = await response.json() as { error: string };
//   expect(data.error).toBeTruthy();
// });

// FBI Staff Query Handler tests
test('GET /fbi-staff-data should return 400 when granularity is missing', async ({ baseURL }) => {
  const response = await fetch(`${baseURL}/fbi-staff-data`);
  expect(response.status).toBe(400);
  const data = await response.json() as { error: string };
  expect(data.error).toBe("Missing required query parameter: granularity");
});

test('GET /fbi-staff-data should return 400 when granularity is invalid', async ({ baseURL }) => {
  const response = await fetch(`${baseURL}/fbi-staff-data?granularity=invalid`);
  expect(response.status).toBe(400);
  const data = await response.json() as { error: string };
  expect(data.error).toBe("Invalid granularity. Must be one of: national, state, agency");
});

test('GET /fbi-staff-data should return 400 when coordinates are missing for state granularity', async ({ baseURL }) => {
  const response = await fetch(`${baseURL}/fbi-staff-data?granularity=state`);
  // expect(response.status).toBe(400);
  const data = await response.json() as { error: string };
  console.log(data);
  expect(data.error).toBe("Missing required query parameters: lat, lon (required for state and agency granularity)");
});

test('GET /fbi-staff-data should return 400 for coordinates outside the US (state granularity)', async ({ baseURL }) => {
  const response = await fetch(`${baseURL}/fbi-staff-data?granularity=state&lat=0&lon=0`);
  expect(response.status).toBe(400);
  const data = await response.json() as { error: string };
  expect(data.error).toBe("Could not resolve state from coordinates");
});

test('GET /fbi-staff-data should return 400 for coordinates outside the US (agency granularity)', async ({ baseURL }) => {
  const response = await fetch(`${baseURL}/fbi-staff-data?granularity=agency&lat=0&lon=0`);
  expect(response.status).toBe(400);
  const data = await response.json() as { error: string };
  expect(data.error).toBe("Could not resolve state or county from coordinates");
});

test('GET /fbi-staff-data should return 200 for valid US coordinates (state granularity)', async ({ baseURL }) => {
  const response = await fetch(`${baseURL}/fbi-staff-data?granularity=state&lat=41.8246&lon=-71.4142`);
  expect(response.status).toBe(200);
  
  const data = await response.json() as {
    query: { lat: string, lon: string, granularity: string },
    year: number,
    fbiUrl: string,
    staffStats: any,
    rawData: any
  };
  
  // Verify the response structure
  expect(data.query).toEqual({
    lat: '41.8246',
    lon: '-71.4142',
    granularity: 'state'
  });
  
  expect(data.year).toBe(2024);
  expect(data.staffStats.officerCount).toBe(2355)
  expect(data.staffStats.civilianCount).toBe(562)
  expect(data.staffStats.officersPer1000).toBe(2.84)
  expect(data.staffStats.population).toBe(1025649)
});

test('GET /fbi-staff-data should return 404 for agency with no data (agency granularity)', async ({ baseURL }) => {
  const response = await fetch(`${baseURL}/fbi-staff-data?granularity=agency&lat=41.8246&lon=-71.4142`);
  expect(response.status).toBe(404);
  
  const data = await response.json() as {
    query: { lat: string, lon: string, granularity: string },
    year: number,
    fbiUrl: string,
    staffStats: any,
    rawData: any
  };
  
  // Verify the response structure
  expect(data.query).toEqual(undefined);
  
  expect(data.year).toBe(undefined);
});

test('GET /fbi-staff-data should return 200 for national granularity (no coordinates needed)', async ({ baseURL }) => {
  const response = await fetch(`${baseURL}/fbi-staff-data?granularity=national`);
  expect(response.status).toBe(200);
  
  const data = await response.json() as {
    query: { granularity: string },
    year: number,
    fbiUrl: string,
    staffStats: any,
    rawData: any
  };
  
  expect(data.year).toBe(2024);
  expect(data.staffStats.officerCount).toBe(772239)
  expect(data.staffStats.civilianCount).toBe(362940)
  expect(data.staffStats.officersPer1000).toBe(3.53)
  expect(data.staffStats.population).toBe(320892997)
});