import React from "react";
import { Pin } from "../../types/pinTypes";
import PinCard from "./PinCard";
import "./PinFolder.css";
import { DatedActivity } from "../Itinerary/ItineraryPanel";

interface PinFolderPanelProps {
  pins: Pin[];
  isVisible: boolean;
  onClose: () => void;
  onAddToItinerary: (pin: Pin) => void;
  onRemovePin: (pinId: string) => void;
  currentActivities: DatedActivity[];
}

const PinFolderPanel: React.FC<PinFolderPanelProps> = ({
  pins,
  isVisible,
  onClose,
  onAddToItinerary,
  onRemovePin,
  currentActivities,
}) => {
  // Check if a pin is in the current day's itinerary
  const isPinInCurrentItinerary = (pinId: string): boolean => {
    return currentActivities.some((activity) => activity.id === pinId);
  };

  return (
    <aside className={`pin-folder-panel ${isVisible ? "visible" : ""}`}>
      <h2>
        Pin Folder
        <button
          className="close-btn"
          onClick={onClose}
          aria-label="Close pin folder"
        >
          ×
        </button>
      </h2>
      <p>Manage your collection of pins across all itineraries.</p>
      <hr />
      <div className="pin-list">
        {pins.length === 0 ? (
          <div className="empty-folder-message">
            <p>Your pin folder is empty.</p>
            <p>Add pins from search results to get started.</p>
          </div>
        ) : (
          pins.map((pin) => (
            <PinCard
              key={pin.id}
              pin={pin}
              onAddToItinerary={onAddToItinerary}
              onRemove={onRemovePin}
              isInCurrentItinerary={isPinInCurrentItinerary(pin.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
};

export default PinFolderPanel;