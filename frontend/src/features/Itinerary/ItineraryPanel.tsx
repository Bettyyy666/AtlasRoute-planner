import React, { useEffect, useState } from "react";
import ActivityCard from "./ActivityCard";
import Button from "../../components/Button/Button";
import { SearchResultItem } from "../Search/SearchResults";
import "./ItineraryPanel.css";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import SaveTripButton from "./SaveButton";
import LoadTripsDropdown from "./LoadTripsDropdown";
import BestRouteButton from "./BestRouteButton";
export type DatedActivity = SearchResultItem & { date: string };
export type ActivitiesByDate = Record<string, DatedActivity[]>;
type HighlightMode = "none" | "weather" | "redlining";

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

type ItineraryPanelProps = {
  arrivalDate: Date;
  departureDate: Date;
  activitiesByDate: ActivitiesByDate;
  onRemoveActivity: (date: string, id: string) => void;
  onDateChange: (date: string) => void;
  onReorderActivities: (date: string, reordered: DatedActivity[]) => void;
  currentDate: string;
  highlightMode: HighlightMode;
  onHighlightModeChange: (mode: HighlightMode) => void;
  destination: Location;
  userId: string | null;
  currentTripId: string | null;
  onLoadTrip: (trip: SavedTrip) => void;
  onTripSaved: (tripId: string) => void;
  distanceMetric: "euclidean" | "haversine";
  onDistanceMetricChange: (metric: "euclidean" | "haversine") => void;
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
  });
}

function getDateRange(start: Date, end: Date): Date[] {
  const dates = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function SortableActivityCard({
  activity,
  onRemove,
}: {
  activity: DatedActivity;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: activity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    marginBottom: "0.5rem",
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ActivityCard
        name={activity.name}
        onRemove={() => onRemove(activity.id)}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

const ItineraryPanel: React.FC<ItineraryPanelProps> = ({
  arrivalDate,
  departureDate,
  activitiesByDate,
  onRemoveActivity,
  onDateChange,
  onReorderActivities,
  currentDate,
  highlightMode,
  onHighlightModeChange,
  destination,
  userId,
  currentTripId,
  onLoadTrip,
  onTripSaved,
  distanceMetric,
  onDistanceMetricChange,
}) => {
  const dateRange = getDateRange(arrivalDate, departureDate);
  const currentActivities = activitiesByDate[currentDate] || [];

  // Screen reader support for highlight dropdown
  const [highlightFocused, setHighlightFocused] = useState(false);
  const [selectedHighlightIndex, setSelectedHighlightIndex] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  /**
   * Toggles between Euclidean and Haversine distance metrics for pathfinding.
   * Default is Euclidean distance (fast, good for local trips).
   * Haversine distance accounts for Earth's curvature (more accurate for longer distances).
   */
  const handleBestRoute = () => {
    if (currentActivities.length < 2) {
      console.log("Add at least 2 activities to see the route");
      return;
    }

    // Toggle between euclidean and haversine distance metrics
    const newMetric = distanceMetric === "euclidean" ? "haversine" : "euclidean";
    onDistanceMetricChange(newMetric);

    console.log(
      `Distance metric switched to: ${newMetric === "euclidean"
        ? "Euclidean (faster, good for local trips)"
        : "Haversine (more accurate for longer distances)"}`
    );
  };

  // Highlight options array for screen reader announcements
  const highlightOptions = [
    { value: "none", label: "None" },
    { value: "weather", label: "Weather" },
    { value: "redlining", label: "Red Lining" },
  ];

  const sensors = useSensors(useSensor(PointerSensor));

  // Keyboard shortcuts for highlight dropdown and buttons
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "1":
            e.preventDefault();
            onHighlightModeChange("none");
            break;
          case "2":
            e.preventDefault();
            onHighlightModeChange("weather");
            break;
          case "3":
            e.preventDefault();
            onHighlightModeChange("redlining");
            break;
          case "b":
          case "B":
            e.preventDefault();
            // Trigger Best Route button click
            handleBestRoute();
            break;
          case "s":
          case "S":
            e.preventDefault();
            // Trigger Save Trip button click - we'll need to call the save function
            // For now, we'll simulate the button click
            const saveButton = document.querySelector(
              ".bg-blue-500"
            ) as HTMLButtonElement;
            if (saveButton) {
              saveButton.click();
            }
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onHighlightModeChange, handleBestRoute]);

  // Update selected highlight index when highlightMode changes
  useEffect(() => {
    const index = highlightOptions.findIndex(
      (option) => option.value === highlightMode
    );
    setSelectedHighlightIndex(index >= 0 ? index : 0);
  }, [highlightMode, highlightOptions]);

  // Update announcement for screen reader
  useEffect(() => {
    if (highlightFocused && selectedHighlightIndex >= 0) {
      setAnnouncement(
        `${highlightOptions[selectedHighlightIndex].label}, option ${
          selectedHighlightIndex + 1
        } of ${highlightOptions.length} - Press Enter to select`
      );
    } else if (!highlightFocused && selectedHighlightIndex >= 0) {
      setAnnouncement(
        `${highlightOptions[selectedHighlightIndex].label} selected`
      );
    } else {
      setAnnouncement("");
    }
  }, [highlightFocused, selectedHighlightIndex, highlightOptions]);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = currentActivities.findIndex((a) => a.id === active.id);
    const newIndex = currentActivities.findIndex((a) => a.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(currentActivities, oldIndex, newIndex);
      onReorderActivities(currentDate, reordered);
    }
  };

  return (
    <aside className="itinerary-panel">
      <h2>Itinerary</h2>
      <hr />
      <LoadTripsDropdown
        userId={userId}
        destinationName={destination.name}
        onLoadTrip={onLoadTrip}
      />
      <hr />
      <div className="itinerary-dates">
        {dateRange.map((date) => {
          const label = formatDate(date);
          return (
            <button
              key={label}
              className={`date-pill ${label === currentDate ? "selected" : ""}`}
              onClick={() => onDateChange(label)}
              tabIndex={0}
              // broad shortcut
            >
              {label}
            </button>
          );
        })}
      </div>

      <hr />
      <div className="highlight-dropdown">
        <label htmlFor="highlight-select">Highlight:</label>

        {/* Live region for screen reader announcements */}
        <div
          id="highlight-status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {announcement}
        </div>

        <select
          id="highlight-select"
          value={highlightMode}
          onChange={(e) =>
            onHighlightModeChange(e.target.value as HighlightMode)
          }
          onFocus={() => setHighlightFocused(true)}
          onBlur={() => setHighlightFocused(false)}
          disabled={document.body.classList.contains("simple-mode")}
        >
          <option value="none">None</option>
          <option value="weather">Weather</option>
          <option value="redlining">Red Lining</option>
        </select>
        {document.body.classList.contains("simple-mode") && (
          <small
            style={{ display: "block", marginTop: "0.5rem", color: "#7f8c8d" }}
          >
            Overlays disabled in Simple Mode
          </small>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={currentActivities.map((a) => a.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="activity-list">
            {currentActivities.map((activity) => (
              <SortableActivityCard
                key={activity.id}
                activity={activity}
                onRemove={(id) => onRemoveActivity(currentDate, id)}
              />
            ))}
            {currentActivities.length !== 0 && <hr />}
          </div>
        </SortableContext>
      </DndContext>

      <div className="itinerary-buttons">
        <BestRouteButton
          onClick={handleBestRoute}
          tabIndex={0}
          aria-label={`Toggle distance metric (currently ${distanceMetric}) - Press Enter to switch`}
        >
          {distanceMetric === "euclidean" ? "Route: Euclidean" : "Route: Haversine"}
        </BestRouteButton>
        <SaveTripButton
          destination={destination}
          startDate={arrivalDate}
          endDate={departureDate}
          activities={activitiesByDate}
          currentTripId={currentTripId}
          onTripSaved={onTripSaved}
        />
      </div>
    </aside>
  );
};

export default ItineraryPanel;
