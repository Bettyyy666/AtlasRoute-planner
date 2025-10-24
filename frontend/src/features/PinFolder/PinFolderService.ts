import axios from "axios";
import { Pin, PinFolder } from "../../types/pinTypes";
import { auth } from "../../firebase/firebaseConfig";
import { v4 as uuidv4 } from 'uuid';

const API_BASE_URL = "http://localhost:3001";

// Define SavedTrip type based on the structure from the backend
type Location = {
  name: string;
  lat: number;
  lng: number;
};

type Activity = {
  id: string;
  name: string;
  duration: number;
  lat: number;
  lng: number;
  description?: string;
  date: string;
};

type ActivitiesByDate = Record<string, Activity[]>;

type SavedTrip = {
  id: string;
  userId: string;
  title: string;
  destination: Location;
  startDate: string;
  endDate: string;
  activities: ActivitiesByDate;
  createdAt: string;
  updatedAt: string;
};

export const PinFolderService = {
  /**
   * Get all pins for a user
   */
  getUserPins: async (userId: string): Promise<Pin[]> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/pins/${userId}`);
      return response.data.pins || [];
    } catch (error) {
      console.error("Error fetching user pins:", error);
      return [];
    }
  },
  
  /**
   * Get all saved trips for a user
   */
  getUserTrips: async (userId: string): Promise<SavedTrip[]> => {
    try {
      // Get the current user's ID token for authentication
      const token = await auth.currentUser?.getIdToken();
      
      const response = await axios.get(
        `${API_BASE_URL}/trips/${userId}`,
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        }
      );

      if (response.data.success) {
        return response.data.trips || [];
      } else {
        console.error("Failed to load trips:", response.data.error);
        return [];
      }
    } catch (error) {
      console.error("Error fetching user trips:", error);
      return [];
    }
  },
  
  /**
   * Sync pins from all saved trips to the user's pin folder
   * This ensures that all pins in saved trips are also in the pin folder
   * Uses the backend endpoint for efficient syncing
   */
  syncPinsFromTrips: async (userId: string): Promise<boolean> => {
    try {
      // Get the current user's ID token for authentication
      const token = await auth.currentUser?.getIdToken();
      
      // Call the backend endpoint to sync pins
      const response = await axios.post(
        `${API_BASE_URL}/pins/sync/${userId}`,
        {},
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        }
      );
      
      if (response.data.success) {
        console.log(`Synced pins from trips to pin folder: ${response.data.message}`);
        return true;
      } else {
        console.error("Failed to sync pins:", response.data.error);
        return false;
      }
    } catch (error) {
      console.error("Error syncing pins from trips:", error);
      return false;
    }
  },
  
  /**
   * Check if a pin is already saved in any of the user's saved trips
   * by comparing name and coordinates
   */
  isPinSaved: async (userId: string, pinName: string, lat: number, lng: number): Promise<boolean> => {
    try {
      // Get all saved trips for the user
      const trips = await PinFolderService.getUserTrips(userId);
      
      // Check if the pin exists in any of the saved trips
      for (const trip of trips) {
        // Iterate through all activities in all dates
        for (const dateKey in trip.activities) {
          const activitiesForDate = trip.activities[dateKey];
          
          // Check if any activity matches the pin
          const pinExists = activitiesForDate.some(activity => 
            activity.name === pinName && 
            Math.abs(activity.lat - lat) < 0.0001 && 
            Math.abs(activity.lng - lng) < 0.0001
          );
          
          if (pinExists) {
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error("Error checking if pin is saved:", error);
      return false;
    }
  },

  /**
   * Add a pin to a user's folder
   */
  addPin: async (userId: string, pin: Omit<Pin, "id" | "addedAt">): Promise<boolean> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/pins`, {
        userId,
        name: pin.name,
        description: pin.description,
        duration: pin.duration,
        lat: pin.lat,
        lng: pin.lng,
        addedAt: new Date().toISOString()
      });
      return response.data.success;
    } catch (error) {
      console.error("Error adding pin:", error);
      return false;
    }
  },

  /**
   * Remove a pin from the user's folder
   */
  removePin: async (userId: string, pinId: string): Promise<boolean> => {
    try {
      await axios.delete(`${API_BASE_URL}/pins/${userId}/${pinId}`);
      return true;
    } catch (error) {
      console.error("Error removing pin:", error);
      return false;
    }
  },

  /**
   * Add a pin to the current itinerary
   */
  addPinToItinerary: async (pinId: string, date: string): Promise<Pin | null> => {
    try {
      const response = await axios.put(`${API_BASE_URL}/pins/${pinId}/addToItinerary`, { date });
      return response.data.pin;
    } catch (error) {
      console.error("Error adding pin to itinerary:", error);
      return null;
    }
  },
};

export default PinFolderService;