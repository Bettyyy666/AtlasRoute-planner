import { Express, Request, Response } from "express";
import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";

// Types for dependency injection
export type TransitDataFetcher = (url: string) => Promise<any>;
export type TransitAPIKeyLoader = () => Promise<string>;

// Interface for Transit Stop Data
interface TransitStop {
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
  location_type?: number;
  parent_station?: string;
  wheelchair_boarding?: number;
  agency_name?: string;
  route_types?: string[];
}

interface TransitResponse {
  stops: TransitStop[];
  total_count: number;
  search_radius_km: number;
}

// Mock transit data for development and testing
export const mockTransitData: TransitResponse = {
  stops: [
    {
      stop_id: "MBTA_70001",
      stop_name: "South Station",
      stop_lat: 42.352271,
      stop_lon: -71.055242,
      location_type: 1,
      wheelchair_boarding: 1,
      agency_name: "Massachusetts Bay Transportation Authority",
      route_types: ["subway", "commuter_rail", "bus"]
    },
    {
      stop_id: "RIPTA_6123",
      stop_name: "Kennedy Plaza",
      stop_lat: 41.82355,
      stop_lon: -71.41227,
      location_type: 0,
      wheelchair_boarding: 1,
      agency_name: "Rhode Island Public Transit Authority",
      route_types: ["bus"]
    },
    {
      stop_id: "RIPTA_6089",
      stop_name: "Federal Building",
      stop_lat: 41.82089,
      stop_lon: -71.41456,
      location_type: 0,
      wheelchair_boarding: 1,
      agency_name: "Rhode Island Public Transit Authority",
      route_types: ["bus"]
    }
  ],
  total_count: 3,
  search_radius_km: 5.0
};

// Default implementation to load transit API key (if needed)
export async function loadTransitAPIKey(): Promise<string> {
  try {
    const keyPath = path.resolve(process.cwd(), "transit-api-key.txt");
    const key = await fs.readFile(keyPath, "utf-8");
    return key.trim();
  } catch (error) {
    // For ICPSR data, we might not need an API key, so return empty string
    console.warn("Transit API key not found, proceeding without authentication");
    return "";
  }
}

// Default implementation to fetch transit data
export async function fetchTransitData(url: string): Promise<any> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Transit API request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// Mock transit API key loader for development and testing
export const mockTransitAPIKeyLoader: TransitAPIKeyLoader = async () => {
  console.log("Mock transit API key loader called");
  return "mock-transit-api-key";
};

// Mock transit data fetcher for development and testing
export const mockTransitDataFetcher: TransitDataFetcher = async (url: string) => {
  console.log("Mock transit data fetcher called with URL:", url);
  return mockTransitData;
};

// Helper function to calculate distance between two points (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Filter stops within radius and sort by distance
function filterAndSortStops(stops: TransitStop[], centerLat: number, centerLon: number, radiusKm: number): TransitStop[] {
  return stops
    .map(stop => ({
      ...stop,
      distance: calculateDistance(centerLat, centerLon, stop.stop_lat, stop.stop_lon)
    }))
    .filter(stop => stop.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance)
    .map(({ distance, ...stop }) => stop); // Remove distance from final result
}

export function registerTransitQueryHandler(
  app: Express,
  transitDataFetcher: TransitDataFetcher = fetchTransitData,
  transitAPIKeyLoader: TransitAPIKeyLoader = loadTransitAPIKey
) {
  app.get("/transit-stops", async (req: Request, res: Response) => {
    try {
      const { lat, lon, radius = "5", route_type, wheelchair_accessible } = req.query;
      
      // Validate required parameters
      if (!lat || !lon) {
        return res.status(400).json({ 
          error: "Missing required query parameters: lat, lon" 
        });
      }

      // Type narrowing and validation
      if (typeof lat !== 'string' || typeof lon !== 'string') {
        return res.status(400).json({
          error: "Latitude and longitude must be strings"
        });
      }

      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);
      const searchRadius = parseFloat(radius as string);

      if (isNaN(latitude) || isNaN(longitude) || isNaN(searchRadius)) {
        return res.status(400).json({
          error: "Invalid numeric values for lat, lon, or radius"
        });
      }

      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({
          error: "Invalid coordinate values. Latitude must be between -90 and 90, longitude between -180 and 180"
        });
      }

      if (searchRadius <= 0 || searchRadius > 50) {
        return res.status(400).json({
          error: "Search radius must be between 0 and 50 kilometers"
        });
      }

      // Load API key (if needed)
      let apiKey = "";
      try {
        apiKey = await transitAPIKeyLoader();
      } catch (error) {
        console.warn("Could not load transit API key, proceeding without authentication");
      }

      // Construct API URL for ICPSR National Transit Map data
      // Note: This is a placeholder URL - in reality, you'd need to access ICPSR's actual API
      let transitUrl = `https://api.icpsr.umich.edu/transit/stops?lat=${latitude}&lon=${longitude}&radius=${searchRadius}`;
      
      if (apiKey) {
        transitUrl += `&api_key=${apiKey}`;
      }
      
      if (route_type && typeof route_type === 'string') {
        transitUrl += `&route_type=${encodeURIComponent(route_type)}`;
      }
      
      if (wheelchair_accessible === 'true') {
        transitUrl += `&wheelchair_accessible=1`;
      }

      console.log(`Fetching transit data from: ${transitUrl}`);
      
      // Fetch transit data
      let transitData;
      try {
        transitData = await transitDataFetcher(transitUrl);
      } catch (error) {
        console.error("Failed to fetch transit data:", error);
        return res.status(503).json({
          error: "Transit data service unavailable",
          details: error instanceof Error ? error.message : String(error)
        });
      }

      // Process and filter the data
      let filteredStops = transitData.stops || [];
      
      // Apply additional filtering if needed
      if (route_type && typeof route_type === 'string') {
        filteredStops = filteredStops.filter((stop: TransitStop) => 
          stop.route_types && stop.route_types.includes(route_type)
        );
      }
      
      if (wheelchair_accessible === 'true') {
        filteredStops = filteredStops.filter((stop: TransitStop) => 
          stop.wheelchair_boarding === 1
        );
      }

      // Sort by distance from query point
      filteredStops = filterAndSortStops(filteredStops, latitude, longitude, searchRadius);

      // Calculate some statistics
      const routeTypeStats = filteredStops.reduce((stats: { [key: string]: number }, stop: TransitStop) => {
        if (stop.route_types) {
          stop.route_types.forEach(type => {
            stats[type] = (stats[type] || 0) + 1;
          });
        }
        return stats;
      }, {});

      const accessibleStops = filteredStops.filter((stop: TransitStop) => stop.wheelchair_boarding === 1).length;

      res.json({
        query: { 
          lat: latitude, 
          lon: longitude, 
          radius: searchRadius,
          route_type: route_type || null,
          wheelchair_accessible: wheelchair_accessible === 'true'
        },
        transitUrl,
        stops: filteredStops,
        statistics: {
          total_stops: filteredStops.length,
          accessible_stops: accessibleStops,
          route_type_breakdown: routeTypeStats,
          search_radius_km: searchRadius
        },
        rawData: transitData
      });

    } catch (error) {
      console.error("Transit handler error:", error);
      res.status(500).json({ 
        error: "Failed to fetch transit stop data", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Additional endpoint for transit route information
  app.get("/transit-routes", async (req: Request, res: Response) => {
    try {
      const { stop_id } = req.query;
      
      if (!stop_id || typeof stop_id !== 'string') {
        return res.status(400).json({ 
          error: "Missing required query parameter: stop_id" 
        });
      }

      // Load API key (if needed)
      let apiKey = "";
      try {
        apiKey = await transitAPIKeyLoader();
      } catch (error) {
        console.warn("Could not load transit API key, proceeding without authentication");
      }

      // Construct API URL for route information
      let routeUrl = `https://api.icpsr.umich.edu/transit/routes?stop_id=${encodeURIComponent(stop_id)}`;
      
      if (apiKey) {
        routeUrl += `&api_key=${apiKey}`;
      }

      console.log(`Fetching route data from: ${routeUrl}`);
      
      // For mock data, return sample route information
      const mockRouteData = {
        stop_id: stop_id,
        routes: [
          {
            route_id: "1",
            route_short_name: "1",
            route_long_name: "Harvard Square - Dudley Station",
            route_type: "bus",
            agency_name: "Massachusetts Bay Transportation Authority"
          }
        ]
      };

      const routeData = await transitDataFetcher(routeUrl);

      res.json({
        query: { stop_id },
        routeUrl,
        routes: routeData.routes || mockRouteData.routes,
        rawData: routeData
      });

    } catch (error) {
      console.error("Transit route handler error:", error);
      res.status(500).json({ 
        error: "Failed to fetch transit route data", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });
}