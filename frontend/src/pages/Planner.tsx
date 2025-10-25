import { useState, useEffect } from "react";
import FilterPanel from "../features/Filters/FilterPanel";
import ItineraryPanel, {
  DatedActivity,
  ActivitiesByDate,
} from "../features/Itinerary/ItineraryPanel";
import MapView from "../features/Map/MapView";
import SearchDashboard from "../features/Search/SearchDashboard";
import { Location } from "../components/LocationPicker/LocationPicker";
import { useSimpleMode } from "../contexts/SimpleModeContext";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import { toast } from "react-toastify";
import "./Planner.css";

interface PlannerProps {
  arrivalDate: Date;
  departureDate: Date;
  location: Location;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
  });
}

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

export const Planner: React.FC<PlannerProps> = ({
  arrivalDate: initialArrivalDate,
  departureDate: initialDepartureDate,
  location,
}) => {
  const { isSimpleMode } = useSimpleMode();
  const [user, setUser] = useState<User | null>(null);
  const [currentTripId, setCurrentTripId] = useState<string | null>(null);
  const [arrivalDate, setArrivalDate] = useState(initialArrivalDate);
  const [departureDate, setDepartureDate] = useState(initialDepartureDate);
  const [activitiesByDate, setActivitiesByDate] = useState<ActivitiesByDate>(
    {}
  );
  const [currentDate, setCurrentDate] = useState<string>(
    formatDate(arrivalDate)
  );
  const [highlightMode, setHighlightMode] = useState<
    "none" | "weather" | "redlining"
  >(isSimpleMode ? "none" : "none");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return unsubscribe;
  }, []);

  const handleRemoveActivity = (date: string, id: string) => {
    console.log("remove");
    setActivitiesByDate((prev) => {
      const updated = [...(prev[date] || [])].filter((a) => a.id !== id);
      return { ...prev, [date]: updated };
    });
  };

  const handleReorderActivities = (
    date: string,
    reordered: DatedActivity[]
  ) => {
    setActivitiesByDate((prev) => ({ ...prev, [date]: reordered }));
  };

  const handleSetActivities = (newActivity: DatedActivity) => {
    setActivitiesByDate((prev) => {
      const current = prev[newActivity.date] || [];

      const alreadyExists = current.some((a) => a.id === newActivity.id);
      if (alreadyExists) return prev;

      return {
        ...prev,
        [newActivity.date]: [...current, newActivity],
      };
    });
  };

  const handleLoadTrip = (trip: SavedTrip) => {
    // Replace current itinerary with loaded trip
    setActivitiesByDate(trip.activities);
    setArrivalDate(new Date(trip.startDate));
    setDepartureDate(new Date(trip.endDate));
    setCurrentTripId(trip.id);

    // Set current date to the first day of the loaded trip
    const firstDate = formatDate(new Date(trip.startDate));
    setCurrentDate(firstDate);
  };

  const handleTripSaved = (tripId: string) => {
    setCurrentTripId(tripId);
  };

  const allActivities = Object.values(activitiesByDate).flat();

  return (
    <section id="planner" className="planner-container">
        <ItineraryPanel
          arrivalDate={arrivalDate}
          departureDate={departureDate}
          activitiesByDate={activitiesByDate}
          onRemoveActivity={handleRemoveActivity}
          onReorderActivities={handleReorderActivities}
          onDateChange={setCurrentDate}
          currentDate={currentDate}
          highlightMode={highlightMode}
          onHighlightModeChange={setHighlightMode}
          destination={location}
          userId={user?.uid || null}
          currentTripId={currentTripId}
          onLoadTrip={handleLoadTrip}
          onTripSaved={handleTripSaved}
        />

      <div className="planner-map">
        <div className="map-search-bar">
          <SearchDashboard
            activities={allActivities}
            setActivities={(items) =>
              items.forEach((item) => handleSetActivities(item))
            }
            date={currentDate}
          />
        </div>
        <div className="map-container">
        <MapView
          markers={activitiesByDate[currentDate] || []}
          lat={location.lat}
          lng={location.lng}
          highlightMode={highlightMode}
        />
        </div>
      </div>
    </section>
  );
};
