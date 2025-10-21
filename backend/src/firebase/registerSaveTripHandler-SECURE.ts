/**
 * PROOF OF CONCEPT: Secured Trip Handler with Authentication and Authorization
 *
 * This file demonstrates how to properly secure the trip endpoints with:
 * 1. Firebase ID token verification (authentication)
 * 2. Resource ownership checks (authorization)
 * 3. Defense-in-depth security measures
 */

import { Express, Request, Response } from "express";
import { firestore } from "./firebasesetup.js";
import { SaveTripRequestSchema } from "./tripSchema.js";
import {
  requireAuth,
  AuthenticatedRequest,
} from "../middleware/authMiddleware.js";

export function registerSaveTripHandler(app: Express) {
  /**
   * POST /savePins - Save a trip with full itinerary (SECURED)
   *
   * Security improvements:
   * - requireAuth middleware verifies Firebase ID token
   * - Uses verified userId from token (not request body)
   * - Validates userId match between token and body
   * - Prevents spoofing attacks
   */
  app.post(
    "/savePins",
    requireAuth, // AUTHENTICATION: Verify token before processing
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        console.log("Received save request body:", JSON.stringify(req.body, null, 2));

        // VERIFIED: req.user.uid comes from cryptographically verified token
        const authenticatedUserId = req.user!.uid;
        console.log("Authenticated user ID from token:", authenticatedUserId);

        // Validate request body with Zod
        const validation = SaveTripRequestSchema.safeParse(req.body);

        if (!validation.success) {
          console.error("Validation failed:", validation.error.errors);
          return res.status(400).json({
            error: "Invalid request data",
            details: validation.error.errors,
          });
        }

        const tripData = validation.data;

        // AUTHORIZATION: Verify userId in body matches authenticated user
        // This prevents a malicious user from creating trips for other users
        if (tripData.userId !== authenticatedUserId) {
          console.warn(
            `UserId mismatch: token=${authenticatedUserId}, body=${tripData.userId}`
          );
          return res.status(403).json({
            error: "Forbidden: UserId mismatch",
            message: "You can only create trips for your own account",
          });
        }

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

        // SECURE: Use authenticated userId for database query
        // This ensures we only query trips that belong to the authenticated user
        const existingTripQuery = await firestore
          .collection("trips")
          .where("userId", "==", authenticatedUserId) // VERIFIED USER
          .where("destination.name", "==", tripData.destination.name)
          .limit(1)
          .get();

        let tripId: string;
        let isUpdate: boolean;

        if (!existingTripQuery.empty) {
          // Update existing trip
          const existingDoc = existingTripQuery.docs[0];
          tripId = existingDoc.id;

          // DOUBLE-CHECK: Verify the document actually belongs to this user
          // This is defense-in-depth (should never fail if query is correct)
          const docData = existingDoc.data();
          if (docData.userId !== authenticatedUserId) {
            console.error(
              `SECURITY ALERT: Document ${tripId} userId mismatch!`
            );
            return res.status(500).json({
              error: "Internal security error",
            });
          }

          await firestore.collection("trips").doc(tripId).update({
            ...tripData,
            userId: authenticatedUserId, // ENFORCE: Always use verified userId
            updatedAt: new Date(),
          });

          isUpdate = true;
          console.log(
            `Updated existing trip ${tripId} for ${tripData.destination.name}`
          );
        } else {
          // Create new trip
          const docRef = await firestore.collection("trips").add({
            ...tripData,
            userId: authenticatedUserId, // ENFORCE: Always use verified userId
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          tripId = docRef.id;
          isUpdate = false;
          console.log(
            `Created new trip ${tripId} for ${tripData.destination.name}`
          );
        }

        res.status(200).json({
          success: true,
          message: isUpdate
            ? "Trip updated successfully."
            : "Trip saved successfully.",
          tripId,
          isUpdate,
        });
      } catch (error) {
        console.error("Failed to save trip:", error);
        res.status(500).json({ error: "Server error while saving trip." });
      }
    }
  );

  /**
   * GET /trips/:userId - Retrieve all trips for a user (SECURED)
   *
   * Security improvements:
   * - requireAuth middleware verifies Firebase ID token
   * - Verifies requesting user matches requested userId (authorization)
   * - Prevents users from accessing other users' trips
   */
  app.get(
    "/trips/:userId",
    requireAuth, // AUTHENTICATION: Verify token first
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const authenticatedUserId = req.user!.uid; // VERIFIED from token
        const requestedUserId = req.params.userId; // UNTRUSTED from URL
        const { destination } = req.query; // Optional destination filter

        // AUTHORIZATION: Users can only access their own trips
        if (authenticatedUserId !== requestedUserId) {
          console.warn(
            `Authorization failed: User ${authenticatedUserId} attempted to access trips for ${requestedUserId}`
          );
          return res.status(403).json({
            error: "Forbidden: You can only access your own trips",
          });
        }

        // Check if Firebase is configured
        if (!firestore) {
          console.warn("Firebase not configured - returning mock response");
          return res.status(200).json({
            success: true,
            trips: [],
            message: "Firebase not configured - no trips available",
          });
        }

        // SECURE: Use verified userId for query
        let query = firestore
          .collection("trips")
          .where("userId", "==", authenticatedUserId); // VERIFIED USER

        if (destination && typeof destination === "string") {
          query = query.where("destination.name", "==", destination);
        }

        let snapshot;
        try {
          snapshot = await query.orderBy("createdAt", "desc").get();
        } catch (indexError: any) {
          // Graceful fallback for missing Firestore index
          if (indexError.code === 9 || indexError.message?.includes("index")) {
            console.warn("Firestore index not ready, using in-memory sort");
            snapshot = await query.get();
          } else {
            throw indexError;
          }
        }

        const trips = snapshot.docs
          .map((doc) => {
            const data = doc.data();

            // DEFENSE IN DEPTH: Verify each document belongs to authenticated user
            if (data.userId !== authenticatedUserId) {
              console.error(
                `SECURITY ALERT: Document ${doc.id} returned for wrong user!`
              );
              return null; // Filter out this document
            }

            return {
              id: doc.id,
              ...data,
              createdAt:
                data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
              updatedAt:
                data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
            };
          })
          .filter((trip) => trip !== null) // Remove any null entries
          .sort(
            (a, b) =>
              new Date(b!.createdAt).getTime() - new Date(a!.createdAt).getTime()
          );

        res.status(200).json({
          success: true,
          trips,
          count: trips.length,
        });
      } catch (error) {
        console.error("Failed to retrieve trips:", error);
        res.status(500).json({ error: "Server error while retrieving trips." });
      }
    }
  );

  /**
   * DELETE /trips/:tripId - Delete a specific trip (SECURED)
   *
   * Security improvements:
   * - requireAuth middleware verifies Firebase ID token
   * - Verifies trip ownership before deletion
   * - No need to trust userId from request body
   */
  app.delete(
    "/trips/:tripId",
    requireAuth, // AUTHENTICATION: Verify token first
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const authenticatedUserId = req.user!.uid; // VERIFIED from token
        const tripId = req.params.tripId;

        if (!tripId) {
          return res.status(400).json({ error: "Trip ID is required" });
        }

        // Check if Firebase is configured
        if (!firestore) {
          console.warn("Firebase not configured - returning mock response");
          return res.status(200).json({
            success: true,
            message:
              "Trip deleted successfully (mock - Firebase not configured).",
          });
        }

        // Fetch the trip document
        const docRef = firestore.collection("trips").doc(tripId);
        const doc = await docRef.get();

        if (!doc.exists) {
          return res.status(404).json({ error: "Trip not found" });
        }

        const tripData = doc.data();

        // AUTHORIZATION: Verify trip belongs to authenticated user
        // This prevents horizontal privilege escalation
        if (tripData?.userId !== authenticatedUserId) {
          console.warn(
            `Unauthorized delete attempt: User ${authenticatedUserId} tried to delete trip ${tripId} owned by ${tripData?.userId}`
          );
          return res.status(403).json({
            error: "Forbidden: You can only delete your own trips",
          });
        }

        // All checks passed, safe to delete
        await docRef.delete();

        console.log(
          `User ${authenticatedUserId} deleted trip ${tripId} successfully`
        );

        res.status(200).json({
          success: true,
          message: "Trip deleted successfully.",
          tripId,
        });
      } catch (error) {
        console.error("Failed to delete trip:", error);
        res.status(500).json({ error: "Server error while deleting trip." });
      }
    }
  );
}

/**
 * Security Checklist for this implementation:
 *
 * ✅ Authentication (Who are you?)
 *    - Firebase ID token verified on every protected endpoint
 *    - Invalid/missing tokens rejected with 401
 *    - Token verification uses Firebase Admin SDK (cryptographically secure)
 *
 * ✅ Authorization (What can you do?)
 *    - Users can only access their own resources
 *    - UserId from token must match userId in request
 *    - Trip ownership verified before modification
 *    - Unauthorized access rejected with 403
 *
 * ✅ Defense in Depth
 *    - Multiple layers of validation
 *    - Verified userId used for all database queries
 *    - Document ownership double-checked before operations
 *    - Security alerts logged for anomalies
 *
 * ✅ Best Practices
 *    - Never trust client input (userId from body/URL)
 *    - Always use verified userId from token
 *    - Appropriate HTTP status codes (401, 403, 404, 500)
 *    - Error messages don't expose sensitive info
 *    - All security events logged
 *
 * ❌ Still Needed for Production
 *    - Rate limiting (prevent brute force)
 *    - CORS configuration (restrict origins)
 *    - HTTPS/TLS (encrypt tokens in transit)
 *    - Request size limits (prevent DoS)
 *    - Input sanitization (prevent injection)
 *    - Firestore security rules (defense in depth)
 */
