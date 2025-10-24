import { Express, Request, Response } from "express";
import { firestore } from "./firebasesetup.js";
import { 
  PinFolderSchema, 
  AddPinRequestSchema, 
  RemovePinRequestSchema 
} from "./pinSchema.js";

export function registerPinFolderHandlers(app: Express) {
  /**
   * GET /pins/:userId - Get all pins in a user's folder
   */
  app.get("/pins/:userId", async (req: Request, res: Response) => {
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
          pins: [],
          message: "Pin folder retrieved successfully (mock - Firebase not configured)."
        });
      }

      // Get the user's pin folder
      const pinFolderQuery = await firestore
        .collection("pins")
        .where("userId", "==", userId)
        .limit(1)
        .get();

      if (pinFolderQuery.empty) {
        // No pin folder found, return empty array
        return res.status(200).json({
          success: true,
          pins: [],
          message: "No pin folder found for this user."
        });
      }

      const pinFolderDoc = pinFolderQuery.docs[0];
      const pinFolderData = pinFolderDoc.data();

      res.status(200).json({
        success: true,
        pins: pinFolderData.pins || [],
        message: "Pin folder retrieved successfully."
      });
    } catch (error) {
      console.error("Failed to retrieve pin folder:", error);
      res.status(500).json({ error: "Server error while retrieving pin folder." });
    }
  });

  /**
   * POST /pins - Add a new pin to the folder or create a new folder
   */
  app.post("/pins", async (req: Request, res: Response) => {
    try {
      console.log("Received add pin request body:", JSON.stringify(req.body, null, 2));

      // Validate request body with Zod
      const validation = AddPinRequestSchema.safeParse(req.body);

      if (!validation.success) {
        console.error("Validation failed:", validation.error.errors);
        return res.status(400).json({
          error: "Invalid request data",
          details: validation.error.errors
        });
      }

      const { userId, pin } = validation.data;

      // Check if Firebase is configured
      if (!firestore) {
        console.warn("Firebase not configured - returning mock response");
        return res.status(200).json({
          success: true,
          message: "Pin added successfully (mock - Firebase not configured)."
        });
      }

      // Check if a pin folder for this user already exists
      const pinFolderQuery = await firestore
        .collection("pins")
        .where("userId", "==", userId)
        .limit(1)
        .get();

      if (pinFolderQuery.empty) {
        // Create new pin folder with this pin
        await firestore.collection("pins").add({
          userId,
          pins: [pin],
          updatedAt: new Date().toISOString(),
          createdAt: new Date()
        });

        return res.status(200).json({
          success: true,
          message: "Pin folder created and pin added successfully."
        });
      } else {
        // Update existing pin folder
        const pinFolderDoc = pinFolderQuery.docs[0];
        const pinFolderData = pinFolderDoc.data();
        
        // Check if pin already exists in folder
        const existingPins = pinFolderData.pins || [];
        const pinExists = existingPins.some((existingPin: any) => existingPin.id === pin.id);
        
        if (pinExists) {
          return res.status(200).json({
            success: true,
            message: "Pin already exists in folder."
          });
        }
        
        // Add the new pin
        await firestore.collection("pins").doc(pinFolderDoc.id).update({
          pins: [...existingPins, pin],
          updatedAt: new Date().toISOString()
        });

        return res.status(200).json({
          success: true,
          message: "Pin added to folder successfully."
        });
      }
    } catch (error) {
      console.error("Failed to add pin:", error);
      res.status(500).json({ error: "Server error while adding pin." });
    }
  });

  /**
   * POST /pins/sync/:userId - Sync all pins from user's trips to their pin folder
   */
  app.post("/pins/sync/:userId", async (req: Request, res: Response) => {
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
          message: "Pins synced successfully (mock - Firebase not configured)."
        });
      }

      // Get all trips for this user
      const tripsQuery = await firestore
        .collection("trips")
        .where("userId", "==", userId)
        .get();

      if (tripsQuery.empty) {
        return res.status(200).json({
          success: true,
          message: "No trips found for this user."
        });
      }

      // Extract all pins from all trips
      const allPins: any[] = [];
      const pinKeys = new Set(); // To track unique pins by name+lat+lng

      tripsQuery.forEach(tripDoc => {
        const tripData = tripDoc.data();
        const activities = tripData.activities || {};

        // Iterate through all activities in all dates
        Object.values(activities).forEach((activitiesForDate: any) => {
          activitiesForDate.forEach((activity: any) => {
            // Create a unique key for this pin based on name and coordinates
            const pinKey = `${activity.name}_${activity.lat}_${activity.lng}`;
            
            // Only add if we haven't seen this pin before
            if (!pinKeys.has(pinKey)) {
              pinKeys.add(pinKey);
              
              // Convert activity to Pin format
              allPins.push({
                id: activity.id,
                name: activity.name,
                description: activity.description || "",
                duration: activity.duration,
                lat: activity.lat,
                lng: activity.lng,
                addedAt: new Date().toISOString()
              });
            }
          });
        });
      });

      // Get the user's pin folder or create one if it doesn't exist
      const pinFolderQuery = await firestore
        .collection("pins")
        .where("userId", "==", userId)
        .limit(1)
        .get();

      if (pinFolderQuery.empty) {
        // Create new pin folder with all pins from trips
        await firestore.collection("pins").add({
          userId,
          pins: allPins,
          updatedAt: new Date().toISOString(),
          createdAt: new Date()
        });

        return res.status(200).json({
          success: true,
          pinsAdded: allPins.length,
          message: "Pin folder created and all pins from trips added successfully."
        });
      } else {
        // Update existing pin folder
        const pinFolderDoc = pinFolderQuery.docs[0];
        const pinFolderData = pinFolderDoc.data();
        const existingPins = pinFolderData.pins || [];
        
        // Find pins that need to be added (not already in the folder)
        const pinsToAdd = allPins.filter(tripPin => {
          return !existingPins.some((existingPin: any) => 
            existingPin.name === tripPin.name && 
            Math.abs(existingPin.lat - tripPin.lat) < 0.0001 && 
            Math.abs(existingPin.lng - tripPin.lng) < 0.0001
          );
        });
        
        if (pinsToAdd.length === 0) {
          return res.status(200).json({
            success: true,
            pinsAdded: 0,
            message: "All pins from trips are already in the folder."
          });
        }
        
        // Add the new pins
        await firestore.collection("pins").doc(pinFolderDoc.id).update({
          pins: [...existingPins, ...pinsToAdd],
          updatedAt: new Date().toISOString()
        });

        return res.status(200).json({
          success: true,
          pinsAdded: pinsToAdd.length,
          message: `${pinsToAdd.length} pins synced from trips to folder successfully.`
        });
      }
    } catch (error) {
      console.error("Failed to sync pins from trips:", error);
      res.status(500).json({ error: "Server error while syncing pins from trips." });
    }
  });

  /**
   * DELETE /pins/:userId/:pinId - Remove a pin from the folder
   */
  app.delete("/pins/:userId/:pinId", async (req: Request, res: Response) => {
    try {
      const { userId, pinId } = req.params;

      if (!userId || !pinId) {
        return res.status(400).json({ error: "User ID and Pin ID are required" });
      }

      // Check if Firebase is configured
      if (!firestore) {
        console.warn("Firebase not configured - returning mock response");
        return res.status(200).json({
          success: true,
          message: "Pin removed successfully (mock - Firebase not configured)."
        });
      }

      // Get the user's pin folder
      const pinFolderQuery = await firestore
        .collection("pins")
        .where("userId", "==", userId)
        .limit(1)
        .get();

      if (pinFolderQuery.empty) {
        return res.status(404).json({
          error: "Pin folder not found."
        });
      }

      const pinFolderDoc = pinFolderQuery.docs[0];
      const pinFolderData = pinFolderDoc.data();
      
      // Filter out the pin to remove
      const existingPins = pinFolderData.pins || [];
      const updatedPins = existingPins.filter((pin: any) => pin.id !== pinId);
      
      if (existingPins.length === updatedPins.length) {
        return res.status(404).json({
          error: "Pin not found in folder."
        });
      }
      
      // Update the pin folder
      await firestore.collection("pins").doc(pinFolderDoc.id).update({
        pins: updatedPins,
        updatedAt: new Date().toISOString()
      });

      res.status(200).json({
        success: true,
        message: "Pin removed from folder successfully."
      });
    } catch (error) {
      console.error("Failed to remove pin:", error);
      res.status(500).json({ error: "Server error while removing pin." });
    }
  });

  /**
   * PUT /pins/:pinId/addToItinerary - Add a pin to a specific itinerary date
   */
  app.put("/pins/:pinId/addToItinerary", async (req: Request, res: Response) => {
    try {
      const { pinId } = req.params;
      const { userId, date } = req.body;

      if (!pinId || !userId || !date) {
        return res.status(400).json({ error: "Pin ID, User ID, and date are required" });
      }

      // Check if Firebase is configured
      if (!firestore) {
        console.warn("Firebase not configured - returning mock response");
        return res.status(200).json({
          success: true,
          message: "Pin added to itinerary successfully (mock - Firebase not configured)."
        });
      }

      // Get the user's pin folder
      const pinFolderQuery = await firestore
        .collection("pins")
        .where("userId", "==", userId)
        .limit(1)
        .get();

      if (pinFolderQuery.empty) {
        return res.status(404).json({
          error: "Pin folder not found."
        });
      }

      const pinFolderDoc = pinFolderQuery.docs[0];
      const pinFolderData = pinFolderDoc.data();
      
      // Find the pin in the folder
      const existingPins = pinFolderData.pins || [];
      const pin = existingPins.find((p: any) => p.id === pinId);
      
      if (!pin) {
        return res.status(404).json({
          error: "Pin not found in folder."
        });
      }

      // The pin is now ready to be added to the itinerary in the frontend
      // We don't need to modify the pin folder here

      res.status(200).json({
        success: true,
        pin: { ...pin, date },
        message: "Pin ready to be added to itinerary."
      });
    } catch (error) {
      console.error("Failed to add pin to itinerary:", error);
      res.status(500).json({ error: "Server error while adding pin to itinerary." });
    }
  });
}