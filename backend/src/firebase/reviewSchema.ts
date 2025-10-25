import { z } from "zod";

/**
 * Schema for a single review
 */
export const ReviewSchema = z.object({
  id: z.string(),
  pinId: z.string(),
  userId: z.string(),
  content: z.string(),
  createdAt: z.string(), // ISO date string
  updatedAt: z.string(), // ISO date string
});

export type Review = z.infer<typeof ReviewSchema>;

/**
 * Request schema for adding a review
 */
export const AddReviewRequestSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  pinId: z.string().min(1, "Pin ID is required"),
  content: z.string().min(1, "Review content is required"),
});

export type AddReviewRequest = z.infer<typeof AddReviewRequestSchema>;

/**
 * Request schema for updating a review
 */
export const UpdateReviewRequestSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  reviewId: z.string().min(1, "Review ID is required"),
  content: z.string().min(1, "Review content is required"),
});

export type UpdateReviewRequest = z.infer<typeof UpdateReviewRequestSchema>;

/**
 * Response schema for review operations
 */
export const ReviewResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  review: ReviewSchema.optional(),
});

export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;

/**
 * Response schema for getting reviews
 */
export const GetReviewsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  reviews: z.array(ReviewSchema),
});

export type GetReviewsResponse = z.infer<typeof GetReviewsResponseSchema>;