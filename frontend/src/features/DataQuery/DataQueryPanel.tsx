import { useState, useEffect } from "react";
import axios from "axios";
import "./DataQueryPanel.css";
import { Location } from "../../components/LocationPicker/LocationPicker";

interface QueryResult {
  headers: string[];
  rows: any[][];
}

interface DataQueryPanelProps {
  location: Location | null;
  onQueryResult: (result: QueryResult | null) => void;
  onLoading: (loading: boolean) => void;
  onError: (error: string | null) => void;
}

type DataSource = "ACS" | "FBI";

export default function DataQueryPanel({ location, onQueryResult, onLoading, onError }: DataQueryPanelProps) {
  const [dataSource, setDataSource] = useState<DataSource>("ACS");
  
  // ACS specific state
  const [acsVariables, setAcsVariables] = useState<string>("NAME,S2802_C03_022E");
  const [acsTopLevel, setAcsTopLevel] = useState<string>("state");
  const [acsBottomLevel, setAcsBottomLevel] = useState<string>("place");
  
  // FBI specific state
  const [fbiGranularity, setFbiGranularity] = useState<string>("national");
  const [fbiYear, setFbiYear] = useState<string>("2024"); // Add year state

  // Screen reader announcements
  const [announcement, setAnnouncement] = useState<string>("");
  const [dataSourceFocused, setDataSourceFocused] = useState<boolean>(false);
  const [selectedDataSourceIndex, setSelectedDataSourceIndex] = useState<number>(0);

  // Data source options for navigation
  const dataSourceOptions = [
    { value: "ACS", label: "ACS (Census)" },
    { value: "FBI", label: "FBI Crime Data" }
  ];

  // Update selected index when dataSource changes, announcement
  useEffect(() => {
    const index = dataSourceOptions.findIndex(option => option.value === dataSource);
    setSelectedDataSourceIndex(index >= 0 ? index : 0);
  }, [dataSource]);

  // Announce dropdown changes for screen readers
  useEffect(() => {
    if (dataSource === "ACS") {
      setAnnouncement(`Data source changed to ACS. Current selections: Top level ${acsTopLevel}, Bottom level ${acsBottomLevel}`);
    } else {
      setAnnouncement(`Data source changed to FBI. Current selections: Granularity ${fbiGranularity}, Year ${fbiYear}`);
    }
  }, [dataSource, acsTopLevel, acsBottomLevel, fbiGranularity, fbiYear]);

  const handleQuerySubmit = async () => {
    if (!location && (dataSource === "FBI" && fbiGranularity !== "national")) {
      onError("Location is required for state and agency level FBI data");
      return;
    }

    if (!location && dataSource === "ACS" && acsTopLevel === "state") {
      onError("Location is required when top level is set to state");
      return;
    }

    onLoading(true);
    onError(null);
    
    try {
      let response;
      
      if (dataSource === "ACS") {
        // Convert coordinates if available
        const lat = location ? location.lat.toString() : "";
        const lon = location ? location.lng.toString() : "";
        
        console.log("Sending ACS request with params:", {
          lat, lon, variables: acsVariables, topLevel: acsTopLevel, bottomLevel: acsBottomLevel
        });
        
        response = await axios.get("http://localhost:3001/acs-proxy", {
          params: {
            lat,
            lon,
            variables: acsVariables,
            topLevel: acsTopLevel,
            bottomLevel: acsBottomLevel
          }
        });
        
        console.log("ACS response:", response.data);
        
        // Process ACS data
        if (response.data && response.data.data) {
          const headers = response.data.data[0];
          const rows = response.data.data.slice(1);
          onQueryResult({ headers, rows });
        } else {
          onError("Invalid response format from ACS API");
        }
      } else {
        // FBI staff data - always use fbi-staff-data endpoint
        const params: any = {
          granularity: fbiGranularity,
          year: parseInt(fbiYear)
        };
        
        // Add coordinates if location is available and needed for non-national queries
        if (location && fbiGranularity !== "national") {
          params.lat = location.lat;
          params.lon = location.lng;
        }
          
        console.log("Making FBI staff request to: http://localhost:3001/fbi-staff-data", "with params:", params);
        
        response = await axios.get('http://localhost:3001/fbi-staff-data', {
          params
        });
        
        console.log("FBI response received:", response.data);
        console.log("FBI response status:", response.status);
        
        // Process FBI staff data
        if (response.data && response.data.staffStats) {
          // Create a comprehensive result with multiple data sections
          const result = {
            headers: ["Data Type", "Value"],
            rows: [
              ["Year", response.data.year],
              ["Granularity", response.data.query?.granularity || fbiGranularity],
              ["Officer Count", response.data.staffStats.officerCount.toLocaleString()],
              ["Civilian Count", response.data.staffStats.civilianCount.toLocaleString()],
              ["Officers per 1,000", response.data.staffStats.officersPer1000],
              ["Population", response.data.staffStats.population.toLocaleString()]
            ],
            // Add the raw data for enhanced display
            rawData: response.data
          };
          onQueryResult(result);
        } else {
          onError("Invalid staff data format from FBI API");
        }
      }
    } catch (err: any) {
      console.error("Error fetching data:", err);
      console.error("Error details:", {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        config: err.config
      });
      onError(`Failed to fetch data: ${err.response?.status || err.message || "Unknown error"}`);
    } finally {
      onLoading(false);
    }
  };

  return (
    <section className="data-query-panel" aria-labelledby="data-query-heading">
      <div className="data-query-form">
        <h2 id="data-query-heading">Data Query</h2>
        
        {/* Screen reader instructions */}
        <div id="data-query-instructions" className="sr-only">
          Use this form to query census and FBI crime data. Select a data source, configure parameters, and run your query.
        </div>
        
        {/* Live region for announcements */}
        <div 
          id="data-query-status" 
          aria-live="polite" 
          aria-atomic="true" 
          className="sr-only"
        >
          {dataSourceFocused && (
            `${dataSourceOptions[selectedDataSourceIndex].label}, option ${selectedDataSourceIndex + 1} of ${dataSourceOptions.length}`
          )}
          {!dataSourceFocused && announcement}
        </div>
        
        <div className="form-group">
          <label htmlFor="data-source-select">Data Source</label>
          <select 
            id="data-source-select"
            value={dataSource} 
            onChange={(e) => setDataSource(e.target.value as DataSource)}
            onFocus={() => setDataSourceFocused(true)}
            onBlur={() => setDataSourceFocused(false)}
            aria-describedby="data-query-instructions data-query-status"
            aria-label="Select data source for your query"
          >
            <option value="ACS">ACS (Census)</option>
            <option value="FBI">FBI Crime Data</option>
          </select>
        </div>
        
        {dataSource === "ACS" ? (
          <>
            <div className="form-group">
              <label htmlFor="acs-variables-input">Variables (comma-separated)</label>
              <input 
                id="acs-variables-input"
                type="text" 
                value={acsVariables} 
                onChange={(e) => setAcsVariables(e.target.value)}
                placeholder="NAME,S2802_C03_022E"
                aria-describedby="acs-variables-help data-query-status"
                aria-label="Enter ACS variables separated by commas"
              />
              <small id="acs-variables-help">Example: NAME,S2802_C03_022E (Name and Internet Access)</small>
            </div>
            
            <div className="form-group">
              <label htmlFor="acs-top-level-select">Top Level</label>
              <select 
                id="acs-top-level-select"
                value={acsTopLevel} 
                onChange={(e) => setAcsTopLevel(e.target.value)}
                aria-describedby="data-query-status"
                aria-label="Select geographic top level for ACS data"
              >
                <option value="all">All</option>
                <option value="us">US</option>
                <option value="state">State</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="acs-bottom-level-select">Bottom Level</label>
              <select 
                id="acs-bottom-level-select"
                value={acsBottomLevel} 
                onChange={(e) => setAcsBottomLevel(e.target.value)}
                aria-describedby="data-query-status"
                aria-label="Select geographic bottom level for ACS data"
              >
                <option value="state">State</option>
                <option value="county">County</option>
                <option value="place">Place</option>
              </select>
            </div>
          </>
        ) : (
          <>
            <div className="form-group">
              <label htmlFor="fbi-granularity-select">Granularity</label>
              <select 
                id="fbi-granularity-select"
                value={fbiGranularity} 
                onChange={(e) => setFbiGranularity(e.target.value)}
                aria-describedby="data-query-status"
                aria-label="Select geographic granularity for FBI crime data"
              >
                <option value="national">National</option>
                <option value="state">State</option>
                <option value="agency">Agency</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="fbi-year-select">Year</label>
              <select 
                id="fbi-year-select"
                value={fbiYear} 
                onChange={(e) => setFbiYear(e.target.value)}
                aria-describedby="data-query-status"
                aria-label="Select year for FBI crime data"
              >
                <option value="2024">2024</option>
                <option value="2023">2023</option>
                <option value="2022">2022</option>
                <option value="2021">2021</option>
                <option value="2020">2020</option>
              </select>
            </div>
          </>
        )}
        
        <button 
        // keybroad shortcut with tab
          className="query-btn" 
          onClick={handleQuerySubmit}
          tabIndex={0}
          aria-label="Run Query - Press Enter to activate"
        >
          Run Query
        </button>
      </div>
    </section>
  );
}