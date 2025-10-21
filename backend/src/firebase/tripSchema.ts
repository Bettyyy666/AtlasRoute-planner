import { z } from "zod";

/**
 * Schema for a single activity in the itinerary
 */
export const ActivitySchema = z.object({
  id: z.string(),
  name: z.string(),
  duration: z.number(),
  lat: z.number(),
  lng: z.number(),
  description: z.string().optional(),
  date: z.string(), // MM/DD/YYYY
});

export type Activity = z.infer<typeof ActivitySchema>;

/**
 * Schema for location data
 */
export const LocationSchema = z.object({
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
});

export type Location = z.infer<typeof LocationSchema>;

/**
 * Schema for activities grouped by date
 * Key is date string in MM/DD/YYYY format
 * Value is array of activities for that date
 */
export const ActivitiesByDateSchema = z.record(z.string(), z.array(ActivitySchema));

export type ActivitiesByDate = z.infer<typeof ActivitiesByDateSchema>;

/**
 * Schema for saving a trip to Firestore
 */
export const SaveTripRequestSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  title: z.string().min(1, "Trip title is required"),
  destination: LocationSchema,
  startDate: z.string(), // ISO date string
  endDate: z.string(), // ISO date string
  activities: ActivitiesByDateSchema,
});

export type SaveTripRequest = z.infer<typeof SaveTripRequestSchema>;

/**
 * Schema for trip document stored in Firestore
 * Includes metadata fields added by the backend
 */
export const TripDocumentSchema = SaveTripRequestSchema.extend({
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TripDocument = z.infer<typeof TripDocumentSchema>;

/**
 * Response schema for saved trip
 */
export const SaveTripResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  tripId: z.string(),
});

export type SaveTripResponse = z.infer<typeof SaveTripResponseSchema>;
