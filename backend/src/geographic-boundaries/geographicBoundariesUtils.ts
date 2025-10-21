import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { StateGeoJSON, CountyGeoJSON, StateFeature, CountyFeature, StateGeoJSONSchema, CountyGeoJSONSchema } from './geographicBoundariesSchema.js';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache for loaded GeoJSON data
let statesData: StateGeoJSON | null = null;
let countiesData: CountyGeoJSON | null = null;

/**
 * Clean and validate GeoJSON coordinates to handle malformed data
 */
function cleanAndValidateGeoJSON(data: any): any {
  if (!data || typeof data !== 'object') return data;
  
  if (Array.isArray(data)) {
    return data.map(item => cleanAndValidateGeoJSON(item)).filter(item => item !== undefined);
  }
  
  if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
    return {
      ...data,
      features: data.features.map((feature: any) => {
        if (feature.type === 'Feature' && feature.geometry) {
          return {
            ...feature,
            geometry: cleanAndValidateGeometry(feature.geometry)
          };
        }
        return feature;
      }).filter((feature: any) => feature.geometry !== null)
    };
  }
  
  return data;
}

/**
 * Clean and validate geometry coordinates
 */
function cleanAndValidateGeometry(geometry: any): any {
  if (!geometry || typeof geometry !== 'object') return null;
  
  if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon: any) => 
        polygon.map((ring: any) => 
          Array.isArray(ring) ? ring.filter((coord: any) => 
            Array.isArray(coord) && coord.length >= 2 && 
            typeof coord[0] === 'number' && typeof coord[1] === 'number'
          ) : []
        ).filter((ring: any) => ring.length >= 4) // Minimum 4 points for a valid ring
      ).filter((polygon: any) => polygon.length > 0)
    };
  }
  
  return null; // Return null for unsupported or invalid geometry types
}

/**
 * Load and parse the states GeoJSON file with graceful error handling
 */
export function loadStatesData(): StateGeoJSON {
  if (statesData) {
    return statesData;
  }

  try {
    const dataPath = path.join(__dirname, '../../data/gz_2010_us_040_00_500k.json');
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const parsedData = JSON.parse(rawData);
    
    // Clean and validate the data structure
    const cleanedData = cleanAndValidateGeoJSON(parsedData);
    statesData = StateGeoJSONSchema.parse(cleanedData);
    return statesData;
  } catch (error) {
    console.warn('Failed to validate states data with strict schema, using fallback:', error);
    
    // Fallback: return empty feature collection if validation fails
    statesData = {
      type: 'FeatureCollection',
      features: []
    } as StateGeoJSON;
    return statesData;
  }
}

/**
 * Load and parse the counties GeoJSON file with graceful error handling
 */
export function loadCountiesData(): CountyGeoJSON {
  if (countiesData) {
    return countiesData;
  }

  try {
    const dataPath = path.join(__dirname, '../../data/gz_2010_us_050_00_500k.json');
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const parsedData = JSON.parse(rawData);
    
    // Clean and validate the data structure
    const cleanedData = cleanAndValidateGeoJSON(parsedData);
    countiesData = CountyGeoJSONSchema.parse(cleanedData);
    return countiesData;
  } catch (error) {
    console.warn('Failed to validate counties data with strict schema, using fallback:', error);
    
    // Fallback: return empty feature collection if validation fails
    countiesData = {
      type: 'FeatureCollection',
      features: []
    } as CountyGeoJSON;
    return countiesData;
  }
}

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
function pointInPolygon(point: [number, number], polygon: number[][][]): boolean {
  const [x, y] = point;
  let inside = false;

  // Check the outer ring (first array in polygon)
  const ring = polygon[0];
  
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

/**
 * Check if a point is inside a MultiPolygon geometry
 */
function pointInMultiPolygon(point: [number, number], multiPolygon: number[][][][]): boolean {
  for (const polygon of multiPolygon) {
    if (pointInPolygon(point, polygon)) {
      return true;
    }
  }
  return false;
}

/**
 * Find states that contain the given coordinates
 */
export function findStatesContainingPoint(longitude: number, latitude: number): StateFeature[] {
  const statesData = loadStatesData();
  const point: [number, number] = [longitude, latitude];
  
  return statesData.features.filter(feature => {
    if (feature.geometry.type === 'MultiPolygon') {
      return pointInMultiPolygon(point, feature.geometry.coordinates);
    }
    return false;
  });
}

/**
 * Find counties that contain the given coordinates
 */
export function findCountiesContainingPoint(longitude: number, latitude: number): CountyFeature[] {
  const countiesData = loadCountiesData();
  const point: [number, number] = [longitude, latitude];
  
  return countiesData.features.filter(feature => {
    if (feature.geometry.type === 'MultiPolygon') {
      return pointInMultiPolygon(point, feature.geometry.coordinates);
    }
    return false;
  });
}

/**
 * Get geographic boundaries for a specific point
 */
export function getGeographicBoundaries(
  longitude: number, 
  latitude: number, 
  includeStates: boolean = true, 
  includeCounties: boolean = true
): { states?: StateFeature[], counties?: CountyFeature[] } {
  const result: { states?: StateFeature[], counties?: CountyFeature[] } = {};
  
  if (includeStates) {
    result.states = findStatesContainingPoint(longitude, latitude);
  }
  
  if (includeCounties) {
    result.counties = findCountiesContainingPoint(longitude, latitude);
  }
  
  return result;
}