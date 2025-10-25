import { 
  Review, 
  AddReviewRequest, 
  UpdateReviewRequest, 
  ReviewResponse, 
  GetReviewsResponse 
} from "../../types/reviewTypes";

/**
 * Service for handling review-related API calls
 */
class ReviewService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
  }

  /**
   * Get all reviews for a specific pin
   * @param pinId The ID of the pin
   * @returns Promise with the reviews
   */
  async getReviewsByPin(pinId: string): Promise<Review[]> {
    try {
      const response = await fetch(`${this.baseUrl}/reviews/pin/${pinId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch reviews: ${response.statusText}`);
      }
      
      const data = await response.json() as GetReviewsResponse;
      return data.reviews;
    } catch (error) {
      console.error("Error fetching reviews:", error);
      return [];
    }
  }

  /**
   * Get all reviews by a specific user
   * @param userId The ID of the user
   * @returns Promise with the reviews
   */
  async getReviewsByUser(userId: string): Promise<Review[]> {
    try {
      const response = await fetch(`${this.baseUrl}/reviews/user/${userId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch reviews: ${response.statusText}`);
      }
      
      const data = await response.json() as GetReviewsResponse;
      return data.reviews;
    } catch (error) {
      console.error("Error fetching reviews:", error);
      return [];
    }
  }

  /**
   * Add a new review
   * @param reviewData The review data to add
   * @returns Promise with the response
   */
  async addReview(reviewData: AddReviewRequest): Promise<ReviewResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reviewData),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to add review: ${response.statusText}`);
      }
      
      return await response.json() as ReviewResponse;
    } catch (error) {
      console.error("Error adding review:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Update an existing review
   * @param reviewId The ID of the review to update
   * @param reviewData The updated review data
   * @returns Promise with the response
   */
  async updateReview(reviewId: string, reviewData: UpdateReviewRequest): Promise<ReviewResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/reviews/${reviewId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reviewData),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update review: ${response.statusText}`);
      }
      
      return await response.json() as ReviewResponse;
    } catch (error) {
      console.error("Error updating review:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Delete a review
   * @param reviewId The ID of the review to delete
   * @param userId The ID of the user deleting the review
   * @returns Promise with the response
   */
  async deleteReview(reviewId: string, userId: string): Promise<ReviewResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/reviews/${reviewId}?userId=${userId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete review: ${response.statusText}`);
      }
      
      return await response.json() as ReviewResponse;
    } catch (error) {
      console.error("Error deleting review:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }
}

export const reviewService = new ReviewService();