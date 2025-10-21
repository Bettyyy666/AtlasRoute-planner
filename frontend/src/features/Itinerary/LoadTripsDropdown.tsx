import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { ActivitiesByDate } from "./ItineraryPanel";

type Location = {
  name: string;
  lat: number;
  lng: number;
};

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

interface LoadTripsDropdownProps {
  userId: string | null;
  destinationName: string;
  onLoadTrip: (trip: SavedTrip) => void;
}

export default function LoadTripsDropdown({
  userId,
  destinationName,
  onLoadTrip,
}: LoadTripsDropdownProps) {
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId && destinationName) {
      fetchTrips();
    }
  }, [userId, destinationName]);

  const fetchTrips = async () => {
    if (!userId) {
      setTrips([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `http://localhost:3001/trips/${userId}`,
        {
          params: { destination: destinationName },
        }
      );

      if (response.data.success) {
        setTrips(response.data.trips);
      } else {
        setError("Failed to load trips");
      }
    } catch (err: any) {
      console.error("Error fetching trips:", err);
      setError("Failed to load trips");
      toast.error("Failed to load saved trips");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tripId = e.target.value;
    if (!tripId) return;

    const selectedTrip = trips.find((t) => t.id === tripId);
    if (selectedTrip) {
      onLoadTrip(selectedTrip);
      toast.success(`Loaded: ${selectedTrip.title}`);
      // Reset dropdown
      e.target.value = "";
    }
  };

  const getActivityCount = (trip: SavedTrip) => {
    if (!trip.activities || typeof trip.activities !== 'object') {
      return 0;
    }
    return Object.values(trip.activities).flat().length;
  };

  const formatDateRange = (trip: SavedTrip) => {
    const start = new Date(trip.startDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const end = new Date(trip.endDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return `${start} - ${end}`;
  };

  if (!userId) {
    return null; // Don't show if user not logged in
  }

  return (
    <div className="load-trips-dropdown" style={{ marginBottom: "1rem" }}>
      <label htmlFor="load-trip-select" style={{ display: "block", marginBottom: "0.5rem" }}>
        Load Saved Trip:
      </label>
      <select
        id="load-trip-select"
        onChange={handleSelect}
        disabled={loading || trips.length === 0}
        style={{
          width: "100%",
          padding: "0.5rem",
          borderRadius: "4px",
          border: "1px solid #ccc",
        }}
        aria-label="Select a saved trip to load"
      >
        <option value="">
          {loading
            ? "Loading trips..."
            : trips.length === 0
            ? "No saved trips for this destination"
            : "Select a trip..."}
        </option>
        {trips.map((trip) => (
          <option key={trip.id} value={trip.id}>
            {formatDateRange(trip)} - {getActivityCount(trip)} activities
            {trip.updatedAt !== trip.createdAt ? " (updated)" : ""}
          </option>
        ))}
      </select>
      {error && (
        <p style={{ color: "red", fontSize: "0.875rem", marginTop: "0.25rem" }}>
          {error}
        </p>
      )}
    </div>
  );
}
