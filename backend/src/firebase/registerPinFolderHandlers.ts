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
      console.log("=== PIN SYNC STARTED ===");
      const { userId } = req.params;
      console.log(`Syncing pins for user: ${userId}`);

      if (!userId) {
        console.log("Error: User ID is required");
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

      console.log(`Found ${tripsQuery.size} trips for user ${userId}`);

      if (tripsQuery.empty) {
        console.log("No trips found, clearing pin folder");
        // If no trips exist, we should clear the pin folder or create an empty one
        const pinFolderQuery = await firestore
          .collection("pins")
          .where("userId", "==", userId)
          .limit(1)
          .get();
          
        if (!pinFolderQuery.empty) {
          // Clear pins if the folder exists
          const pinFolderDoc = pinFolderQuery.docs[0];
          await firestore.collection("pins").doc(pinFolderDoc.id).update({
            pins: [],
            updatedAt: new Date().toISOString()
          });
          console.log("Pin folder cleared - all pins removed");
        }
        
        return res.status(200).json({
          success: true,
          pinsCount: 0,
          message: "No trips found for this user. Pin folder cleared."
        });
      }

      // Extract all unique pins from all trips
      const uniquePins: any[] = [];
      const pinKeys = new Set(); // To track unique pins by name+lat+lng

      // First, collect all activities from all trips
      const allActivities: any[] = [];
      
      console.log("=== COLLECTING ACTIVITIES FROM TRIPS ===");
      tripsQuery.forEach(tripDoc => {
        const tripData = tripDoc.data();
        console.log(`Processing trip: ${tripData.title} (ID: ${tripDoc.id})`);
        const activities = tripData.activities || {};
        console.log(`Trip activities structure:`, JSON.stringify(activities));
        
        // Log the date keys in the activities object
        const dateKeys = Object.keys(activities);
        console.log(`Date keys in activities: ${dateKeys.join(', ')}`);

        // Iterate through all activities in all dates and collect them
        Object.keys(activities).forEach(date => {
          const activitiesForDate = activities[date] || [];
          console.log(`Date ${date} has ${activitiesForDate.length} activities`);
          
          activitiesForDate.forEach((activity: any) => {
            if (activity && activity.id) { // Ensure activity is valid
              console.log(`Adding activity: ${activity.name} (ID: ${activity.id})`);
              allActivities.push(activity);
            } else {
              console.log(`Skipping invalid activity:`, activity);
            }
          });
        });
      });
      
      console.log(`Total activities collected: ${allActivities.length}`);
      console.log("All activities:", JSON.stringify(allActivities));
      
      // Now process all activities to create unique pins
      console.log("=== CREATING UNIQUE PINS ===");
      allActivities.forEach(activity => {
        // Create a unique key for this pin based on name and coordinates
        const pinKey = `${activity.name}_${activity.lat}_${activity.lng}`;
        console.log(`Processing activity: ${activity.name}, key: ${pinKey}`);
        
        // Only add if we haven't seen this pin before
        if (!pinKeys.has(pinKey)) {
          pinKeys.add(pinKey);
          console.log(`Adding unique pin: ${activity.name} (ID: ${activity.id})`);
          
          // Convert activity to Pin format
          uniquePins.push({
            id: activity.id,
            name: activity.name,
            description: activity.description || "",
            duration: activity.duration,
            lat: activity.lat,
            lng: activity.lng,
            addedAt: new Date().toISOString()
          });
        } else {
          console.log(`Skipping duplicate pin: ${activity.name}`);
        }
      });

      console.log(`Total unique pins to be saved: ${uniquePins.length}`);
      console.log("Unique pins:", JSON.stringify(uniquePins.map(pin => ({ id: pin.id, name: pin.name }))));

      // Get the user's pin folder or create one if it doesn't exist
      const pinFolderQuery = await firestore
        .collection("pins")
        .where("userId", "==", userId)
        .limit(1)
        .get();

      if (pinFolderQuery.empty) {
        // Create new pin folder with all pins from trips
        console.log("No pin folder found, creating new one");
        await firestore.collection("pins").add({
          userId,
          pins: uniquePins,
          updatedAt: new Date().toISOString(),
          createdAt: new Date()
        });

        return res.status(200).json({
          success: true,
          pinsAdded: uniquePins.length,
          message: "Pin folder created with unique pins from all trips."
        });
      } else {
        // Replace existing pins with the unique set from all trips
        // This ensures pins deleted from trips are also removed from the pin folder
        const pinFolderDoc = pinFolderQuery.docs[0];
        const currentPins = pinFolderDoc.data().pins || [];
        
        console.log(`Current pins in folder: ${currentPins.length}`);
        console.log("Current pins:", JSON.stringify(currentPins.map((pin: any) => ({ id: pin.id, name: pin.name }))));
        console.log(`Replacing with ${uniquePins.length} pins from trips`);
        
        // Force complete replacement of pins array, Replace existing pins with the unique set from all trips
        await firestore.collection("pins").doc(pinFolderDoc.id).update({
          pins: uniquePins,
          updatedAt: new Date().toISOString()
        });
        
        console.log("Pin folder updated successfully");
        
        return res.status(200).json({
          success: true,
          pinsCount: uniquePins.length,
          message: "Pin folder updated with unique pins from all trips."
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
   * DELETE /pins/:userId/:pinId/everywhere - Remove a pin from the folder and all trips
   */
  app.delete("/pins/:userId/:pinId/everywhere", async (req: Request, res: Response) => {
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
          message: "Pin removed from everywhere successfully (mock - Firebase not configured)."
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
      
      // Filter out the pin to remove from pin folder
      const existingPins = pinFolderData.pins || [];
      const updatedPins = existingPins.filter((pin: any) => pin.id !== pinId);
      
      // Update the pin folder
      await firestore.collection("pins").doc(pinFolderDoc.id).update({
        pins: updatedPins,
        updatedAt: new Date().toISOString()
      });
      
      // Get all trips for this user
      const tripsQuery = await firestore
        .collection("trips")
        .where("userId", "==", userId)
        .get();
      
      // Update each trip to remove the pin from activities
      const tripUpdates: Promise<any>[] = [];
      tripsQuery.forEach(tripDoc => {
        const tripData = tripDoc.data();
        let tripModified = false;
        
        // Check each date in the trip
        if (tripData.activities) {
          Object.keys(tripData.activities).forEach(date => {
            const activities = tripData.activities[date] || [];
            const originalLength = activities.length;
            
            // Filter out the activity with the matching pinId
            tripData.activities[date] = activities.filter((activity: any) => activity.id !== pinId);
            
            if (tripData.activities[date].length !== originalLength) {
              tripModified = true;
            }
          });
          
          // If trip was modified, add to batch updates
          if (tripModified) {
            tripUpdates.push(
              firestore!.collection("trips").doc(tripDoc.id).update({
                activities: tripData.activities,
                updatedAt: new Date().toISOString()
              })
            );
          }
        }
      });
      
      // Execute all trip updates
      if (tripUpdates.length > 0) {
        await Promise.all(tripUpdates);
      }

      res.status(200).json({
        success: true,
        message: "Pin removed from folder and all trips successfully.",
        tripsUpdated: tripUpdates.length
      });
    } catch (error) {
      console.error("Failed to remove pin from everywhere:", error);
      res.status(500).json({ error: "Server error while removing pin from everywhere." });
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