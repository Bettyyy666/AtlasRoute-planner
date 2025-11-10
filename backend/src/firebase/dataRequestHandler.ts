import { Express, Request, Response } from "express";
import { firestore } from "./firebasesetup.js";
import {
  applyBatchTripPrivacy,
  applyBatchReviewPrivacy,
} from "../utils/privacyUtils.js";

export function registerDataRequestHandler(app: Express) {
  /**
   * GET /api/dataRequest - Fetch data from Firebase Firestore with privacy transformations
   * Query parameters:
   *   - type: "reviews" or "trips"
   *   - key: string to match (case-insensitive)
   *   - aggregate: (optional) "true" to enable spatial/temporal aggregation for trips
   *
   * Privacy transformations applied:
   *   1. User IDs replaced with HMAC-SHA256 hashes
   *   2. Coordinates and timestamps include controlled noise/jitter
   *   3. For trips: optional aggregation into grid cells and time bins
   *
   * For reviews: matches "name" field (e.g., "Dutch Windmills (GG Park)")
   * For trips: matches "destination.name" field (case-insensitive substring match)
   */
  app.get("/api/dataRequest", async (req: Request, res: Response) => {
    try {
      const { type, key, aggregate } = req.query;
      const shouldAggregate = aggregate === "true";

      console.log("=== DATA REQUEST ENDPOINT ===");
      console.log(
        `Received request: type=${type}, key=${key}, aggregate=${shouldAggregate}`
      );
      console.log(`Firestore initialized: ${firestore ? "yes" : "no"}`);

      // Validate parameters
      if (
        !type ||
        !key ||
        typeof type !== "string" ||
        typeof key !== "string"
      ) {
        console.log("Invalid parameters");
        return res.status(400).json({ error: "Invalid parameters" });
      }

      // Validate type
      if (type !== "reviews" && type !== "trips") {
        console.log(`Invalid type: ${type}`);
        return res
          .status(400)
          .json({ error: "Invalid type. Must be 'reviews' or 'trips'." });
      }

      // Check if Firebase is configured
      if (!firestore) {
        console.log("Firebase not configured");
        return res.status(500).json({ error: "Firebase not configured" });
      }

      let results: any[] = [];
      const keyLower = key.toLowerCase();

      console.log(`Processing query: type=${type}, keyLower=${keyLower}`);

      if (type === "reviews") {
        try {
          // Query reviews where name equals key (case-insensitive)
          console.log("Querying reviews collection...");
          const reviewsSnapshot = await firestore.collection("reviews").get();
          console.log(`Found ${reviewsSnapshot.size} reviews total`);

          reviewsSnapshot.forEach((doc) => {
            const data = doc.data();
            console.log(`Review doc: id=${data.id}, name=${data.name}`);
          });

          results = reviewsSnapshot.docs
            .map((doc) => doc.data())
            .filter((doc) => {
              const name = doc.name || "";
              const matches = name.toLowerCase() === keyLower;
              if (matches) {
                console.log(`Match found: ${name}`);
              }
              return matches;
            });
          console.log(`Filtered to ${results.length} matching reviews`);

          // Apply privacy transformations to reviews
          const privacyTransformedReviews = applyBatchReviewPrivacy(results);
          console.log("Privacy transformations applied to reviews");

          results = privacyTransformedReviews;
        } catch (e) {
          console.error("Error querying reviews:", e);
          throw e;
        }
      } else if (type === "trips") {
        try {
          // Query trips where destination.name contains key (case-insensitive)
          console.log("Querying trips collection...");
          const tripsSnapshot = await firestore.collection("trips").get();
          console.log(`Found ${tripsSnapshot.size} trips total`);

          tripsSnapshot.forEach((doc) => {
            const data = doc.data();
            const destinationName = data.destination?.name || "N/A";
            console.log(
              `Trip doc: id=${doc.id}, destination=${destinationName}`
            );
          });

          results = tripsSnapshot.docs
            .map((doc) => doc.data())
            .filter((doc) => {
              // destination is an object with {name, lat, lng}
              const destination = doc.destination?.name || "";
              const matches = destination.toLowerCase().includes(keyLower);
              if (matches) {
                console.log(`Match found: ${destination}`);
              }
              return matches;
            });
          console.log(`Filtered to ${results.length} matching trips`);

          // Apply privacy transformations to trips
          const privacyTransformedTrips = applyBatchTripPrivacy(
            results,
            shouldAggregate
          );
          console.log(
            `Privacy transformations applied to trips (aggregate=${shouldAggregate})`
          );

          results = privacyTransformedTrips;
        } catch (e) {
          console.error("Error querying trips:", e);
          throw e;
        }
      }

      console.log(
        `Returning ${results.length} results with privacy transformations`
      );
      res.status(200).json({
        status: "ok",
        count: results.length,
        data: results,
      });
    } catch (error) {
      console.error("=== FATAL ERROR ===");
      console.error("Failed to fetch data from Firebase:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      res.status(500).json({ error: "Server error while fetching data." });
    }
  });
}
