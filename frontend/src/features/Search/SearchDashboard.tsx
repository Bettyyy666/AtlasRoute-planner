import React, { useState } from "react";
import SearchBar from "./SearchBar";
import SearchResults, { SearchResultItem } from "./SearchResults";
import FilterPanel from "../Filters/FilterPanel";
import "./SearchDashboard.css";
import { DatedActivity } from "../Itinerary/ItineraryPanel";
import axios from "axios";

const mockResults: SearchResultItem[] = [
  {
    id: "1",
    name: "Golden Gate",
    description: "Lorem ipsum dolor sit amet...",
    duration: 90,
    lat: 37.8199,
    lng: -122.4783,
  },
  {
    id: "2",
    name: "Alcatraz Island",
    description: "Ut enim ad minim veniam...",
    duration: 120,
    lat: 37.8267,
    lng: -122.423,
  },
  {
    id: "3",
    name: "Pier 39",
    description: "Excepteur sint occaecat cupidatat...",
    duration: 60,
    lat: 37.8087,
    lng: -122.4098,
  },
];

interface SearchDashboardProps {
  activities: DatedActivity[];
  setActivities: (items: DatedActivity[]) => void;
  date: string;
}

const SearchDashboard: React.FC<SearchDashboardProps> = ({
  activities,
  setActivities,
  date,
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [filters, setFilters] = useState<Record<string, any>>({});

  const handleSearch = async (q: string) => {
    setQuery(q);
    let updatedFilters = filters;
    if (q) {
      updatedFilters = {
        ...filters,
        name: {
          operator: "contains",
          value: q,
        },
      };

      setFilters(updatedFilters);
    }

    try {
      const res = await axios.post("http://localhost:3001/filter", {
        filters: updatedFilters,
      });

      if (res.status !== 200) {
        console.error("Invalid location data format", res.status);
        return;
      }

      setResults(res.data.data);
    } catch (err) {
      console.error("Search failed:", err);
    }
  };

  const handleSelect = (item: SearchResultItem) => {
    const alreadyExists = activities.some(
      (a) => a.id === item.id && a.date === date
    );
    if (!alreadyExists) {
      const newActivity: DatedActivity = {
        ...item,
        date,
      };
      setActivities([...activities, newActivity]);
    }
  };

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <div className={`search-dashboard ${isFocused ? "expanded" : ""}`}>
        <SearchBar
          onSearch={handleSearch}
          onFocus={() => {
            if (!results.length) {
              handleSearch("");
            }
            setIsFocused(true);
          }}
          onBlur={() => setIsFocused(false)}
          expanded={isFocused}
        />
        {isFocused && <FilterPanel filters={filters} setFilters={setFilters} />}
      </div>

      {isFocused && <SearchResults results={results} onSelect={handleSelect} />}
    </div>
  );
};

export default SearchDashboard;
