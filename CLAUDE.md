# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a geospatial travel planning application with a React/TypeScript frontend and Node.js/Express backend. The system integrates FBI crime data, Census demographics, weather information, transit data, and historical redlining data to help users plan trips with comprehensive location-based insights.

## Development Commands

### Backend (from `/backend`)
```bash
npm install                    # Install dependencies
npm run dev                    # Start server on port 3001 (development with ts-node)
npm run debug                  # Start with Node.js inspector (chrome://inspect/#devices)
npm test                       # Run all tests with Vitest
npm run test:watch             # Run tests in watch mode
npm run test:external          # Run tests requiring external API calls
npm run test:file              # Run single test file
```

### Frontend (from `/frontend`)
```bash
npm install                    # Install dependencies
npm run dev                    # Start Vite dev server (default: http://localhost:5173)
npm run build                  # Build for production (TypeScript + Vite)
npm run lint                   # Run ESLint
npm run preview                # Preview production build
```

### Testing
```bash
# Backend tests
cd backend && npm test

# Playwright tests (requires backend running)
cd backend && npm run dev      # Terminal 1
npx playwright test            # Terminal 2
```

## Architecture Overview

### Backend Architecture

**Entry Point**: `backend/src/server.ts` - Express server with modular handler registration

**Key Design Patterns**:
- **Handler-Service Pattern**: Each feature has dedicated handlers that call service functions
- **Dependency Injection**: Services accept injected dependencies for testability
- **Tile-Based Geographic Partitioning**: Map divided into 0.1-degree tiles for efficient spatial queries
- **Lazy Loading with Queues**: Graph tiles and weather stations loaded on-demand via background queues
- **Voronoi Spatial Partitioning**: Weather stations use D3-Delaunay for "nearest station" queries
- **Multi-Year API Fallback**: FBI endpoints retry previous years if current year data unavailable

**Global Caches** (`globalVariables.ts`):
- `activityCache`: Activity locations keyed by "lat,lng"
- `tileCache`: Visible tiles and filtered activities
- `redliningCache`: Historical redlining GeoJSON
- `graphCache`: Street graph tiles for pathfinding
- `cachedStations`: Weather station data with Voronoi polygons
- `TILE_SIZE`: 0.1 degrees

**Core Modules**:
```
backend/src/
├── server.ts                  # Main app and handler registration
├── globalVariables.ts         # Shared caches
├── activity-parser/           # Google Sheets activity data fetching
├── weather-parser/            # Open-Meteo API + Voronoi diagram generation
├── filter/                    # Activity filtering with enrichment (weather/redlining)
├── street-graph/              # A* pathfinding with lazy tile loading
├── tile-manager/              # Tile tracking and activity bucketing
├── fbi-query/                 # FBI Crime Data API integration
├── acs/                       # Census ACS data proxy
├── red-linning/               # Historical redlining data filtering
├── geographic-boundaries/     # State/county boundary lookups
├── firebase/                  # Trip persistence (Firestore)
├── CSV-parser/                # Secure CSV parsing with path traversal prevention
└── SupplementalChallenge4/    # Transit data integration
```

**External API Integrations**:
- **FBI Uniform Crime Reporting**: Arrest stats and police employment data
- **US Census Bureau**: Geocoding (lat/lng → FIPS) and ACS demographic data
- **Open-Meteo**: Historical weather data for NOAA stations
- **Google Sheets**: Activity data source
- **ICPSR National Transit Map**: Transit stops and routes
- **Firebase/Firestore**: User trip storage (partial implementation)

**FIPS Code Resolution Chain**:
```
lat/lng → Census Geocoder → State/County/Place FIPS
  ↓
State FIPS → State Abbreviation (mapping table)
  ↓
State + County FIPS → ORI code (from CSV crosswalk)
  ↓
State Abbr + ORI → FBI API query
```

### Frontend Architecture

**Framework**: React 19.1.0 with TypeScript, Vite build tool

**Entry Point**: `frontend/src/main.tsx` → `App.tsx` (router and context providers)

**State Management**:
- **Context API** for global state:
  - `DarkModeContext`: Theme preference (persisted to localStorage)
  - `SimpleModeContext`: Bandwidth-saving mode (disables interactive map)
- **Local useState** for component-specific state
- **No Redux/Zustand** - chosen for simplicity

**Key Features**:
```
frontend/src/
├── pages/
│   ├── Home.tsx              # Landing page: date selection + location picker
│   ├── Planner.tsx           # Main trip planning dashboard
│   ├── Login.tsx             # Firebase authentication
│   └── NotFound.tsx
├── features/
│   ├── Search/               # Activity search with filters
│   ├── Map/                  # Mapbox integration with weather/redlining overlays
│   ├── Itinerary/            # Drag-and-drop trip planning with @dnd-kit
│   ├── Filters/              # Comprehensive filter UI (price, weather, amenities)
│   └── DataQuery/            # Census and FBI data query interface
├── components/
│   ├── LocationPicker/       # Dropdown with keyboard navigation
│   ├── DatePicker/           # React DatePicker wrapper
│   ├── Header/               # Navigation with auth status
│   └── Button/, Card/, Input/
└── contexts/
    ├── DarkModeContext.tsx
    └── SimpleModeContext.tsx
```

**Backend Communication**:
- Base URL: `http://localhost:3001`
- HTTP client: Axios (1.10.0)
- All responses validated with Zod schemas

**Major Dependencies**:
- `mapbox-gl` (3.13.0): Interactive maps with GeoJSON overlays
- `@dnd-kit/*`: Drag-and-drop itinerary management
- `firebase` (12.2.1): Authentication and Firestore
- `react-router-dom` (7.6.3): Client-side routing
- `react-toastify` (11.0.5): Toast notifications
- `date-fns` (4.1.0): Date utilities
- `zod` (3.25.71): Schema validation

**Mapbox Integration** (`MapView.tsx`):
- Displays activity markers from itinerary
- Overlays: Weather polygons, redlining zones, state/county boundaries
- Tile tracking via `TileManager.tsx` with 500ms debounce
- APIs: `/upload-weather-csv`, `/highlight-redlining`, `/geographic-boundaries`, `/update-visible-tiles`

**Accessibility Features**:
- ARIA labels and live regions for screen readers
- Keyboard navigation (Arrow keys, Enter, Escape)
- Keyboard shortcuts (Ctrl+1/2/3 for highlight modes, Ctrl+B for best route, Ctrl+S to save)
- Focus indicators and semantic HTML

## Environment Configuration

### Backend `.env` (create in `/backend`)

**IMPORTANT**: The `.env` file is required for the server to start. Create it in the `/backend` directory.

```
# Server Configuration
PORT=3001

# API Keys
DEMO_KEY=RRoPNnRfxqIaWFb4DIFscvVH3VPMAv6n6OzAWKFN
NOAA_API_TOKEN=byNMxnYoSnQIOZtGlseYbkalildsKwCi

# Google Sheets Activity Data Source
SPREADSHEET=https://docs.google.com/spreadsheets/d/1966LRbZilujssoH7i9mXXpTeDbQ9RDStNPl0sNibOvw/export?format=csv&gid=0

# Firebase Configuration (Optional - server will use mock responses if not configured)
# Uncomment and fill in to enable real Firebase integration
# FIREBASE_PROJECT_ID=your-project-id
# FIREBASE_CLIENT_EMAIL=your-client-email@project.iam.gserviceaccount.com
# FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nPrivate\nKey\nHere\n-----END PRIVATE KEY-----\n"
```

**Note**: Firebase is optional. The `/savePins` endpoint will return mock responses if Firebase credentials are not configured.

### Backend Data Files
- Place `backend/data/redliningData.json` from: https://drive.google.com/file/d/1vCFbyVQl_5ABWLulOGKhuuiWA1i2cK_R/view?usp=drive_link
- FBI API key in `backend/src/fbi-query/fbi-api-key.txt`
- ORI crosswalk CSV in `backend/data/Law-Enforcement-Agency-Identifiers-Crosswalk-2012.csv`

### Frontend Environment Variables
Create `.env` in `/frontend` with:
```
VITE_MAPBOX_TOKEN=...
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Key Backend Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/upload-csv` | POST | Load activities from Google Sheets |
| `/activityLocations` | GET | Get available destination locations |
| `/update-visible-tiles` | POST | Track visible map tiles |
| `/upload-weather-csv` | POST | Get weather data with Voronoi polygons |
| `/filter` | POST | Filter activities by criteria + enrichment |
| `/find-path` | POST | Calculate best route through activities (A*) |
| `/fbi-arrest-data` | GET | FBI crime arrest statistics |
| `/fbi-staff-data` | GET | Law enforcement staffing data |
| `/acs-proxy` | GET | Census ACS demographic data |
| `/highlight-redlining` | POST | Historical redlining zones |
| `/geographic-boundaries` | GET | State/county boundaries containing point |
| `/transit-stops` | GET | Transit stops within radius |
| `/getcsv` | GET | Read and parse CSV files (secured) |
| `/savePins` | POST | Save trip with full itinerary to Firebase |
| `/trips/:userId` | GET | Retrieve all saved trips for a user |
| `/trips/:tripId` | DELETE | Delete a specific trip (requires userId in body) |

## Common Development Workflows

### Adding a New Backend Endpoint
1. Create handler file in appropriate module directory (e.g., `src/new-feature/newFeatureHandler.ts`)
2. Define Zod schemas for request/response validation
3. Implement handler function with dependency injection pattern
4. Register handler in `server.ts`: `registerNewFeatureHandler(app, dependencies)`
5. Add unit tests in `tests/` directory
6. Add Playwright tests if needed

### Adding a New Frontend Feature
1. Create feature directory in `src/features/FeatureName/`
2. Define Zod schemas for API response validation
3. Create component files (`.tsx`) with corresponding CSS
4. Update routing in `App.tsx` if new page
5. Add API calls using axios with proper error handling
6. Ensure ARIA labels and keyboard navigation

### Modifying Filter Logic
- Backend: `backend/src/filter/filterRows.ts` - filtering algorithm
- Frontend: `frontend/src/features/Filters/FilterPanel.tsx` - UI controls
- Schema: Both use `FilterConfigSchema` from `filterConfigSchema.ts`
- Enrichment: Filter handler adds weather/redlining data before applying conditions

### Working with Tiles
- Tile size: 0.1 degrees (defined in `globalVariables.ts`)
- Activity bucketing: `tile-manager/tileCache.ts`
- Frontend tracking: `frontend/src/features/Map/TileManager.tsx`
- Updates trigger: Activity filtering, graph loading, weather assignment

### Testing with Mock Data
- FBI: Use `mockFBIDataFetcher` in tests - inject via handler parameters
- Transit: Use `mockTransitDataFetcher` similarly
- All handlers accept injected service functions for mocking
- Example: `registerFBIQueryHandler(app, mockStateFIPS, mockCountyFIPS, mockFBIFetcher)`

## Known Issues and Workarounds

### Bug Fixes from Past Sprints
1. **FBI Year Mismatch**: Fixed with year validation logic - ensure `data_year` matches requested year
2. **404 Errors on FBI Queries**: Fixed by aligning parameter handling with working `FBIDataTest` component
3. **Mock vs Real API**: Fixed by separating development/production configs with dependency injection
4. **Undefined Test Behavior**: Fixed by ensuring server fully starts before tests run
5. **Unhandled Promise Rejection on Tile Loading**: Fixed unhandled rejection error when weather/graph tile loading fails
   - Issue: `stationQueue.ts` was rejecting with `0` instead of the actual error
   - Issue: `tileCache.ts` was calling `enqueueGraphTask` and `enqueueStationTask` without `.catch()` handlers
   - Solution: Changed `reject(0)` to `reject(err)` with error logging, added `.catch()` handlers to background tasks
6. **Firebase Initialization Error**: Fixed server crash when `.env` file missing or Firebase not configured
   - Issue: `firebasesetup.ts` tried to initialize Firebase even when credentials were missing
   - Solution: Made Firebase initialization conditional - only initializes if all credentials are present
   - Handler falls back to mock responses when Firebase is not configured
7. **Firebase Auth Popup COOP Error**: Fixed "Cross-Origin-Opener-Policy policy would block the window.close call"
   - Issue: Vite dev server's default COOP headers prevent Firebase from closing auth popups
   - Solution: Configure Vite server headers with `"Cross-Origin-Opener-Policy": "same-origin-allow-popups"`

### Current Limitations
- Simple mode only accessible from landing page - mode controls not available in Planner view
- Load trips UI not yet implemented (backend endpoints exist, frontend component needed)
- Screen reader announcements inconsistent across components
- Filter panel checkboxes have incomplete keyboard support

### Security Implementations
- **Rate Limiting**: 20 requests/minute per IP (in `SupplementalChallenge3/threat1.ts`)
- **Path Traversal Prevention**: Multiple validation layers in CSV parser
- **Input Sanitization**: All inputs validated against Zod schemas
- **Bearer Token Auth**: Firebase authentication for protected endpoints

## Code Style and Conventions

### TypeScript
- All data structures defined with Zod schemas for runtime validation
- Prefer type inference from Zod schemas: `type Location = z.infer<typeof LocationSchema>`
- Use dependency injection for testability

### Error Handling
- Backend: Try-catch blocks with descriptive error messages, generic 500 responses to clients
- Frontend: Toast notifications via react-toastify, loading/error states in components
- Always validate API responses with Zod before use

### Testing
- Unit tests for individual functions/services
- Integration tests for handler + service combinations
- Playwright for end-to-end API testing
- Mock external APIs with injected functions

### Accessibility
- Always add ARIA labels to interactive elements
- Implement keyboard shortcuts with Ctrl/Cmd modifiers
- Ensure focus management for modals/dropdowns
- Add sr-only text for screen readers where visual-only indicators exist

## Performance Considerations

- **Tile Loading**: Activities bucketed by tiles reduce full dataset scans
- **Debouncing**: Map tile updates debounced at 500ms to prevent excessive API calls
- **Caching**: Weather data cached for 10 minutes via NodeCache
- **Lazy Loading**: Graph tiles and weather stations loaded on-demand
- **Simple Mode**: Disables Mapbox interactive map to reduce bandwidth

## Sprint History Context

This codebase evolved through multiple sprints:
- **Sprint 3**: Backend API server with FBI and Census integration
- **Sprint 4**: Transit data, enhanced error handling, Playwright tests
- **Sprint 5**: Frontend implementation with accessibility focus, dark/simple modes
- **Current**: Travel planner with comprehensive geospatial features

When debugging, check sprint README files:
- `backend/README3.md`, `backend/README4.md`
- `frontend/README5.md`

## Useful References

- FBI API Docs: https://api.usa.gov/crime/fbi/cde/
- Census Geocoding: https://geocoding.geo.census.gov/geocoder/
- ACS API: https://api.census.gov/data/2023/acs/acs5/subject/
- Mapbox GL: https://docs.mapbox.com/mapbox-gl-js/
- React DnD Kit: https://docs.dndkit.com/
