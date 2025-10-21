import { useEffect, useState } from "react";
import "./LocationPicker.css";
import axios from "axios";
import { z } from "zod";

export const LocationSchema = z.object({
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
});
const LocationArraySchema = z.array(LocationSchema);
export type Location = z.infer<typeof LocationSchema>;

type LocationPickerProps = {
  value: Location | null;
  onChange: (value: Location) => void;
};

export default function LocationPicker({
  value,
  onChange,
}: LocationPickerProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [filtered, setFiltered] = useState<Location[]>([]);
  const [inputText, setInputText] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    async function fetchLocations() {
      try {
        const res = await axios.get("http://localhost:3001/activityLocations");
        const parsed = LocationArraySchema.safeParse(res.data.data);

        if (parsed.success) {
          setLocations(parsed.data);
        } else {
          console.error("Invalid location data format", parsed.error);
        }
      } catch (err) {
        console.error("Failed to fetch locations", err);
      }
    }

    fetchLocations();
  }, []);

  // Update inputText when value prop changes from parent
  useEffect(() => {
    if (value) {
      setInputText(value.name);
    }
  }, [value]);

  useEffect(() => {
    const matches = locations.filter((loc) =>
      loc.name.toLowerCase().includes(inputText.toLowerCase())
    );
    setFiltered(matches);
    setSelectedIndex(-1); // Reset selection when filtering changes
  }, [inputText, locations]);

  function handleSelect(location: Location) {
    onChange(location);
    setInputText(location.name);
    setIsFocused(false);
    setSelectedIndex(-1);
  }
  /* keyboard shortcut: use arrow keys to navigate the dropdown list, enter to select, escape to close */
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isFocused || filtered.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filtered.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filtered.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filtered.length) {
          handleSelect(filtered[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsFocused(false);
        setSelectedIndex(-1);
        break;
    }
  }

  return (
    <div className="location-picker">
      <input
        id="destination-picker"
        type="text"
        placeholder="e.g. San Francisco"
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 100)}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={isFocused && filtered.length > 0}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        aria-activedescendant={selectedIndex >= 0 ? `location-option-${selectedIndex}` : undefined}
        aria-label="Search and select destination location"
        aria-describedby="location-instructions location-status"
      />
      
      {/* Screen reader instructions */}
      <div id="location-instructions" className="sr-only">
        Type to search for destinations. Use arrow keys to navigate options, Enter to select, Escape to close.
      </div>
      
      {/* Live region for screen reader announcements */}
      <div 
        id="location-status" 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
      >
        {isFocused && filtered.length > 0 && selectedIndex >= 0 && (
          `${filtered[selectedIndex].name}, option ${selectedIndex + 1} of ${filtered.length}`
        )}
        {isFocused && filtered.length > 0 && selectedIndex < 0 && (
          `${filtered.length} destination${filtered.length === 1 ? '' : 's'} found`
        )}
        {isFocused && inputText && filtered.length === 0 && (
          "No destinations found"
        )}
        {value && !isFocused && (
          `Selected destination: ${value.name}`
        )}
      </div>

      {isFocused && filtered.length > 0 && (
        <ul 
          className="dropdown" 
          role="listbox"
          aria-label="Available destinations"
        >
          {filtered.map((loc, idx) => (
            <li 
              key={idx} 
              id={`location-option-${idx}`}
              role="option"
              aria-selected={idx === selectedIndex}
              aria-label={`${loc.name}, destination option ${idx + 1} of ${filtered.length}`}
              className={idx === selectedIndex ? "selected" : ""}
              onMouseDown={() => handleSelect(loc)}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              {loc.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
