import { test, expect } from '@playwright/test';
import { Express } from 'express';
import express from 'express';
import { 
  registerTransitQueryHandler, 
  mockTransitDataFetcher, 
  mockTransitAPIKeyLoader,
  mockTransitData 
} from './transitQueryHandler';


// GET /transit-routes?stop_id=MBTA_70001
// GET /transit-stops?lat=41.8236&lon=-71.4222&radius=5&route_type=bus&wheelchair_accessible=true

// Mock server fixture for testing
class MockTransitServerFixture {
  private app: Express;
  private server: any;
  private port: number;

  constructor(port: number = 3003) {
    this.port = port;
    this.app = express();
    this.app.use(express.json());
    
    // Register the transit handler with mock functions
    registerTransitQueryHandler(
      this.app,
      mockTransitDataFetcher,
      mockTransitAPIKeyLoader
    );
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`Mock transit server running on port ${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log(`Mock transit server on port ${this.port} stopped`);
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getBaseUrl(): string {
    return `http://localhost:${this.port}`;
  }
}

test.describe('Transit Query Handler', () => {
  let mockServer: MockTransitServerFixture;

  test.beforeAll(async () => {
    mockServer = new MockTransitServerFixture(3003);
    await mockServer.start();
  });

  test.afterAll(async () => {
    await mockServer.stop();
  });

  test('GET /transit-stops should return transit stops for valid coordinates', async ({ request }) => {
    const response = await request.get(`${mockServer.getBaseUrl()}/transit-stops?lat=41.8236&lon=-71.4222&radius=5`);
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    
    // Verify response structure
    expect(data).toHaveProperty('query');
    expect(data).toHaveProperty('transitUrl');
    expect(data).toHaveProperty('stops');
    expect(data).toHaveProperty('statistics');
    expect(data).toHaveProperty('rawData');
    
    // Verify query parameters
    expect(data.query.lat).toBe(41.8236);
    expect(data.query.lon).toBe(-71.4222);
    expect(data.query.radius).toBe(5);
    
    // Verify stops data
    expect(Array.isArray(data.stops)).toBe(true);
    expect(data.stops.length).toBeGreaterThan(0);
    
    // Verify each stop has required fields
    data.stops.forEach((stop: any) => {
      expect(stop).toHaveProperty('stop_id');
      expect(stop).toHaveProperty('stop_name');
      expect(stop).toHaveProperty('stop_lat');
      expect(stop).toHaveProperty('stop_lon');
    });
    
    // Verify statistics
    expect(data.statistics).toHaveProperty('total_stops');
    expect(data.statistics).toHaveProperty('accessible_stops');
    expect(data.statistics).toHaveProperty('route_type_breakdown');
    expect(data.statistics).toHaveProperty('search_radius_km');
    expect(data.statistics.search_radius_km).toBe(5);
  });

  test('GET /transit-stops should filter by route type', async ({ request }) => {
    const response = await request.get(`${mockServer.getBaseUrl()}/transit-stops?lat=42.3522&lon=-71.0552&radius=10&route_type=subway`);
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.query.route_type).toBe('subway');
    
    // Verify that returned stops have the requested route type
    data.stops.forEach((stop: any) => {
      if (stop.route_types) {
        expect(stop.route_types).toContain('subway');
      }
    });
  });

  test('GET /transit-stops should filter by wheelchair accessibility', async ({ request }) => {
    const response = await request.get(`${mockServer.getBaseUrl()}/transit-stops?lat=41.8236&lon=-71.4222&radius=5&wheelchair_accessible=true`);
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.query.wheelchair_accessible).toBe(true);
    
    // Verify that all returned stops are wheelchair accessible
    data.stops.forEach((stop: any) => {
      expect(stop.wheelchair_boarding).toBe(1);
    });
  });

  test('GET /transit-stops should return 400 for missing coordinates', async ({ request }) => {
    const response = await request.get(`${mockServer.getBaseUrl()}/transit-stops?lat=41.8236`);
    
    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data.error).toContain('Missing required query parameters');
  });

  test('GET /transit-stops should return 400 for invalid coordinates', async ({ request }) => {
    const response = await request.get(`${mockServer.getBaseUrl()}/transit-stops?lat=invalid&lon=-71.4222`);
    
    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data.error).toContain('Invalid numeric values');
  });

  test('GET /transit-stops should return 400 for out-of-range coordinates', async ({ request }) => {
    const response = await request.get(`${mockServer.getBaseUrl()}/transit-stops?lat=91&lon=-71.4222`);
    
    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data.error).toContain('Invalid coordinate values');
  });

  test('GET /transit-stops should return 400 for invalid radius', async ({ request }) => {
    const response = await request.get(`${mockServer.getBaseUrl()}/transit-stops?lat=41.8236&lon=-71.4222&radius=100`);
    
    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data.error).toContain('Search radius must be between 0 and 50 kilometers');
  });

  test('GET /transit-routes should return route information for valid stop_id', async ({ request }) => {
    const response = await request.get(`${mockServer.getBaseUrl()}/transit-routes?stop_id=MBTA_70001`);
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    
    // Verify response structure
    expect(data).toHaveProperty('query');
    expect(data).toHaveProperty('routeUrl');
    expect(data).toHaveProperty('routes');
    expect(data).toHaveProperty('rawData');
    
    // Verify query parameters
    expect(data.query.stop_id).toBe('MBTA_70001');
    
    // Verify routes data
    expect(Array.isArray(data.routes)).toBe(true);
    expect(data.routes.length).toBeGreaterThan(0);
    
    // Verify each route has required fields
    data.routes.forEach((route: any) => {
      expect(route).toHaveProperty('route_id');
      expect(route).toHaveProperty('route_short_name');
      expect(route).toHaveProperty('route_long_name');
      expect(route).toHaveProperty('route_type');
      expect(route).toHaveProperty('agency_name');
    });
  });

  test('GET /transit-routes should return 400 for missing stop_id', async ({ request }) => {
    const response = await request.get(`${mockServer.getBaseUrl()}/transit-routes`);
    
    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data.error).toContain('Missing required query parameter: stop_id');
  });

  test('Mock data should contain expected transit stops', () => {
    expect(mockTransitData.stops).toHaveLength(3);
    expect(mockTransitData.stops[0].stop_name).toBe('South Station');
    expect(mockTransitData.stops[1].stop_name).toBe('Kennedy Plaza');
    expect(mockTransitData.stops[2].stop_name).toBe('Federal Building');
    
    // Verify all stops have required coordinates
    mockTransitData.stops.forEach(stop => {
      expect(typeof stop.stop_lat).toBe('number');
      expect(typeof stop.stop_lon).toBe('number');
      expect(stop.stop_lat).toBeGreaterThan(-90);
      expect(stop.stop_lat).toBeLessThan(90);
      expect(stop.stop_lon).toBeGreaterThan(-180);
      expect(stop.stop_lon).toBeLessThan(180);
    });
  });
});