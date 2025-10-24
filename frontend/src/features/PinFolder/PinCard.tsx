import React from "react";
import { Pin } from "../../types/pinTypes";
import "./PinFolder.css";

interface PinCardProps {
  pin: Pin;
  onAddToItinerary: (pin: Pin) => void;
  onRemove: (pinId: string) => void;
  isInCurrentItinerary: boolean;
}

const PinCard: React.FC<PinCardProps> = ({
  pin,
  onAddToItinerary,
  onRemove,
  isInCurrentItinerary,
}) => {
  return (
    <div className={`pin-card ${isInCurrentItinerary ? "in-itinerary" : ""}`}>
      <div className="pin-card-content">
        <h3 className="pin-name">{pin.name}</h3>
        <p className="pin-description">{pin.description}</p>
        <div className="pin-details">
          <span className="pin-duration">{pin.duration} min</span>
        </div>
      </div>
      <div className="pin-card-actions">
        {!isInCurrentItinerary && (
          <button
            className="pin-action-btn add-btn"
            onClick={() => onAddToItinerary(pin)}
            aria-label={`Add ${pin.name} to current day's itinerary`}
          >
            Add to Day
          </button>
        )}
        <button
          className="pin-action-btn remove-btn"
          onClick={() => onRemove(pin.id)}
          aria-label={`Remove ${pin.name} from pin folder`}
        >
          Remove
        </button>
      </div>
    </div>
  );
};

export default PinCard;