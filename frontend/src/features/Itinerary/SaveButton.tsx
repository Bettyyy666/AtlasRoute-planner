import { useState, useEffect } from "react";
import axios from "axios";
import {
  onAuthStateChanged,
  User,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "../../firebase/firebaseConfig";
import { toast } from "react-toastify";
import { ActivitiesByDate } from "./ItineraryPanel";

type Location = {
  name: string;
  lat: number;
  lng: number;
};

interface SaveTripButtonProps {
  destination: Location;
  startDate: Date;
  endDate: Date;
  activities: ActivitiesByDate;
  currentTripId: string | null;
  onTripSaved: (tripId: string) => void;
}

export default function SaveTripButton({
  destination,
  startDate,
  endDate,
  activities,
  currentTripId,
  onTripSaved,
}: SaveTripButtonProps) {
  const [user, setUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return unsubscribe;
  }, []);

  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success("Signed in successfully!");
    } catch (error) {
      console.error("Sign-in error:", error);
      toast.error("Failed to sign in. Please try again.");
    }
  };

  const saveTrip = async () => {
    if (!user) {
      toast.error("Please sign in to save your trip.");
      return;
    }

    // Validate that there are activities to save
    const totalActivities = Object.values(activities).flat().length;
    if (totalActivities === 0) {
      toast.warning("Add some activities to your itinerary before saving!");
      return;
    }

    setSaving(true);

    try {
      const idToken = await user.getIdToken();

      // Prepare trip data matching backend schema
      const tripData = {
        userId: user.uid,
        title: `Trip to ${destination.name}`,
        destination: {
          name: destination.name,
          lat: destination.lat,
          lng: destination.lng,
        },
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        activities: activities,
      };

      console.log("Saving trip with data:", tripData);
      console.log("Activities object:", activities);
      console.log("Number of date keys:", Object.keys(activities).length);

      const response = await axios.post(
        "http://localhost:3001/savePins",
        tripData,
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

      if (response.data.success) {
        const message = response.data.isUpdate
          ? "✅ Trip updated successfully!"
          : "✅ Trip saved successfully!";
        toast.success(message);
        console.log(
          response.data.isUpdate ? "Trip updated with ID:" : "Trip saved with ID:",
          response.data.tripId
        );
        onTripSaved(response.data.tripId);
      } else {
        toast.error("Failed to save trip.");
      }
    } catch (error: any) {
      console.error("Error saving trip:", error);

      if (error.response?.status === 400) {
        toast.error(`Validation error: ${error.response.data.error}`);
      } else if (error.response?.status === 500) {
        toast.error("Server error. Please try again later.");
      } else {
        toast.error("Failed to save trip. Please check your connection.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <button
        onClick={handleSignIn}
        className="bg-gray-400 text-white rounded px-4 py-2 cursor-pointer hover:bg-gray-500"
        aria-label="Sign in with Google to save trip"
      >
        Sign in to Save
      </button>
    );
  }

  return (
    <button
      onClick={saveTrip}
      disabled={saving}
      className={`bg-blue-500 text-white rounded px-4 py-2 ${
        saving ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-600"
      }`}
      aria-label={currentTripId ? "Update current trip in cloud storage" : "Save current itinerary to cloud storage"}
    >
      {saving ? (currentTripId ? "Updating..." : "Saving...") : (currentTripId ? "Update Trip" : "Save Trip")}
    </button>
  );
}
