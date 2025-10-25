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
import PinFolderPanel from "../features/PinFolder/PinFolderPanel";
import PinFolderButton from "../features/PinFolder/PinFolderButton";
import { Pin } from "../types/pinTypes";
import PinFolderService from "../features/PinFolder/PinFolderService";

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
  
  // Pin folder state
  const [pins, setPins] = useState<Pin[]>([]);
  const [isPinFolderVisible, setIsPinFolderVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      
      // Load pins when user is authenticated
      if (firebaseUser) {
        loadUserPins(firebaseUser.uid);
      } else {
        setPins([]);
      }
    });
    return unsubscribe;
  }, []);
  
  // Load user pins from the backend
  const loadUserPins = async (userId: string) => {
    try {
      const userPins = await PinFolderService.getUserPins(userId);
      setPins(userPins);
    } catch (error) {
      console.error("Error loading pins:", error);
      toast.error("Failed to load pins");
    }
  };

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

  const handleTripSaved = async (tripId: string) => {
    setCurrentTripId(tripId);
    
    // Refresh pins after saving/updating a trip
    if (user) {
      try {
        // First sync pins from trips to ensure backend is updated
        await PinFolderService.syncPinsFromTrips(user.uid);
        
        // Then reload pins to update the UI
        const userPins = await PinFolderService.getUserPins(user.uid);
        setPins(userPins);
        
        console.log("Pin folder refreshed after trip update");
      } catch (error) {
        console.error("Error refreshing pins after trip update:", error);
      }
    }
  };

  // Pin folder handlers
  const handleAddPinToItinerary = async (pin: Pin) => {
    if (!user) {
      toast.error("Please sign in to add pins to your itinerary");
      return;
    }

    try {
      const pinWithDate = await PinFolderService.addPinToItinerary(pin.id, currentDate);
      
      if (pinWithDate) {
        // Convert Pin to DatedActivity
        const activity: DatedActivity = {
          id: pin.id,
          name: pin.name,
          description: pin.description,
          duration: pin.duration,
          lat: pin.lat,
          lng: pin.lng,
          date: currentDate
        };
        
        handleSetActivities(activity);
        toast.success(`Added ${pin.name} to your itinerary`);
      }
    } catch (error) {
      console.error("Error adding pin to itinerary:", error);
      toast.error("Failed to add pin to itinerary");
    }
  };

  const handleRemovePin = async (pinId: string) => {
    if (!user) {
      toast.error("Please sign in to manage pins");
      return;
    }

    try {
      const success = await PinFolderService.removePinFromEverywhere(user.uid, pinId);
      if (success) {
        // Update pins state
        setPins(pins.filter(pin => pin.id !== pinId));
        
        // Also remove from current activities if present
        const updatedActivitiesByDate = { ...activitiesByDate };
        let activityRemoved = false;
        
        // Check each date for the activity to remove
        Object.keys(updatedActivitiesByDate).forEach(date => {
          const originalLength = updatedActivitiesByDate[date].length;
          updatedActivitiesByDate[date] = updatedActivitiesByDate[date].filter(
            activity => activity.id !== pinId
          );
          
          if (updatedActivitiesByDate[date].length !== originalLength) {
            activityRemoved = true;
          }
        });
        
        // Update activities state if any were removed
        if (activityRemoved) {
          setActivitiesByDate(updatedActivitiesByDate);
        }
        
        toast.success("Pin removed from your folder and all trips");
      }
    } catch (error) {
      console.error("Error removing pin:", error);
      toast.error("Failed to remove pin");
    }
  };

  const togglePinFolder = () => {
    setIsPinFolderVisible(!isPinFolderVisible);
  };

  const allActivities = Object.values(activitiesByDate).flat();
  const currentActivities = activitiesByDate[currentDate] || [];

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
        {/* Pin Folder Components */}
      <div className="pin-folder-container">
      <PinFolderPanel
        pins={pins}
        isVisible={isPinFolderVisible}
        onClose={togglePinFolder}
        onAddToItinerary={handleAddPinToItinerary}
        onRemovePin={handleRemovePin}
        currentActivities={currentActivities}
      />
      <PinFolderButton onClick={togglePinFolder} pinCount={pins.length} />
      </div>
      </div>
    </section>
  );
};
