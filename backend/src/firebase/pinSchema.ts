import { z } from "zod";

/**
 * Schema for a single pin
 */
export const PinSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  duration: z.number(),
  lat: z.number(),
  lng: z.number(),
  addedAt: z.string(), // ISO date string
});

export type Pin = z.infer<typeof PinSchema>;

/**
 * Schema for saving a pin folder to Firestore
 */
export const PinFolderSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  pins: z.array(PinSchema),
  updatedAt: z.string(), // ISO date string
});

export type PinFolder = z.infer<typeof PinFolderSchema>;

/**
 * Schema for pin folder document stored in Firestore
 * Includes metadata fields added by the backend
 */
export const PinFolderDocumentSchema = PinFolderSchema.extend({
  createdAt: z.date(),
});

export type PinFolderDocument = z.infer<typeof PinFolderDocumentSchema>;

/**
 * Response schema for saved pin folder
 */
export const SavePinFolderResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type SavePinFolderResponse = z.infer<typeof SavePinFolderResponseSchema>;

/**
 * Request schema for adding a pin to folder
 */
export const AddPinRequestSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  pin: PinSchema,
});

export type AddPinRequest = z.infer<typeof AddPinRequestSchema>;

/**
 * Request schema for removing a pin from folder
 */
export const RemovePinRequestSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  pinId: z.string().min(1, "Pin ID is required"),
});

export type RemovePinRequest = z.infer<typeof RemovePinRequestSchema>;