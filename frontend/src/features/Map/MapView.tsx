import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "./MapView.css";
import { DatedActivity } from "../Itinerary/ItineraryPanel";
import TileManager from "./TileManager";
import axios from "axios";
import type {
  FeatureCollection,
  Feature,
  Polygon,
  LineString,
  GeoJsonProperties,
} from "geojson";
import { weatherDescriptionColors } from "./WeatherColorCode";
import { useSimpleMode } from "../../contexts/SimpleModeContext";
import { GeographicBoundariesResponse, GeographicFeature } from "../../types/geographicBoundaries";
import { MapReviewPopup } from "../Reviews/MapReviewPopup";
import ReactDOM from "react-dom/client";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

// Store React roots for popups to avoid creating multiple roots
const popupRoots = new Map<string, ReactDOM.Root>();

const WEATHER_LAYER_ID = "weather-voronoi";
const REDLINING_LAYER_ID = "redlining-layer";
const STATES_LAYER_ID = "states-boundaries";
const COUNTIES_LAYER_ID = "counties-boundaries";

const ROUTE_LAYER_ID = "route-layer";

type HighlightMode = "none" | "weather" | "redlining";

type Props = {
  markers: DatedActivity[];
  lat: number;
  lng: number;
  highlightMode: HighlightMode;
  distanceMetric: "euclidean" | "haversine";
};

export default function MapView({ markers, lat, lng, highlightMode, distanceMetric }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const markerRefs = useRef<mapboxgl.Marker[]>([]);
  const { isSimpleMode } = useSimpleMode();

  useEffect(() => {
    if (!mapContainer.current || isSimpleMode) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [lng, lat],
      zoom: 12,
    });

    setMapInstance(map);

    return () => {
      map.remove();
    };
  }, [isSimpleMode]);

  // Render markers and geographic boundaries
  useEffect(() => {
    if (!mapInstance) return;

    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = [];

    // Remove existing route
    if (mapInstance.getLayer(ROUTE_LAYER_ID)) {
      mapInstance.removeLayer(ROUTE_LAYER_ID);
    }
    if (mapInstance.getSource("route")) {
      mapInstance.removeSource("route");
    }

    markers.forEach((markerData) => {
      // Create a custom popup element
      const popupEl = document.createElement('div');
      
      // Add pin name
      const nameEl = document.createElement('h4');
      nameEl.textContent = markerData.name ?? "Unnamed Location";
      nameEl.style.margin = "0 0 5px 0";
      popupEl.appendChild(nameEl);
      
      // Add description if available
      if (markerData.description) {
        const descEl = document.createElement('p');
        descEl.textContent = markerData.description;
        descEl.style.margin = "0 0 8px 0";
        descEl.style.fontSize = "12px";
        popupEl.appendChild(descEl);
      }
      
      // Add duration if available
      if (markerData.duration) {
        const durationEl = document.createElement('div');
        durationEl.textContent = `Duration: ${markerData.duration} min`;
        durationEl.style.fontSize = "12px";
        durationEl.style.marginBottom = "8px";
        popupEl.appendChild(durationEl);
      }
      
      // Create container for reviews
      const reviewsContainer = document.createElement('div');
      reviewsContainer.id = `reviews-${markerData.id}`;
      popupEl.appendChild(reviewsContainer);
      
      // Create the popup
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: false,
        maxWidth: '300px'
      }).setDOMContent(popupEl);
      
      // Create and add the marker
      const marker = new mapboxgl.Marker()
        .setLngLat([markerData.lng, markerData.lat])
        .setPopup(popup)
        .addTo(mapInstance);
      
      // When popup is opened, render the reviews component
      popup.on('open', () => {
        const container = document.getElementById(`reviews-${markerData.id}`);
        if (container && markerData.id) {
          // Check if we already have a root for this container
          let root = popupRoots.get(markerData.id);
          
          // If no root exists, create one and store it
          if (!root) {
            root = ReactDOM.createRoot(container);
            popupRoots.set(markerData.id, root);
          }
          
          // Use the existing or new root to render
          root.render(<MapReviewPopup pinId={markerData.id} />);
        }
      });

      // Clean up when popup is closed to prevent memory leaks
      popup.on('close', () => {
        // Unmount the React component properly
        if (markerData.id && popupRoots.has(markerData.id)) {
          const root = popupRoots.get(markerData.id);
          if (root) {
            // Unmount by rendering null
            root.render(null);
          }
        }
      });

      markerRefs.current.push(marker);
    });

    // If we have 2 or more markers, fetch and display the route
    if (markers.length >= 2) {
      fetchAndDisplayRoute(markers, distanceMetric);
    }

    // Fetch and display geographic boundaries for each marker
    fetchAndRenderGeographicBoundaries();
  }, [markers, mapInstance, distanceMetric]);

  // Fetch and render weather polygons
  const fetchAndRenderWeatherPolygons = async (display: boolean = true) => {
    if (!mapInstance) return;

    try {
      const weatherRes = await axios.post(
        "http://localhost:3001/upload-weather-csv"
      );

      if (weatherRes.status !== 200) {
        throw new Error("Failed to fetch weather polygons.");
      }
      if (!display) {
        return;
      }
      const polygons = weatherRes.data;
      const geoJson = convertToGeoJSON(polygons);

      if (!mapInstance.getSource("weather")) {
        mapInstance.addSource("weather", {
          type: "geojson",
          data: geoJson,
        });

        mapInstance.addLayer({
          id: WEATHER_LAYER_ID,
          type: "fill",
          source: "weather",
          paint: {
            "fill-color": [
              "match",
              ["get", "weatherDescription"],
              ...Object.entries(weatherDescriptionColors).flat(),
              "#d1d5db",
            ],
            "fill-opacity": 0.4,
            "fill-outline-color": "#000000",
          },
        });
      } else {
        const source = mapInstance.getSource(
          "weather"
        ) as mapboxgl.GeoJSONSource;
        source.setData(geoJson);
      }
    } catch (err) {
      console.error("Error updating weather overlay:", err);
    }
  };
  const fetchAndRenderRedliningPolygons = async (display: boolean = true) => {
    if (!mapInstance) return;

    try {
      const redliningRes = await axios.post(
        "http://localhost:3001/highlight-redlining"
      );

      if (redliningRes.status !== 200) {
        throw new Error("Failed to fetch redlining polygons.");
      }
      if (!display) {
        return;
      }
      const geoJson: FeatureCollection = redliningRes.data;

      if (!mapInstance.getSource("redlining")) {
        mapInstance.addSource("redlining", {
          type: "geojson",
          data: geoJson,
        });

        mapInstance.addLayer({
          id: REDLINING_LAYER_ID,
          type: "fill",
          source: "redlining",
          paint: {
            "fill-color": [
              "match",
              ["get", "holc_grade"],
              "A",
              "#5bcc04", // Green
              "B",
              "#04b8cc", // Blue
              "C",
              "#e9ed0e", // Yellow
              "D",
              "#d11d1d", // Red
              "H",
              "#000000", // Black
              "#ccc", // Default gray
            ],
            "fill-opacity": 0.2,
          },
        });
      } else {
        const source = mapInstance.getSource(
          "redlining"
        ) as mapboxgl.GeoJSONSource;
        source.setData(geoJson);
      }
    } catch (err) {
      console.error("Error updating redlining overlay:", err);
    }
  };

  // Fetch and render geographic boundaries for all markers
  const fetchAndRenderGeographicBoundaries = async () => {
    if (!mapInstance || markers.length === 0) return;

    try {
      // Remove existing boundary layers
      const removeLayerAndSource = (layerId: string, sourceId: string) => {
        if (mapInstance.getLayer(layerId)) {
          mapInstance.removeLayer(layerId);
        }
        if (mapInstance.getSource(sourceId)) {
          mapInstance.removeSource(sourceId);
        }
      };

      removeLayerAndSource(STATES_LAYER_ID, "states");
      removeLayerAndSource(COUNTIES_LAYER_ID, "counties");

      // Collect all unique coordinates from markers
      const uniqueCoordinates = new Set<string>();
      const coordinatesList: { lat: number; lng: number }[] = [];

      markers.forEach((marker) => {
        const coordKey = `${marker.lat},${marker.lng}`;
        if (!uniqueCoordinates.has(coordKey)) {
          uniqueCoordinates.add(coordKey);
          coordinatesList.push({ lat: marker.lat, lng: marker.lng });
        }
      });

      // Fetch boundaries for each unique coordinate
      const allStates: GeographicFeature[] = [];
      const allCounties: GeographicFeature[] = [];

      for (const coord of coordinatesList) {
        try {
          const response = await axios.get<GeographicBoundariesResponse>(
            `http://localhost:3001/geographic-boundaries`,
            {
              params: {
                latitude: coord.lat,
                longitude: coord.lng,
                includeStates: true,
                includeCounties: true,
              },
            }
          );

          if (response.data.result === "success") {
            if (response.data.states) {
              allStates.push(...response.data.states);
            }
            if (response.data.counties) {
              allCounties.push(...response.data.counties);
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch boundaries for ${coord.lat}, ${coord.lng}:`, error);
        }
      }

      // Remove duplicates based on GEO_ID
      const uniqueStates = allStates.filter(
        (state, index, self) =>
          index === self.findIndex((s) => s.properties.GEO_ID === state.properties.GEO_ID)
      );
      const uniqueCounties = allCounties.filter(
        (county, index, self) =>
          index === self.findIndex((c) => c.properties.GEO_ID === county.properties.GEO_ID)
      );

      // Add states layer
      if (uniqueStates.length > 0) {
        const statesGeoJSON: FeatureCollection = {
          type: "FeatureCollection",
          features: uniqueStates,
        };

        mapInstance.addSource("states", {
          type: "geojson",
          data: statesGeoJSON,
        });

        mapInstance.addLayer({
          id: STATES_LAYER_ID,
          type: "line",
          source: "states",
          paint: {
            "line-color": "#2563eb", // Blue color for state boundaries
            "line-width": 2,
            "line-opacity": 0.8,
          },
        }, 'waterway-label'); // Place state boundaries above water labels
      }

      // Add counties layer if we have county data
      if (uniqueCounties.length > 0) {
        const countiesGeoJSON: FeatureCollection = {
          type: "FeatureCollection",
          features: uniqueCounties,
        };

        // console.log("Counties GeoJSON data:", JSON.stringify(countiesGeoJSON, null, 2));

        mapInstance.addSource("counties", {
          type: "geojson",
          data: countiesGeoJSON,
        });

        mapInstance.addLayer({
          id: COUNTIES_LAYER_ID,
          type: "line",
          source: "counties",
          paint: {
            "line-color": "#dc2626", // Red color for county boundaries
            "line-width": 2, // Increased width for better visibility
            "line-opacity": 0.8, // Increased opacity for better visibility
          },
        }, 'waterway-label'); // Place county boundaries above water labels

        console.log("Counties layer added successfully");
        
        // Verify the layer was added
        const addedLayer = mapInstance.getLayer(COUNTIES_LAYER_ID);
        console.log("Counties layer verification:", addedLayer ? "Layer exists" : "Layer not found");
        
        // Check if the source has data
        const source = mapInstance.getSource("counties") as mapboxgl.GeoJSONSource;
        console.log("Counties source verification:", source ? "Source exists" : "Source not found");
      } else {
        console.log("No county data to render");
      }

      console.log(`Rendered ${uniqueStates.length} states and ${uniqueCounties.length} counties`);
    } catch (error) {
      console.error("Error fetching geographic boundaries:", error);
    }
  };

  useEffect(() => {
    if (!mapInstance) return;

    const removeLayerAndSource = (layerId: string, sourceId: string) => {
      if (mapInstance.getLayer(layerId)) {
        mapInstance.removeLayer(layerId);
      }
      if (mapInstance.getSource(sourceId)) {
        mapInstance.removeSource(sourceId);
      }
    };

    if (highlightMode === "none") {
      removeLayerAndSource(WEATHER_LAYER_ID, "weather");
      removeLayerAndSource(REDLINING_LAYER_ID, "redlining");
      // Keep geographic boundaries visible even when highlight mode is "none"
      return;
    }

    if (highlightMode === "weather") {
      fetchAndRenderWeatherPolygons();
      removeLayerAndSource(REDLINING_LAYER_ID, "redlining");
    }

    if (highlightMode === "redlining") {
      fetchAndRenderRedliningPolygons();
      removeLayerAndSource(WEATHER_LAYER_ID, "weather");
    }
  }, [highlightMode, mapInstance]);

  // Handle tile updates and trigger weather overlay if needed
  const handleTilesChanged = async (tileKeys: string[]) => {
    console.log("New visible tiles:", tileKeys);

    try {
      const tileRes = await axios.post(
        "http://localhost:3001/update-visible-tiles",
        { tileKeys }
      );

      if (tileRes.status !== 200) {
        throw new Error("Failed to update tiles.");
      }
      //these should be called for search pourposes but their graphs shouldn't be displayed, maybe add a boolean to disable that
      fetchAndRenderWeatherPolygons(false);
      fetchAndRenderRedliningPolygons(false);
    } catch (err) {
      console.error("Error updating tiles or weather overlay:", err);
    }
  };

  // Fetch and display route between markers
  const fetchAndDisplayRoute = async (activities: DatedActivity[], metric: "euclidean" | "haversine") => {
    if (!mapInstance || activities.length < 2) return;

    console.log(`[MapView] Fetching route with distance metric: ${metric}`);

    try {
      const points = activities.map(activity => ({
        lat: activity.lat,
        lng: activity.lng
      }));

      console.log(`[MapView] Sending request with ${points.length} points and metric: ${metric}`);

      const response = await axios.post('http://localhost:3001/find-path', {
        points,
        distanceMetric: metric
      });

      if (response.status === 200 && response.data) {
        const pathCoordinates = response.data.path;
        console.log(`Route found with ${pathCoordinates.length} waypoints`);

        // Create a GeoJSON LineString from the route data
        const routeGeoJson: FeatureCollection<LineString> = {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: {
              distance: response.data.distance || 'unknown',
              waypoints: pathCoordinates.length
            },
            geometry: {
              type: 'LineString',
              // Convert path coordinates to [lng, lat] format required by Mapbox
              coordinates: pathCoordinates.map((p: { lat: number; lng: number }) => [p.lng, p.lat])
            }
          }]
        };

        // Add the route to the map
        if (!mapInstance.getSource('route')) {
          mapInstance.addSource('route', {
            type: 'geojson',
            data: routeGeoJson
          });

          mapInstance.addLayer({
            id: ROUTE_LAYER_ID,
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#0a84ff',
              'line-width': 4,
              'line-opacity': 0.8
            }
          });
        } else {
          const source = mapInstance.getSource('route') as mapboxgl.GeoJSONSource;
          source.setData(routeGeoJson);
        }
      } else {
        console.warn('No path data returned from backend');
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      // Show user-friendly error notification
      if (axios.isAxiosError(error)) {
        console.error('Response:', error.response?.data);
      }
    }
  };

  if (isSimpleMode) {
    return (
      <div className="map-container simple-map-placeholder">
        <div className="simple-map-content">
          <h3>Map (Simple Mode)</h3>
          <p>Interactive map is disabled in Simple Mode to reduce bandwidth and visual complexity.</p>
          {markers.length > 0 && (
            <div className="simple-markers-list">
              <h4>Selected Activities:</h4>
              <ul>
                {markers.map((marker, idx) => (
                  <li key={idx}>
                    <strong>{marker.name || "Unnamed Activity"}</strong>
                    <br />
                    <small>Coordinates: {marker.lat.toFixed(4)}, {marker.lng.toFixed(4)}</small>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={mapContainer} className="map-container">
      {mapInstance && (
        <TileManager map={mapInstance} onTilesChanged={handleTilesChanged} />
      )}
      <div className="map-attribution">
        Geographic boundaries: <a href="https://www.census.gov/" target="_blank" rel="noopener noreferrer">U.S. Census Bureau</a> | 
        Converted by <a href="https://eric.clst.org/tech/usgeojson/" target="_blank" rel="noopener noreferrer">Eric Clst</a>
      </div>
    </div>
  );
}

function convertToGeoJSON(
  stations: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    description?: string;
    polygon?: { x: number; y: number }[];
  }[]
): FeatureCollection<Polygon, GeoJsonProperties> {
  const features: Feature<Polygon, GeoJsonProperties>[] = stations
    .filter((s) => s.polygon && s.polygon.length >= 3)
    .map((station) => {
      const coords = station.polygon!.map((p) => [p.x, p.y]);
      const first = coords[0];
      const last = coords[coords.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        coords.push(first); // Ensure closed ring
      }

      return {
        type: "Feature",
        properties: {
          id: station.id,
          name: station.name,
          weatherDescription: station.description ?? "Unknown",
        },
        geometry: {
          type: "Polygon",
          coordinates: [coords],
        },
      };
    });

  return {
    type: "FeatureCollection",
    features,
  };
}
