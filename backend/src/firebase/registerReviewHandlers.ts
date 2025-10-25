import { Express, Request, Response } from "express";
import { firestore } from "./firebasesetup.js";
import { 
  ReviewSchema, 
  AddReviewRequestSchema, 
  UpdateReviewRequestSchema 
} from "./reviewSchema.js";
import { v4 as uuidv4 } from "uuid";

export function registerReviewHandlers(app: Express) {
  /**
   * GET /reviews/pin/:pinId - Get all reviews for a specific pin
   */
  app.get("/reviews/pin/:pinId", async (req: Request, res: Response) => {
    try {
      const { pinId } = req.params;

      if (!pinId) {
        return res.status(400).json({ error: "Pin ID is required" });
      }

      // Check if Firebase is configured
      if (!firestore) {
        console.warn("Firebase not configured - returning mock response");
        return res.status(200).json({
          success: true,
          reviews: [],
          message: "Reviews retrieved successfully (mock - Firebase not configured)."
        });
      }

      // Get all reviews for this pin
      const reviewsQuery = await firestore
        .collection("reviews")
        .where("pinId", "==", pinId)
        .get();

      const reviews = reviewsQuery.docs.map(doc => doc.data());

      res.status(200).json({
        success: true,
        reviews,
        message: "Reviews retrieved successfully."
      });
    } catch (error) {
      console.error("Failed to retrieve reviews:", error);
      res.status(500).json({ error: "Server error while retrieving reviews." });
    }
  });

  /**
   * GET /reviews/user/:userId - Get all reviews by a specific user
   */
  app.get("/reviews/user/:userId", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      // Check if Firebase is configured
      if (!firestore) {
        console.warn("Firebase not configured - returning mock response");
        return res.status(200).json({
          success: true,
          reviews: [],
          message: "Reviews retrieved successfully (mock - Firebase not configured)."
        });
      }

      // Get all reviews by this user
      const reviewsQuery = await firestore
        .collection("reviews")
        .where("userId", "==", userId)
        .get();

      const reviews = reviewsQuery.docs.map(doc => doc.data());

      res.status(200).json({
        success: true,
        reviews,
        message: "Reviews retrieved successfully."
      });
    } catch (error) {
      console.error("Failed to retrieve reviews:", error);
      res.status(500).json({ error: "Server error while retrieving reviews." });
    }
  });

  /**
   * POST /reviews - Add a new review
   */
  app.post("/reviews", async (req: Request, res: Response) => {
    try {
      // Validate request body with Zod
      const validation = AddReviewRequestSchema.safeParse(req.body);

      if (!validation.success) {
        console.error("Validation failed:", validation.error.errors);
        return res.status(400).json({
          error: "Invalid request data",
          details: validation.error.errors
        });
      }

      const { userId, pinId, content } = validation.data;

      // Check if Firebase is configured
      if (!firestore) {
        console.warn("Firebase not configured - returning mock response");
        return res.status(200).json({
          success: true,
          message: "Review added successfully (mock - Firebase not configured)."
        });
      }

      // Check if user already has a review for this pin
      const existingReviewQuery = await firestore
        .collection("reviews")
        .where("userId", "==", userId)
        .where("pinId", "==", pinId)
        .get();

      if (!existingReviewQuery.empty) {
        return res.status(400).json({
          error: "User already has a review for this pin."
        });
      }

      // Create new review
      const reviewId = uuidv4();
      const now = new Date().toISOString();
      
      const review = {
        id: reviewId,
        pinId,
        userId,
        content,
        createdAt: now,
        updatedAt: now
      };

      await firestore.collection("reviews").doc(reviewId).set(review);

      res.status(201).json({
        success: true,
        review,
        message: "Review added successfully."
      });
    } catch (error) {
      console.error("Failed to add review:", error);
      res.status(500).json({ error: "Server error while adding review." });
    }
  });

  /**
   * PUT /reviews/:reviewId - Update an existing review
   */
  app.put("/reviews/:reviewId", async (req: Request, res: Response) => {
    try {
      const { reviewId } = req.params;

      // Validate request body with Zod
      const validation = UpdateReviewRequestSchema.safeParse(req.body);

      if (!validation.success) {
        console.error("Validation failed:", validation.error.errors);
        return res.status(400).json({
          error: "Invalid request data",
          details: validation.error.errors
        });
      }

      const { userId, content } = validation.data;

      // Check if Firebase is configured
      if (!firestore) {
        console.warn("Firebase not configured - returning mock response");
        return res.status(200).json({
          success: true,
          message: "Review updated successfully (mock - Firebase not configured)."
        });
      }

      // Get the review
      const reviewDoc = await firestore.collection("reviews").doc(reviewId).get();

      if (!reviewDoc.exists) {
        return res.status(404).json({
          error: "Review not found."
        });
      }

      const reviewData = reviewDoc.data();

      // Check if the user is the owner of the review
      if (reviewData?.userId !== userId) {
        return res.status(403).json({
          error: "User is not authorized to update this review."
        });
      }

      // Update the review
      const updatedReview = {
        ...reviewData,
        content,
        updatedAt: new Date().toISOString()
      };

      await firestore.collection("reviews").doc(reviewId).update({
        content,
        updatedAt: new Date().toISOString()
      });

      res.status(200).json({
        success: true,
        review: updatedReview,
        message: "Review updated successfully."
      });
    } catch (error) {
      console.error("Failed to update review:", error);
      res.status(500).json({ error: "Server error while updating review." });
    }
  });

  /**
   * DELETE /reviews/:reviewId - Delete a review
   */
  app.delete("/reviews/:reviewId", async (req: Request, res: Response) => {
    try {
      const { reviewId } = req.params;
      const { userId } = req.query;

      if (!reviewId || !userId) {
        return res.status(400).json({ error: "Review ID and User ID are required" });
      }

      // Check if Firebase is configured
      if (!firestore) {
        console.warn("Firebase not configured - returning mock response");
        return res.status(200).json({
          success: true,
          message: "Review deleted successfully (mock - Firebase not configured)."
        });
      }

      // Get the review
      const reviewDoc = await firestore.collection("reviews").doc(reviewId).get();

      if (!reviewDoc.exists) {
        return res.status(404).json({
          error: "Review not found."
        });
      }

      const reviewData = reviewDoc.data();

      // Check if the user is the owner of the review
      if (reviewData?.userId !== userId) {
        return res.status(403).json({
          error: "User is not authorized to delete this review."
        });
      }

      // Delete the review
      await firestore.collection("reviews").doc(reviewId).delete();

      res.status(200).json({
        success: true,
        message: "Review deleted successfully."
      });
    } catch (error) {
      console.error("Failed to delete review:", error);
      res.status(500).json({ error: "Server error while deleting review." });
    }
  });
}