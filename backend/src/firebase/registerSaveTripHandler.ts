import { Express, Request, Response } from "express";
import { firestore } from "./firebasesetup.js";
import { SaveTripRequestSchema } from "./tripSchema.js";

export function registerSaveTripHandler(app: Express) {
  /**
   * POST /savePins - Save a trip with full itinerary
   */
  app.post("/savePins", async (req: Request, res: Response) => {
    try {
      console.log("Received save request body:", JSON.stringify(req.body, null, 2));

      // Validate request body with Zod
      const validation = SaveTripRequestSchema.safeParse(req.body);

      if (!validation.success) {
        console.error("Validation failed:", validation.error.errors);
        return res.status(400).json({
          error: "Invalid request data",
          details: validation.error.errors
        });
      }

      const tripData = validation.data;
      console.log("Validated trip data:", JSON.stringify(tripData, null, 2));

      // Check if Firebase is configured
      if (!firestore) {
        console.warn("Firebase not configured - returning mock response");
        return res.status(200).json({
          success: true,
          message: "Trip saved successfully (mock - Firebase not configured).",
          tripId: `mock-${Date.now()}`,
          isUpdate: false,
        });
      }

      // Check if a trip with the same userId and destination already exists
      const existingTripQuery = await firestore
        .collection("trips")
        .where("userId", "==", tripData.userId)
        .where("destination.name", "==", tripData.destination.name)
        .limit(1)
        .get();

      let tripId: string;
      let isUpdate: boolean;

      if (!existingTripQuery.empty) {
        // Update existing trip
        const existingDoc = existingTripQuery.docs[0];
        tripId = existingDoc.id;

        await firestore.collection("trips").doc(tripId).update({
          ...tripData,
          updatedAt: new Date(),
          // Keep original createdAt
        });

        isUpdate = true;
        console.log(`Updated existing trip ${tripId} for ${tripData.destination.name}`);
      } else {
        // Create new trip
        const docRef = await firestore.collection("trips").add({
          ...tripData,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        tripId = docRef.id;
        isUpdate = false;
        console.log(`Created new trip ${tripId} for ${tripData.destination.name}`);
      }

      res.status(200).json({
        success: true,
        message: isUpdate ? "Trip updated successfully." : "Trip saved successfully.",
        tripId,
        isUpdate,
      });
    } catch (error) {
      console.error("Failed to save trip:", error);
      res.status(500).json({ error: "Server error while saving trip." });
    }
  });

  /**
   * GET /trips/:userId - Retrieve all trips for a user
   */
  app.get("/trips/:userId", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { destination } = req.query; // Optional destination filter

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      // Check if Firebase is configured
      if (!firestore) {
        console.warn("Firebase not configured - returning mock response");
        return res.status(200).json({
          success: true,
          trips: [],
          message: "Firebase not configured - no trips available"
        });
      }

      // Build query with optional destination filter
      let query = firestore
        .collection("trips")
        .where("userId", "==", userId);

      if (destination && typeof destination === "string") {
        query = query.where("destination.name", "==", destination);
      }

      let snapshot;
      try {
        snapshot = await query.orderBy("createdAt", "desc").get();
      } catch (indexError: any) {
        // If index doesn't exist yet, fall back to query without orderBy and sort in-memory
        if (indexError.code === 9 || indexError.message?.includes("index")) {
          console.warn("Firestore index not ready, using in-memory sort");
          snapshot = await query.get();
        } else {
          throw indexError;
        }
      }

      const trips = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Convert Firestore Timestamps to ISO strings for JSON serialization
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
          updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
        }))
        // Sort in-memory by createdAt descending (newest first)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.status(200).json({
        success: true,
        trips,
        count: trips.length,
      });
    } catch (error) {
      console.error("Failed to retrieve trips:", error);
      res.status(500).json({ error: "Server error while retrieving trips." });
    }
  });

  /**
   * DELETE /trips/:tripId - Delete a specific trip
   */
  app.delete("/trips/:tripId", async (req: Request, res: Response) => {
    try {
      const { tripId } = req.params;
      const { userId } = req.body; // Verify user owns the trip

      if (!tripId) {
        return res.status(400).json({ error: "Trip ID is required" });
      }

      if (!userId) {
        return res.status(400).json({ error: "User ID is required for authorization" });
      }

      // Check if Firebase is configured
      if (!firestore) {
        console.warn("Firebase not configured - returning mock response");
        return res.status(200).json({
          success: true,
          message: "Trip deleted successfully (mock - Firebase not configured).",
        });
      }

      // Verify the trip exists and belongs to the user
      const docRef = firestore.collection("trips").doc(tripId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(404).json({ error: "Trip not found" });
      }

      const tripData = doc.data();
      if (tripData?.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized: You can only delete your own trips" });
      }

      // Delete the trip
      await docRef.delete();

      res.status(200).json({
        success: true,
        message: "Trip deleted successfully.",
        tripId,
      });
    } catch (error) {
      console.error("Failed to delete trip:", error);
      res.status(500).json({ error: "Server error while deleting trip." });
    }
  });
}
