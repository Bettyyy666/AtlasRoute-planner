import { z } from "zod";

// Schema for GeoJSON coordinate arrays
const CoordinateSchema = z.tuple([z.number(), z.number()]);
const LinearRingSchema = z.array(CoordinateSchema).min(4);
const PolygonCoordinatesSchema = z.array(LinearRingSchema).min(1);
const MultiPolygonCoordinatesSchema = z.array(PolygonCoordinatesSchema).min(1);

// Schema for GeoJSON geometry
const GeometrySchema = z.object({
  type: z.literal("MultiPolygon"),
  coordinates: MultiPolygonCoordinatesSchema,
});

// Schema for state properties
const StatePropertiesSchema = z.object({
  GEO_ID: z.string(),
  STATE: z.string(),
  NAME: z.string(),
  LSAD: z.string(),
  CENSUSAREA: z.number(),
});

// Schema for county properties
const CountyPropertiesSchema = z.object({
  GEO_ID: z.string(),
  STATE: z.string(),
  COUNTY: z.string(),
  NAME: z.string(),
  LSAD: z.string(),
  CENSUSAREA: z.number(),
});

// Schema for individual GeoJSON features
const StateFeatureSchema = z.object({
  type: z.literal("Feature"),
  properties: StatePropertiesSchema,
  geometry: GeometrySchema,
});

const CountyFeatureSchema = z.object({
  type: z.literal("Feature"),
  properties: CountyPropertiesSchema,
  geometry: GeometrySchema,
});

// Schema for complete GeoJSON FeatureCollection
const StateGeoJSONSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(StateFeatureSchema),
});

const CountyGeoJSONSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(CountyFeatureSchema),
});

// Schema for API request parameters (after manual parsing)
const GeographicBoundariesRequestSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  includeStates: z.boolean().optional().default(true),
  includeCounties: z.boolean().optional().default(true),
});

const GeographicBoundariesResponseSchema = z.object({
  result: z.literal("success"),
  states: z.array(StateFeatureSchema).optional(),
  counties: z.array(CountyFeatureSchema).optional(),
});

const GeographicBoundariesErrorSchema = z.object({
  result: z.literal("error"),
  error_type: z.string(),
  error_message: z.string(),
});

// Type exports
export type StateProperties = z.infer<typeof StatePropertiesSchema>;
export type CountyProperties = z.infer<typeof CountyPropertiesSchema>;
export type StateFeature = z.infer<typeof StateFeatureSchema>;
export type CountyFeature = z.infer<typeof CountyFeatureSchema>;
export type StateGeoJSON = z.infer<typeof StateGeoJSONSchema>;
export type CountyGeoJSON = z.infer<typeof CountyGeoJSONSchema>;
export type GeographicBoundariesRequest = z.infer<typeof GeographicBoundariesRequestSchema>;
export type GeographicBoundariesResponse = z.infer<typeof GeographicBoundariesResponseSchema>;
export type GeographicBoundariesError = z.infer<typeof GeographicBoundariesErrorSchema>;

// Schema exports
export {
  StateGeoJSONSchema,
  CountyGeoJSONSchema,
  GeographicBoundariesRequestSchema,
  GeographicBoundariesResponseSchema,
  GeographicBoundariesErrorSchema,
};