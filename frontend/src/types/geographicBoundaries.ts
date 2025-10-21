// Types for geographic boundaries API
export interface StateProperties {
  GEO_ID: string;
  STATE: string;
  NAME: string;
  LSAD: string;
  CENSUSAREA: number;
}

export interface CountyProperties {
  GEO_ID: string;
  STATE: string;
  COUNTY: string;
  NAME: string;
  LSAD: string;
  CENSUSAREA: number;
}

export interface GeographicFeature {
  type: "Feature";
  properties: StateProperties | CountyProperties;
  geometry: {
    type: "MultiPolygon";
    coordinates: number[][][][];
  };
}

export interface GeographicBoundariesResponse {
  result: "success";
  states?: GeographicFeature[];
  counties?: GeographicFeature[];
}

export interface GeographicBoundariesError {
  result: "error";
  error_type: string;
  error_message: string;
}