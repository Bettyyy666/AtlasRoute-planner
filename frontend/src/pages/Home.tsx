import axios from "axios";
import { useRef, useState } from "react";
import DatePicker from "../components/DatePicker/DatePicker";
import LocationPicker from "../components/LocationPicker/LocationPicker";
import { Location } from "../components/LocationPicker/LocationPicker";
import DataQueryPanel from "../features/DataQuery/DataQueryPanel";
import DataQueryResult from "../features/DataQuery/DataQueryResult";
import "./Home.css";
import { Planner } from "./Planner";

interface QueryResult {
  headers: string[];
  rows: any[][];
}

export default function Home() {
  const [arrivalDate, setArrivalDate] = useState<Date | null>(null);
  const [departureDate, setDepartureDate] = useState<Date | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [showPlanner, setShowPlanner] = useState(false);
  const plannerRef = useRef<HTMLDivElement | null>(null);
  const dataQueryRef = useRef<HTMLDivElement | null>(null);
  
  // Data query state
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  const handleExploreClick = () => {
    if (location && arrivalDate && departureDate) {
      //call the csv api for activities and also the weather api
      setShowPlanner(true);
      setTimeout(() => {
        plannerRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else {
      alert("Please complete all fields first.");
    }
  };

  const handleCSVLoad = async () => {
    const res = await axios.post("http://localhost:3001/upload-csv");

    if (res.status) {
      console.log("Invalid location data format", res.status);
    }
  };

  return (
    <main className="home-container">
      <section className="hero-section">
        <div className="hero-content">
          <h1>Let's Discover the World Together</h1>
          <p>
            Find the best trips and experiences, tailored to your perfect days.
          </p>

          <section className="search-card" aria-labelledby="trip-planning-heading">
            <h2 id="trip-planning-heading" className="sr-only">Plan Your Trip</h2>
            <div className="input-wrapper">
              <label htmlFor="destination-picker">Destination</label>
              <LocationPicker
                value={location}
                onChange={(value) => {
                  setLocation(value);
                  handleCSVLoad();
                }}
              />
            </div>
            <div className="input-wrapper">
              <DatePicker
                label="Arrival"
                selectedDate={arrivalDate}
                onChange={setArrivalDate}
              />
            </div>
            <div className="input-wrapper">
              <DatePicker
                label="Departure"
                selectedDate={departureDate}
                onChange={setDepartureDate}
              />
            </div>
            <button 
            // keyboard
              className="explore-btn" 
              onClick={handleExploreClick}
              tabIndex={0}
              aria-label="Explore destinations - Press Enter to activate"
            >
              Explore
            </button>
          </section>
          
          <div ref={dataQueryRef} className="data-query-section">
            <DataQueryPanel 
              location={location}
              onQueryResult={setQueryResult}
              onLoading={setQueryLoading}
              onError={setQueryError}
            />
          </div>
        </div>

        {queryResult || queryLoading || queryError ? (
          <div className="results-panel">
            <DataQueryResult 
              queryResult={queryResult}
              loading={queryLoading}
              error={queryError}
            />
          </div>
        ) : (
          <div className="canvas-wrapper">
            <div className="overlay" />
            {/* Maybe 3d model goes here if i have time - Roberto*/}
          </div>
        )}
      </section>

      {showPlanner && (
        <section ref={plannerRef}>
          <Planner
            arrivalDate={arrivalDate!}
            departureDate={departureDate!}
            location={location || { name: "", lat: 0, lng: 0 }}
          />
        </section>
      )}
    </main>
  );
}
