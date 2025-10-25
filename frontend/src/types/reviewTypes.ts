/**
 * Interface for a review
 */
export interface Review {
  id: string;
  pinId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request for adding a review
 */
export interface AddReviewRequest {
  userId: string;
  pinId: string;
  content: string;
}

/**
 * Request for updating a review
 */
export interface UpdateReviewRequest {
  userId: string;
  reviewId: string;
  content: string;
}

/**
 * Response for review operations
 */
export interface ReviewResponse {
  success: boolean;
  message: string;
  review?: Review;
}

/**
 * Response for getting reviews
 */
export interface GetReviewsResponse {
  success: boolean;
  message: string;
  reviews: Review[];
}