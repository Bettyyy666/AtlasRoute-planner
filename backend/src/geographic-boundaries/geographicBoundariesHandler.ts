import { Request, Response } from 'express';
import { 
  GeographicBoundariesRequestSchema, 
  GeographicBoundariesResponse, 
  GeographicBoundariesError 
} from './geographicBoundariesSchema.js';
import { getGeographicBoundaries } from './geographicBoundariesUtils.js';

/**
 * Handler for the geographic boundaries endpoint
 * Accepts latitude/longitude coordinates and returns the states and/or counties that contain that point
 */
export async function geographicBoundariesHandler(req: Request, res: Response): Promise<void> {
  try {
    // Parse query parameters manually since Express doesn't convert types
    const rawParams = {
      latitude: parseFloat(req.query.latitude as string),
      longitude: parseFloat(req.query.longitude as string),
      includeStates: req.query.includeStates === 'true' || req.query.includeStates === undefined,
      includeCounties: req.query.includeCounties === 'true' || req.query.includeCounties === undefined,
    };

    console.log('Raw query:', req.query);
    console.log('Parsed params:', rawParams);

    // Validate parsed parameters
    const validationResult = GeographicBoundariesRequestSchema.safeParse(rawParams);
    
    if (!validationResult.success) {
      const errorResponse: GeographicBoundariesError = {
        result: "error",
        error_type: "bad_request",
        error_message: `Invalid request parameters: ${validationResult.error.message}`
      };
      res.status(400).json(errorResponse);
      return;
    }

    const { latitude, longitude, includeStates, includeCounties } = validationResult.data;

    // Get geographic boundaries for the specified point
    const boundaries = getGeographicBoundaries(longitude, latitude, includeStates, includeCounties);

    const response: GeographicBoundariesResponse = {
      result: "success",
      ...(includeStates && { states: boundaries.states }),
      ...(includeCounties && { counties: boundaries.counties })
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Error in geographicBoundariesHandler:', error);
    
    const errorResponse: GeographicBoundariesError = {
      result: "error",
      error_type: "server_error",
      error_message: error instanceof Error ? error.message : "An unexpected error occurred"
    };
    
    res.status(500).json(errorResponse);
  }
}