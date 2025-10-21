import { Express, Request, Response } from "express";
import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";

// Types for dependency injection
export type StateFIPSFetcher = (lat: string, lon: string) => Promise<string | null>;
export type CountyFIPSFetcher = (lat: string, lon: string) => Promise<string | null>;
export type PlaceFIPSFetcher = (lat: string, lon: string) => Promise<string | null>;
export type FBIDataFetcher = (url: string) => Promise<any>;
export type APIKeyLoader = () => Promise<string>;



// Interface for FBI API response
interface FBIArrestData {
  data: Array<{
    data_year: number;
    offense: string;
    state_abbr: string;
    arrest_count: number;
  }>;
}

export type StaffData = {
  rates: {
    "Officers per 1,000 People": { [year: string]: number }
  },
  actuals: {
    "Male Officers": { [year: string]: number },
    "Female Officers": { [year: string]: number },
    "Male Civilians": { [year: string]: number },
    "Female Civilians": { [year: string]: number }
  },
  populations: {
    "Participated Population": { [year: string]: number }
  }
};

// Type guard for geocoder response
interface GeocoderResponse {
  result?: {
    geographies?: {
      States?: Array<{
        STATE: string;
        [key: string]: any;
      }>;
      Counties?: Array<{
        COUNTY: string;
        STATE: string;
        [key: string]: any;
      }>;
      "Census Places"?: Array<{
        PLACE: string;
        STATE: string;
        COUNTY: string;
        [key: string]: any;
      }>;
    };
  };
}

// Function to check if response is a valid GeocoderResponse
function isGeocoderResponse(data: any): data is GeocoderResponse {
  return typeof data === 'object' && data !== null;
}

// Default implementation to get state FIPS (reuse from ACS)
export async function getStateFIPS(lat: string, lon: string): Promise<string | null> {
  const geocoderUrl = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lon}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
  const res = await fetch(geocoderUrl);
  
  if (!res.ok) {
    console.warn(`Geocoder API request failed: ${res.status} ${res.statusText}`);
    return null;
  }
  
  const geoData = await res.json();
  
  if (!isGeocoderResponse(geoData)) {
    return null;
  }
  
  const states = geoData?.result?.geographies?.States;
  if (states && states.length > 0 && states[0].STATE) {
    return states[0].STATE;
  }
  return null;
}

// Default implementation to get county FIPS
export async function getCountyFIPS(lat: string, lon: string): Promise<string | null> {
  const geocoderUrl = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lon}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
  const res = await fetch(geocoderUrl);
  
  if (!res.ok) {
    console.warn(`Geocoder API request failed: ${res.status} ${res.statusText}`);
    return null;
  }
  
  const geoData = await res.json();
  
  if (!isGeocoderResponse(geoData)) {
    return null;
  }
  
  const counties = geoData?.result?.geographies?.Counties;
  if (counties && counties.length > 0 && counties[0].COUNTY) {
    return counties[0].COUNTY;
  }
  return null;
}

// Default implementation to get place FIPS
export async function getPlaceFIPS(lat: string, lon: string): Promise<string | null> {
  const geocoderUrl = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lon}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
  const res = await fetch(geocoderUrl);
  
  if (!res.ok) {
    console.warn(`Geocoder API request failed: ${res.status} ${res.statusText}`);
    return null;
  }
  
  const geoData = await res.json();
  
  if (!isGeocoderResponse(geoData)) {
    return null;
  }
  
  const places = geoData?.result?.geographies?.["Census Places"];
  if (places && places.length > 0 && places[0].PLACE) {
    return places[0].PLACE;
  }
  return null;
}

// Convert state FIPS to state abbreviation
const FIPS_TO_STATE: { [key: string]: string } = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE',
  '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
  '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
  '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM',
  '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
  '54': 'WV', '55': 'WI', '56': 'WY'
};

// Convert state FIPS to UCR code (for ORI mapping)
const FIPS_TO_UCR: { [key: string]: string } = {
  '01': '01', '02': '50', '04': '02', '05': '03', '06': '04', '08': '05', '09': '06', '10': '07',
  '11': '08', '12': '09', '13': '10', '15': '51', '16': '11', '17': '12', '18': '13', '19': '14',
  '20': '15', '21': '16', '22': '17', '23': '18', '24': '19', '25': '20', '26': '21', '27': '22',
  '28': '23', '29': '24', '30': '25', '31': '26', '32': '27', '33': '28', '34': '29', '35': '30',
  '36': '31', '37': '32', '38': '33', '39': '34', '40': '35', '41': '36', '42': '37', '44': '38',
  '45': '39', '46': '40', '47': '41', '48': '42', '49': '43', '50': '44', '51': '45', '53': '46',
  '54': '47', '55': '48', '56': '49'
};

// Generate ORI from state and county FIPS codes
function generateORI(stateFIPS: string, countyFIPS: string): string | null {
  // Convert FIPS to UCR state code
  const ucrStateCode = FIPS_TO_UCR[stateFIPS];
  if (!ucrStateCode) {
    console.error(`No UCR state code found for FIPS: ${stateFIPS}`);
    return null;
  }

  // Pad county FIPS to 3 digits
  const paddedCountyFIPS = countyFIPS.padStart(3, '0');
  
  // Generate ORI: UCR state code + county FIPS + "00"
  const ori = `${ucrStateCode}${paddedCountyFIPS}00`;
  
  console.log(`Generated ORI: ${ori} from state FIPS: ${stateFIPS}, county FIPS: ${countyFIPS}`);
  return ori;
}

// Cache for ORI data to avoid re-parsing the large CSV file
let oriCache: Map<string, string[]> | null = null;

async function loadORIData(): Promise<Map<string, string[]>> {
  if (oriCache) {
    return oriCache;
  }

  const csvPath = path.join(process.cwd(), 'data', 'Law-Enforcement-Agency-Identifiers-Crosswalk-2012.csv');
  const csvContent = await fs.readFile(csvPath, 'utf-8');
  const lines = csvContent.split('\n');
  
  oriCache = new Map();
  
  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const columns = line.split(',');
    if (columns.length < 8) continue;
    
    const fipsState = columns[3]; // FIPS_ST
    const fipsCounty = columns[4]; // FIPS_COUNTY
    const ori7 = columns[7]; // ORI7
    
    if (fipsState && fipsCounty && ori7 && ori7 !== '-1') {
      const key = `${fipsState}-${fipsCounty}`;
      if (!oriCache.has(key)) {
        oriCache.set(key, []);
      }
      oriCache.get(key)!.push(ori7);
    }
  }
  
  return oriCache;
}

async function getORIFromFIPS(stateFIPS: string, countyFIPS: string): Promise<string[]> {
  const oriData = await loadORIData();
  const key = `${stateFIPS}-${countyFIPS}`;
  return oriData.get(key) || [];
}

// Default implementation to load API key
export async function loadAPIKey(): Promise<string> {
  try {
    // Try multiple possible paths for the API key file, starting with the exact path
    const possiblePaths = [
      // Exact path provided by the user
      "/Users/miayu/Desktop/csci 0320/api-server-yyu111-sjung03/backend/src/fbi-query/fbi-api-key.txt",
      // Relative paths that might work in different environments
      path.resolve(process.cwd(), "src/fbi-query/fbi-api-key.txt"),
      path.resolve(process.cwd(), "fbi-query/fbi-api-key.txt"),
      path.resolve(process.cwd(), "fbi-api-key.txt"),
      path.resolve(__dirname, "../fbi-api-key.txt"),
      path.resolve(__dirname, "fbi-api-key.txt")
    ];
    
    // Try each path until we find the file
    for (const keyPath of possiblePaths) {
      try {
        console.log(`Trying to load FBI API key from: ${keyPath}`);
        const key = await fs.readFile(keyPath, "utf-8");
        console.log("FBI API key loaded successfully from: " + keyPath);
        return key.trim();
      } catch (error) {
        // Continue to the next path
        console.log(`Failed to load from ${keyPath}`);
      }
    }
    
    // If we get here, we couldn't find the file in any of the paths
    // Fall back to hardcoded key for testing purposes
    console.log("Using hardcoded FBI API key as fallback");
    return "RRoPNnRfxqIaWFb4DIFscvVH3VPMAv6n6OzAWKFN";
  } catch (error) {
    // Last resort fallback
    console.error("Error loading FBI API key:", error);
    return "RRoPNnRfxqIaWFb4DIFscvVH3VPMAv6n6OzAWKFN";
  }
}

// Default implementation to fetch FBI data
export async function fetchFBIData(url: string): Promise<any> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FBI API request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// Helper function to get aggregate arrest count from FBI response
function getAggregateArrestCount(data: FBIArrestData): number {
  if (!data.data || !Array.isArray(data.data)) {
    return 0;
  }
  
  return data.data.reduce((total, record) => {
    return total + (record.arrest_count || 0);
  }, 0);
}

function computeStaffStats(staffData: StaffData, year: string) {
  const maleOfficers = staffData.actuals["Male Officers"]?.[year] ?? 0;
  const femaleOfficers = staffData.actuals["Female Officers"]?.[year] ?? 0;
  const maleCivilians = staffData.actuals["Male Civilians"]?.[year] ?? 0;
  const femaleCivilians = staffData.actuals["Female Civilians"]?.[year] ?? 0;
  const officersPer1000 = staffData.rates["Officers per 1,000 People"]?.[year] ?? null;
  const population = staffData.populations["Participated Population"]?.[year] ?? null;

  return {
    year,
    officerCount: maleOfficers + femaleOfficers,
    civilianCount: maleCivilians + femaleCivilians,
    officersPer1000,
    population
  };
}

// Helper function to check if data has null values
function hasNullValues(data: FBIArrestData): boolean {
  if (!data.data || !Array.isArray(data.data)) {
    return true;
  }
  
  return data.data.some(record => {
    return record.arrest_count === null || record.arrest_count === undefined;
  });
}

function hasNullStaffValues(staffData: StaffData, year: string): boolean {
  const officerFields = [
    staffData.actuals["Male Officers"]?.[year],
    staffData.actuals["Female Officers"]?.[year],
    staffData.actuals["Male Civilians"]?.[year],
    staffData.actuals["Female Civilians"]?.[year],
    staffData.rates["Officers per 1,000 People"]?.[year],
    staffData.populations["Participated Population"]?.[year]
  ];
  return officerFields.some(val => val === null || val === undefined);
}

// Mock FBI arrest data for development and testing
export const mockFBIArrestData: FBIArrestData = {
  data: [
    {
      data_year: 2023,
      offense: "all",
      state_abbr: "RI",
      arrest_count: 1000
    }
  ]
};

// Mock API key loader for development and testing
export const mockAPIKeyLoader: APIKeyLoader = async () => {
  console.log("Mock API key loader called");
  return "mock-api-key";
};

// Mock FBI data fetcher for development and testing
export const mockFBIDataFetcher: FBIDataFetcher = async (url: string) => {
  console.log("Mock FBI data fetcher called with URL:", url);
  return mockFBIArrestData;
};
 
export function registerFBIQueryHandler(
  app: Express,
  stateFIPSFetcher: StateFIPSFetcher = getStateFIPS,
  countyFIPSFetcher: CountyFIPSFetcher = getCountyFIPS,
  placeFIPSFetcher: PlaceFIPSFetcher = getPlaceFIPS,
  fbiDataFetcher: FBIDataFetcher = fetchFBIData,
  apiKeyLoader: APIKeyLoader = loadAPIKey
) {
  app.get("/fbi-arrest-data", async (req: Request, res: Response) => {
    try {
      const { lat, lng, granularity } = req.query;

      // Validate required parameters
      if (!lat || !lng || !granularity) {
        return res.status(400).json({
          error: "Missing required parameters: lat, lng, and granularity are required"
        });
      }

      // Validate granularity
      const validGranularities = ['national', 'state', 'agency'];
      if (!validGranularities.includes(granularity as string)) {
        return res.status(400).json({
          error: "Invalid granularity. Must be one of: national, state, agency"
        });
      }

      const latitude = lat as string;
      const longitude = lng as string;
      const gran = granularity as string;

      // Load API key
      const apiKey = await apiKeyLoader();

      let arrestData: any = null;
      const currentYear = new Date().getFullYear();
      
      // Try years from current year back to 2020
      for (let year = currentYear; year >= 2020; year--) {
        try {
          if (gran === 'national') {
            // National level data
            const url = `https://api.usa.gov/crime/fbi/cde/arrest/national/all?type=counts&from=01-${year}&to=12-${year}&api_key=${apiKey}`;
            arrestData = await fbiDataFetcher(url);
            
            if (arrestData && !hasNullValues(arrestData)) {
              break;
            }
          } else if (gran === 'state') {
            // State level data - need to get state FIPS first
            const stateFIPS = await stateFIPSFetcher(latitude, longitude);
            if (!stateFIPS) {
              return res.status(404).json({
                error: "Could not determine state from coordinates"
              });
            }

            const stateAbbr = FIPS_TO_STATE[stateFIPS];
            if (!stateAbbr) {
              return res.status(404).json({
                error: `No state abbreviation found for FIPS code: ${stateFIPS}`
              });
            }

            const url = `https://api.usa.gov/crime/fbi/cde/arrest/state/${stateAbbr}/all?type=counts&from=01-${year}&to=12-${year}&api_key=${apiKey}`;
            arrestData = await fbiDataFetcher(url);
            
            if (arrestData && !hasNullValues(arrestData)) {
              break;
            }
          } else if (gran === 'agency') {
            // Agency level data - need to get ORI codes
            const stateFIPS = await stateFIPSFetcher(latitude, longitude);
            const countyFIPS = await countyFIPSFetcher(latitude, longitude);
            
            if (!stateFIPS || !countyFIPS) {
              return res.status(404).json({
                error: "Could not determine state or county from coordinates"
              });
            }

            const oriCodes = await getORIFromFIPS(stateFIPS, countyFIPS);
            if (oriCodes.length === 0) {
              return res.status(404).json({
                error: "No law enforcement agencies found for the given coordinates"
              });
            }

            // Try each ORI code until we find data
            let foundData = false;
            for (const ori of oriCodes) {
              try {
                const url = `https://api.usa.gov/crime/fbi/cde/arrest/agency/${ori}/all?type=counts&from=01-${year}&to=12-${year}&api_key=${apiKey}`;
                const tempData = await fbiDataFetcher(url);
                
                if (tempData && !hasNullValues(tempData)) {
                  arrestData = tempData;
                  foundData = true;
                  break;
                }
              } catch (oriError) {
                console.log(`Failed to fetch data for ORI ${ori}:`, oriError);
                continue;
              }
            }
            
            if (foundData) {
              break;
            }
          }
        } catch (yearError) {
          console.log(`Failed to fetch data for year ${year}:`, yearError);
          continue;
        }
      }

      if (!arrestData) {
        return res.status(404).json({
          error: "No arrest data found for the given coordinates and granularity"
        });
      }

      // Calculate aggregate arrest count
      const aggregateCount = getAggregateArrestCount(arrestData);

      res.status(200).json({
        success: true,
        coordinates: { lat: latitude, lng: longitude },
        granularity: gran,
        data_year: arrestData.data?.[0]?.data_year || currentYear,
        total_arrests: aggregateCount,
        raw_data: arrestData
      });

    } catch (error) {
      console.error("Error in FBI arrest data handler:", error);
      res.status(500).json({
        error: "Internal server error while fetching arrest data"
      });
    }
  });
}

export function registerFBIStaffQueryHandler(
  app: Express,
  stateFIPSFetcher: StateFIPSFetcher = getStateFIPS,
  countyFIPSFetcher: CountyFIPSFetcher = getCountyFIPS,
  placeFIPSFetcher: PlaceFIPSFetcher = getPlaceFIPS,
  fbiDataFetcher: FBIDataFetcher = fetchFBIData,
  apiKeyLoader: APIKeyLoader = loadAPIKey
) {
  app.get("/fbi-staff-data", async (req: Request, res: Response) => {
    try {
      const { lat, lon, granularity } = req.query;
      
      // Validate required parameters
      if (!granularity) {
        return res.status(400).json({ 
          error: "Missing required query parameter: granularity" 
        });
      }

      // Type narrowing for granularity
      if (typeof granularity !== 'string') {
        return res.status(400).json({
          error: "Granularity must be a string"
        });
      }

      // Validate granularity
      const validGranularities = ["national", "state", "agency"];
      if (!validGranularities.includes(granularity)) {
        return res.status(400).json({ 
          error: "Invalid granularity. Must be one of: national, state, agency" 
        });
      }

      // For non-national granularity, we need lat and lon
      if (granularity !== "national" && (!lat || !lon)) {
        return res.status(400).json({ 
          error: "Missing required query parameters: lat, lon (required for state and agency granularity)" 
        });
      }

      // Type narrowing for lat and lon when they're required
      if (granularity !== "national" && (typeof lat !== 'string' || typeof lon !== 'string')) {
        return res.status(400).json({
          error: "Latitude and longitude must be strings"
        });
      }

      // Load API key using the injected apiKeyLoader
      let apiKey;
      try {
        // Use the injected apiKeyLoader function (which will be mockAPIKeyLoader in tests)
        apiKey = await apiKeyLoader();
        
        if (!apiKey) {
          throw new Error("API key is empty or undefined");
        }
      } catch (error) {
        console.error("Error loading FBI API key:", error);
        return res.status(500).json({ 
          error: "Failed to load FBI API key", 
          details: error instanceof Error ? error.message : String(error) 
        });
      }
      
      let fbiUrl: string;
      let staffData: any = null;
      let year = 2025; // Start with most recent year (2025)
      const maxRetries = 10; // Try 2025, 2024, 2023, 2022

      if (granularity === "national") {
        // National level data - lat/lon not needed
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            //FIX
            fbiUrl = `https://api.usa.gov/crime/fbi/cde/pe?from=${year}&to=${year}&api_key=${apiKey}`;
            console.log(`Fetching national data from: ${fbiUrl}`);
            const data = await fbiDataFetcher(fbiUrl);
            console.log(`Received national data staff:`, JSON.stringify(data));

            if (!hasNullStaffValues(data, year.toString())) {
              staffData = data;
              break;
            }

          } catch (error) {
            console.warn(`Failed to fetch national data for ${year}:`, error);
          }
          year--;
        }
      } else if (granularity === "state") {
        // Get state FIPS and convert to abbreviation
        const stateFIPS = await stateFIPSFetcher(lat as string, lon as string);
        if (!stateFIPS) {
          return res.status(400).json({ 
            error: "Could not resolve state from coordinates" 
          });
        }

        const stateAbbr = FIPS_TO_STATE[stateFIPS];
        if (!stateAbbr) {
          return res.status(400).json({ 
            error: `Could not map state FIPS ${stateFIPS} to abbreviation` 
          });
        }

        // Try multiple years for state data
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            fbiUrl = `https://api.usa.gov/crime/fbi/cde/pe/${stateAbbr}?from=${year}&to=${year}&api_key=${apiKey}`;
            console.log(`Fetching state data from: ${fbiUrl}`);
            const data = await fbiDataFetcher(fbiUrl);
            console.log(`Received state data:`, JSON.stringify(data));
            
            if (!hasNullStaffValues(data, year.toString())) {
              staffData = data;
              break;
            }
              
          } catch (error) {
            console.warn(`Failed to fetch state data for ${stateAbbr} in ${year}:`, error);
          }
          year--;
        }
      } else if (granularity === "agency") {
        // Get state and county FIPS codes
        const stateFIPS = await stateFIPSFetcher(lat as string, lon as string);
        const countyFIPS = await countyFIPSFetcher(lat as string, lon as string);
        
        if (!stateFIPS || !countyFIPS) {
          return res.status(400).json({ 
            error: "Could not resolve state or county from coordinates" 
          });
        }

        const stateAbbr = FIPS_TO_STATE[stateFIPS];
        if (!stateAbbr) {
          return res.status(400).json({ 
            error: `Could not map state FIPS ${stateFIPS} to abbreviation` 
          });
        }
        
        // Generate ORI from FIPS codes
        const ori = generateORI(stateFIPS, countyFIPS);
        if (!ori) {
          return res.status(400).json({ 
            error: "Could not generate ORI from state and county FIPS codes" 
          });
        }
        
        // Try multiple years for agency data
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            fbiUrl = `https://api.usa.gov/crime/fbi/cde/pe/${stateAbbr}/${ori}?from=${year}&to=${year}&api_key=${apiKey}`;
            console.log(`Fetching agency data from: ${fbiUrl}`);
            const data = await fbiDataFetcher(fbiUrl);
            console.log(`Received agency data:`, JSON.stringify(data));
            
            if (!hasNullStaffValues(data, year.toString())) {
              staffData = data;
              break;
            }
          } catch (error) {
            console.warn(`Failed to fetch agency data for ORI ${ori} in ${year}:`, error);
          }
          year--;
        }
      }

      if (!staffData) {
        return res.status(404).json({ 
          error: `No staff data found for the specified location and granularity. Tried years ${year+maxRetries}-${year+1}.` 
        });
      }

      // Calculate aggregate staff count
      const staffStats = computeStaffStats(staffData, year.toString());

      res.json({
        query: { lat, lon, granularity },
        year: year, // Use the actual year that was successfully fetched
        fbiUrl: fbiUrl!,
        staffStats,
        rawData: staffData
      });

    } catch (error) {
      console.error("FBI handler error:", error);
      res.status(500).json({ 
        error: "Failed to fetch FBI staff data", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });
}