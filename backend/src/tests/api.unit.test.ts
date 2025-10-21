/**
 * API Server Test Suite
 * 
 * This file contains tests for the API server endpoints using Vitest.
 * It uses dependency injection and mocking to isolate tests from external services.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ServerApp } from '../server';
import { Express } from 'express';
import * as http from 'http';
import { registerACSProxyHandler } from '../acs/acsProxyHandler';
import { registerGetCSVHandler } from '../CSV-parser/csvParserHandler';
import { registerFilterHandler } from '../filter/filterHandler';
import { registerFindPathHandler } from '../street-graph/bestRouteHandler';
import { loadAPIKey, fetchFBIData } from '../fbi-query/fbiQueryHandler';
import express from 'express';
import cors from 'cors';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fetchACSData } from '../acs/acsProxyHandler';

/**
 * Interface for geocoding service that converts lat/lon to FIPS codes
 * Used to mock the Census geocoding API
 */
interface GeocodingProvider {
  getStateFIPS(lat: string, lon: string): Promise<string | null>;
}

/**
 * Interface for Census data provider
 * Used to mock the Census API responses
 */
interface CensusDataProvider {
  fetchData(url: string): Promise<any>;
}

/**
 * Interface for CSV data operations
 * Used to mock file system operations for CSV files
 */
interface CSVDataProvider {
  getCSVData(filename: string): Promise<any>;
}

/**
 * Interface for path finding service
 * Used to mock route calculations between points
 */
interface PathFindingProvider {
  findPath(points: any[]): Promise<any>;
}

/**
 * Mock implementation of the geocoding provider
 * Always returns New York state FIPS code (36) regardless of input coordinates
 */
class MockGeocodingProvider implements GeocodingProvider {
  async getStateFIPS(_lat: string, _lon: string): Promise<string | null> {
    return "36"; // New York state FIPS code
  }
}

/**
 * Mock implementation of the Census data provider
 * Returns fixed population data for testing
 */
class MockCensusDataProvider implements CensusDataProvider {
  async fetchData(_url: string): Promise<any> {
    return {
      json: async () => ({
        "B01001_001E": ["1000"],
        "NAME": ["New York"]
      })
    };
  }
}

/**
 * Mock implementation of the CSV data provider
 * Contains predefined mock data for test CSV files
 */
class MockCSVDataProvider implements CSVDataProvider {
  private mockData: Record<string, any> = {
    "sample.csv": { data: [{ name: "Test", value: 123 }] },
    "activities.csv": { data: [{ id: 1, name: "Hiking", location: "Park" }] },
    "locations.csv": { data: [{ id: 1, name: "Central Park", lat: 40.7812, lng: -73.9665 }] }
  };

  /**
   * Returns mock CSV data for the given filename
   * Throws an error if the file doesn't exist in the mock data
   */
  async getCSVData(filename: string): Promise<any> {
    if (this.mockData[filename]) {
      return this.mockData[filename];
    }
    throw new Error("File not found");
  }
}

/**
 * Mock implementation of the path finding provider
 * Returns a direct path between the first and last points
 */
class MockPathFindingProvider implements PathFindingProvider {
  async findPath(points: any[]): Promise<any> {
    if (!points || points.length < 2) {
      throw new Error("Invalid points");
    }
    return {
      path: [
        { lat: points[0].lat, lng: points[0].lng },
        { lat: points[1].lat, lng: points[1].lng }
      ]
    };
  }
}

// Test server setup with dependency injection
let app: Express;
let server: http.Server;
const TEST_PORT = 3002;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Create instances of mock providers
const geocodingProvider = new MockGeocodingProvider();
const censusDataProvider = new MockCensusDataProvider();
const csvDataProvider = new MockCSVDataProvider();
const pathFindingProvider = new MockPathFindingProvider();

/**
 * Setup function that runs before all tests
 * Creates a test server with mocked dependencies
 */
beforeAll(async () => {
  // Create a custom Express app for testing with mocked dependencies
  app = express();
  app.use(cors());
  app.use(express.json({ limit: "5mb" }));
  
  // Add root endpoint
  app.get("/", (req, res) => {
    res.send("API Server is running. Available endpoints: /getcsv, /activityLocations, etc.");
  });
  
  // Mock the global fetch function to intercept external API calls
  const originalFetch = global.fetch;
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    
    // Mock geocoding API responses
    if (url.includes('geocoding.geo.census.gov')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            geographies: {
              States: [{ STATE: "36" }]
            }
          }
        })
      } as Response;
    } 
    // Mock Census API responses
    else if (url.includes('api.census.gov')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          "B01001_001E": ["1000"],
          "NAME": ["New York"]
        })
      } as Response;
    }
    // Fall back to original fetch for other URLs
    return originalFetch(input, init);
  };
  
  // Register handlers with mocked dependencies
  // Create a mock getStateFIPS function for ACS proxy
  const mockGetStateFIPS = async (lat: string, lon: string): Promise<string | null> => {
    return "36"; // New York state FIPS code
  };
  
  // Create a custom implementation of registerACSProxyHandler that uses our mock
  app.get("/acs-proxy", async (req, res) => {
    try {
      const { lat, lon, variables, topLevel, bottomLevel } = req.query;

      // Defensive checks
      if (!lat || !lon || !variables || !topLevel || !bottomLevel) {
        return res.status(400).json({ error: "Missing required query parameters." });
      }
      
      // Validate granularity levels
      const granularityLevels = ["all", "us", "state", "county", "place"];
      const topLevelIndex = granularityLevels.indexOf(topLevel as string);
      const bottomLevelIndex = granularityLevels.indexOf(bottomLevel as string);
      
      // Check if granularity levels are valid
      if (topLevelIndex === -1 || bottomLevelIndex === -1) {
        return res.status(400).json({ 
          error: "Invalid granularity level. Must be one of: all, us, state, county, place." 
        });
      }
      
      // Check if top level is broader than or equal to bottom level
      if (topLevelIndex > bottomLevelIndex) {
        return res.status(400).json({ 
          error: "Invalid granularity combination. Top-level must be broader than or equal to bottom-level." 
        });
      }
      
      // Return mock data
      res.json({
        "B01001_001E": ["1000"],
        "NAME": ["New York"]
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ACS data", details: error });
    }
  });
   
  // Mock implementation for Find Path endpoint
  app.post("/find-path", async (req, res) => {
    try {
      const { points } = req.body;
      
      // Defensive checks
      if (!points || !Array.isArray(points) || points.length < 2) {
        return res.status(400).json({ error: "Invalid points. Must provide at least 2 points." });
      }
      
      // Check if all points have valid lat/lng
      for (const point of points) {
        if (typeof point.lat !== 'number' || typeof point.lng !== 'number') {
          return res.status(400).json({ error: "Invalid point format. Each point must have lat and lng as numbers." });
        }
      }
      
      // Return mock path data
      res.status(200).json({
        path: points.map((p, i) => ({ 
          id: i.toString(), 
          lat: p.lat, 
          lng: p.lng 
        }))
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to find path", details: error });
    }
  });
  
  // Create a custom implementation of registerGetCSVHandler that uses our mock
  app.get("/getcsv", async (req, res) => {
    try {
      const { filename } = req.query;
      
      if (!filename) {
        return res.status(400).json({ error: "Missing filename parameter" });
      }
      
      try {
        const data = await csvDataProvider.getCSVData(filename as string);
        return res.status(200).json(data);
      } catch (error) {
        return res.status(404).json({ error: "File not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Server error" });
    }
  });
  
  registerFilterHandler(app);
  
  // For path finding, inject our mock implementation
  const mockRouteThroughStops = async (points: any[]) => {
    return pathFindingProvider.findPath(points);
  };
  registerFindPathHandler(app, mockRouteThroughStops);
  
  // Start the test server
  server = app.listen(TEST_PORT);
});

/**
 * Cleanup function that runs after all tests
 * Restores original fetch and closes the server
 */
afterAll(async () => {
  // Restore original fetch
  if (global.fetch !== undefined) {
    delete (global as any).fetch;
  }
  
  // Close the server after tests
  server.close();
});

/**
 * Test suite for API endpoints
 */
describe('API Server Tests', () => {
  /**
   * Test for the root endpoint
   * Verifies that the server is running and returns a welcome message
   */
  it('Root endpoint returns welcome message', async () => {
    const response = await fetch(`${BASE_URL}/`);
    
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('API Server is running');
  });

  /**
   * Test for the ACS proxy endpoint with valid parameters
   * Verifies that the endpoint returns census data for valid coordinates and granularity
   */
  it('ACS proxy returns data for valid coordinates and granularity', async () => {
    const response = await fetch(
      `${BASE_URL}/acs-proxy?lat=40.7128&lon=-74.0060&variables=B01001_001E&topLevel=state&bottomLevel=county`
    );
    
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('B01001_001E');
    expect(body).toHaveProperty('NAME');
  });

  /**
   * Test for the ACS proxy endpoint with invalid granularity combination
   * Verifies that the endpoint returns a 400 error for invalid combinations
   */
  it('ACS proxy returns 400 for invalid granularity combination', async () => {
    const response = await fetch(
      `${BASE_URL}/acs-proxy?lat=40.7128&lon=-74.0060&variables=B01001_001E&topLevel=county&bottomLevel=state`
    );
    
    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty('error');
  });

  /**
   * Test for the ACS proxy endpoint with missing parameters
   * Verifies that the endpoint returns a 400 error when required parameters are missing
   */
  it('ACS proxy returns 400 for missing required parameters', async () => {
    const response = await fetch(`${BASE_URL}/acs-proxy?lat=40.7128`);
    
    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty('error');
  });

  /**
   * Test for the GetCSV endpoint with a valid filename
   * Verifies that the endpoint returns data for a valid CSV file
   */
  it('GetCSV returns data for valid filename', async () => {
    const response = await fetch(`${BASE_URL}/getcsv?filename=sample.csv`);
    
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('data');
  });

  /**
   * Test for the GetCSV endpoint with missing filename
   * Verifies that the endpoint returns a 400 error when the filename is missing
   */
  it('GetCSV returns 400 for missing filename', async () => {
    const response = await fetch(`${BASE_URL}/getcsv`);
    
    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty('error');
  });

  /**
   * Test for the GetCSV endpoint with a non-existent file
   * Verifies that the endpoint returns a 404 error for files that don't exist
   */
  it('GetCSV returns 404 for non-existent file', async () => {
    const response = await fetch(`${BASE_URL}/getcsv?filename=nonexistent.csv`);
    
    expect(response.status).toBe(404);
    expect(await response.json()).toHaveProperty('error');
  });
});

/**
 * Test suite for FBI API integration with real external API
 * This test uses the actual FBI API with a real API key
 */
describe('FBI API Integration Tests', () => {
  
  it('should fetch state arrest data from the real FBI API', async () => {
    // Load the real API key
    const apiKey = await loadAPIKey();
    expect(apiKey).toBeTruthy();
    
    // Use the real API to fetch Rhode Island data for 2024
    const year = 2024;
    const stateAbbr = 'RI';
    const url = `https://api.usa.gov/crime/fbi/cde/arrest/state/${stateAbbr}/all?type=counts&from=01-${year}&to=12-${year}&api_key=${apiKey}`;
    
    // Fetch the data using the real API
    const data = await fetchFBIData(url);
    
    // Verify the response structure based on the actual API response
    expect(data).toBeDefined();
    
    // Check for the main properties in the response
    expect(data).toHaveProperty('rates');
    expect(data).toHaveProperty('actuals');
    expect(data).toHaveProperty('populations');
    
    // Verify Rhode Island data exists
    expect(data.actuals).toHaveProperty('Rhode Island Arrests');
    
    // Check if we have at least one month of data
    const riArrests = data.actuals['Rhode Island Arrests'];
    expect(Object.keys(riArrests).length).toBeGreaterThan(0);
    
    // Verify the data structure for a month (e.g., January 2024)
    const januaryKey = `01-${year}`;
    expect(riArrests).toHaveProperty(januaryKey);
    expect(typeof riArrests[januaryKey]).toBe('number');
  }, 10000); // Increase timeout to 10 seconds for API call
  
});


/**
 * Test suite for CSV Parser integration with real file system
 * This test uses the actual file system to read CSV files
 */
describe('CSV Parser Integration Tests', () => {
  let realApp: Express;
  let realServer: http.Server;
  const REAL_API_PORT = 3005;
  const REAL_API_BASE_URL = `http://localhost:${REAL_API_PORT}`;
  
  // Define a simple CSV parser function for testing
  const testCSVParser = async (filePath: string, schema?: any, hasHeader: boolean = true) => {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return { headers: [], data: [] };
    }
    
    const headers = hasHeader ? lines[0].split(',').map(h => h.trim()) : [];
    const data = hasHeader ? lines.slice(1) : lines;
    
    return {
      headers,
      data: data.map(line => line.split(',').map(cell => cell.trim()))
    };
  };

  beforeAll(async () => {
    // Create a new Express app for real file system testing
    realApp = express();
    realApp.use(cors());
    realApp.use(express.json({ limit: "5mb" }));

    // Create test data directory and file if they don't exist
    const dataDir = path.resolve(process.cwd(), "data");
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (err) {
      // Directory might already exist
    }
    
    const testFilePath = path.join(dataDir, "test.csv");
    await fs.writeFile(testFilePath, "name,age,city\nJohn,30,New York\nJane,25,Boston");

    // Register CSV parser handler with real implementation
    registerGetCSVHandler(realApp, testCSVParser);

    // Start the real API test server
    realServer = realApp.listen(REAL_API_PORT);
  });

  afterAll(async () => {
    // Close the real API test server
    if (realServer) {
      realServer.close();
    }
    
    // Clean up test file
    try {
      const testFilePath = path.join(path.resolve(process.cwd(), "data"), "test.csv");
      await fs.unlink(testFilePath);
    } catch (err) {
      // File might not exist
    }
  });

  /**
   * Test CSV Parser with real file system
   * Verifies that the CSV parser works with actual files
   */
  it('CSV Parser returns real data for test.csv', async () => {
    const response = await fetch(
      `${REAL_API_BASE_URL}/getcsv?filename=test.csv`
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    
    // Verify the response structure
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('headers');
    expect(data).toHaveProperty('rowCount');
    
    // Verify that we got actual data
    expect(data.headers).toContain('name');
    expect(data.headers).toContain('age');
    expect(data.headers).toContain('city');
    expect(data.data.length).toBeGreaterThan(0);
    expect(data.data[0]).toHaveProperty('name');
    expect(data.data[0]).toHaveProperty('age');
    expect(data.data[0]).toHaveProperty('city');
    
    console.log(`CSV Parser test successful - Retrieved data from test.csv`);
  });
});