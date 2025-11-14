## Project Overview

This is a geospatial travel planning application with a React/TypeScript frontend and Node.js/Express backend. The system integrates FBI crime data, Census demographics, weather information, transit data, and historical redlining data to help users plan trips with comprehensive location-based insights. Users can also attach written reviews to pin locations, view them as pop-ups on the map, and edit or delete their own reviews.

**Key Features**:
- **Advanced Pathfinding**: A* algorithm with support for Euclidean and Haversine distance metrics for optimal route calculation between multiple waypoints
- **Privacy-Preserving Data Sharing**: Anonymized data export with SHA256 hashing, coordinate noise injection (~50m std dev), temporal truncation, and activity date anonymization for research and urban planning use cases
- **Highway Preloading Optimization**: Preloaded major highway networks, achieving 91.7% average speedup on long-distance queries
- **Comprehensive Trip Management**: Save, load, edit, and delete multi-day itineraries with Firebase persistence
- **Pin Organization**: Dedicated pin folder for saving and organizing locations across multiple trips
- **Review System**: User-generated reviews with full CRUD operations and map popup integration
- **Geospatial Data Integration**: FBI crime statistics, Census demographics, weather data, transit information, and historical redlining overlays

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

# Frontend tests (Playwright)
npx playwright test            # Run frontend E2E tests

# Backend Playwright tests (requires backend running)
cd backend && npm run dev      # Terminal 1
npx playwright test            # Terminal 2 (from backend directory)

# Run specific test files
npm run test:file -- path/to/test/file.test.ts
```

### Project Root Commands
From the project root directory (`/pins-and-pathfinding-rzhou52-yyu111`):
```bash
# Install all dependencies
npm install                    # Install root dependencies
cd backend && npm install      # Install backend dependencies
cd ../frontend && npm install  # Install frontend dependencies

# Run both frontend and backend concurrently
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend  
cd frontend && npm run dev
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
├── globalVariables.ts         # Shared caches and global state
├── activity-parser/           # Google Sheets activity data fetching and parsing
├── weather-parser/            # Open-Meteo API + Voronoi diagram generation
├── filter/                    # Activity filtering with enrichment (weather/redlining)
├── street-graph/              # A* and Dijkstra pathfinding with lazy tile loading
│   ├── Astar.ts               # A* algorithm with Euclidean/Haversine distance metrics
│   ├── multiStopAStar.ts      # Multi-waypoint route chaining
│   ├── corridorLoader.ts      # East Coast highway preloading (I-95/I-295/US-1)
│   ├── corridorCacheLoader.ts # Corridor data cache management
│   └── tileLoadingStrategy.ts # Tile loading and neighbor prefetch strategies
├── tile-manager/              # Tile tracking and activity bucketing
├── fbi-query/                 # FBI Crime Data API integration
├── acs/                       # Census ACS data proxy
├── red-linning/               # Historical redlining data filtering and analysis
├── geographic-boundaries/     # State/county boundary lookups
├── firebase/                  # Trip persistence, pin folders, and review management
│   ├── firebasesetup.ts       # Firebase configuration
│   ├── pinSchema.ts           # Schema for pin data validation
│   ├── registerPinFolderHandlers.ts # Pin folder API endpoints
│   ├── registerReviewHandlers.ts    # Review API endpoints
│   ├── registerSaveTripHandler.ts   # Trip saving endpoints
│   ├── dataRequestHandler.ts  # Privacy-preserving data export endpoint
│   ├── reviewSchema.ts        # Schema for review data validation
│   └── tripSchema.ts          # Schema for trip data validation
├── CSV-parser/                # Secure CSV parsing with path traversal prevention
├── initial-loc-parser/        # Initial location data parsing
├── SupplementalChallenge3/    # Security threat handling (rate limiting)
├── SupplementalChallenge4/    # Transit data integration
├── voronoi-diagram-generator/ # Voronoi spatial partitioning
├── middleware/                # Authentication middleware
│   └── authMiddleware.ts      # User authentication handling
├── utils/                     # Utility functions
│   └── privacyUtils.ts        # Privacy transformations (SHA256 hashing, noise injection, temporal truncation)
└── tests/                     # Unit and integration tests
```

**External API Integrations**:
- **FBI Uniform Crime Reporting**: Arrest stats and police employment data
- **US Census Bureau**: Geocoding (lat/lng → FIPS) and ACS demographic data
- **Open-Meteo**: Historical weather data for NOAA stations
- **Google Sheets**: Activity data source
- **ICPSR National Transit Map**: Transit stops and routes
- **Firebase/Firestore**: User trip storage (partial implementation)

**Key Dependencies**:
- `express` (4.21.2): Web server framework
- `zod` (3.25.67): Schema validation
- `d3-delaunay` (6.0.4): Voronoi diagram generation
- `node-cache` (5.1.2): In-memory caching
- `firebase-admin` (13.5.0): Firebase server SDK
- `node-fetch` (3.3.2): HTTP client for API calls
- `cors` (2.8.5): Cross-origin resource sharing
- `dotenv` (17.0.1): Environment variable management

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

**Framework**: React 19.1.0 with TypeScript, Vite 5.0.0 build tool

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
│   ├── PinFolder/            # Pin folder for saving and organizing activities
│   │   ├── PinFolderPanel.tsx    # UI for managing saved pins
│   │   ├── PinFolderButton.tsx   # Toggle button for pin folder panel
│   │   ├── PinFolderService.ts   # API services for pin management
│   │   └── PinCard.tsx           # Individual pin display component
│   ├── Reviews/               # Pin review functionality
│   │   ├── ReviewForm.tsx        # Form for adding/editing reviews
│   │   ├── ReviewList.tsx        # List of reviews for a pin
│   │   ├── ReviewCount.tsx       # Review count display component
│   │   ├── MapReviewPopup.tsx    # Review popup for map pins
│   │   ├── ReviewService.ts      # API services for review management
│   │   └── Reviews.css           # Styling for review components
│   └── DataQuery/            # Census and FBI data query interface
├── components/
│   ├── Button/               # Reusable button components
│   ├── Card/                 # Card layout components
│   ├── DatePicker/           # React DatePicker wrapper
│   ├── Header/               # Navigation with auth status
│   ├── Input/                # Form input components
│   └── LocationPicker/       # Dropdown with keyboard navigation
├── contexts/
│   ├── DarkModeContext.tsx   # Dark/light theme context
│   └── SimpleModeContext.tsx # Simple mode context
├── firebase/
│   └── firebaseConfig.ts     # Firebase configuration
├── types/
│   ├── geographicBoundaries.ts # Type definitions
│   └── reviewTypes.ts        # Review interface definitions
└── assets/
    └── beach-scene.png       # Static assets

├── services/
│   ├── ReviewService.ts      # API services for review management
│   ├── PinService.ts         # API services for pin management
│   ├── TripService.ts        # API services for trip management
│   └── WeatherService.ts     # Weather data fetching
```

**Backend Communication**:
- Base URL: `http://localhost:3001`
- HTTP client: Axios (1.10.0)
- All responses validated with Zod schemas (3.25.71)

**Major Dependencies**:
- `mapbox-gl` (3.13.0): Interactive maps with GeoJSON overlays
- `@dnd-kit/core` (6.3.1), `@dnd-kit/modifiers` (9.0.0), `@dnd-kit/sortable` (10.0.0): Drag-and-drop itinerary management
- `firebase` (12.2.1): Authentication and Firestore
- `react-router-dom` (7.6.3): Client-side routing
- `react-toastify` (11.0.5): Toast notifications
- `date-fns` (4.1.0): Date utilities
- `react-datepicker` (8.4.0): Date selection component
- `lodash.debounce` (4.0.8): Debounce utilities
- `@clerk/clerk-react` (5.47.0): Authentication (alternative to Firebase)

**Mapbox Integration**:
- Displays activity markers from itinerary
- Overlays: Weather polygons, redlining zones, state/county boundaries
- Tile tracking via debounced updates (500ms)
- APIs: `/upload-weather-csv`, `/highlight-redlining`, `/geographic-boundaries`, `/update-visible-tiles`

**Accessibility Features**:
- ARIA labels and live regions for screen readers
- Keyboard navigation (Arrow keys, Enter, Escape)
- Keyboard shortcuts (Ctrl+1/2/3 for highlight modes, Ctrl+B for best route, Ctrl+S to save)
- Focus indicators and semantic HTML
- Comprehensive screen reader support throughout components

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
# Mapbox Access Token (required for interactive maps)
VITE_MAPBOX_TOKEN=pk.your-mapbox-token-here

# Firebase Configuration (optional - for authentication and trip saving)
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=your-app-id

# Backend API URL (defaults to localhost:3001)
VITE_API_BASE_URL=http://localhost:3001
```

**Note**: The frontend will function without Firebase configuration, but authentication and trip saving features will be disabled.

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
| `/pins/:userId` | GET | Retrieve all pins in a user's folder |
| `/pins` | POST | Add a new pin to a user's folder |
| `/pins/sync/:userId` | POST | Sync all pins from user's trips to their pin folder (ensures pins deleted from trips are also removed from pin folder) |
| `/pins/:userId/:pinId` | DELETE | Remove a specific pin from a user's folder |
| `/pins/:userId/:pinId/everywhere` | DELETE | Remove a pin from both the user's folder and all trips |
| `/pins/:pinId/addToItinerary` | PUT | Prepare a pin to be added to an itinerary |
| `/api/reviews` | POST | Create a new review for a pin |
| `/api/reviews/:pinId` | GET | Get all reviews for a specific pin |
| `/api/reviews/:reviewId` | PUT | Update a review (requires user to be the owner) |
| `/api/reviews/:reviewId` | DELETE | Delete a review (requires user to be the owner) |
| `/api/dataRequest` | GET | Privacy-preserving data export (SHA256 hashing, coordinate noise, temporal truncation) for reviews or trips filtered by location key |

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

### Security Implementations
- **Rate Limiting**: 20 requests/minute per IP (in `SupplementalChallenge3/threat1.ts`)
- **Path Traversal Prevention**: Multiple validation layers in CSV parser
- **Input Sanitization**: All inputs validated against Zod schemas
- **Bearer Token Auth**: Firebase authentication for protected endpoints
- **Privacy-Preserving Data Export**: SHA256 user hashing, Gaussian coordinate noise (~50m), temporal truncation, k-anonymity (k ≥ 50)
- **Differential Privacy**: Statistical noise in aggregated outputs to prevent individual identification

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

### Mobile Responsiveness
- **Target Devices**: Samsung Galaxy S8+ (360 x 740 px) and standard desktop (1,920 x 1,080px)
- **Core Requirements**:
  - All core features must remain accessible on mobile devices
  - Content should be visible without zooming
  - Interactive elements must be properly sized and adequately spaced
  - Pages should load efficiently without excessive data consumption
- **Implementation Approach**:
  - Use responsive design techniques (CSS media queries, flexbox, grid)
  - Implement toggles or dropdowns for panels that don't fit on mobile screens
  - Maintain functionality over aesthetics for mobile views
  - Test using browser developer tools' device emulation features
- **Simple Mode**: Enable for bandwidth-constrained mobile users

## Performance Considerations

- **Tile Loading**: Activities bucketed by tiles reduce full dataset scans
- **Debouncing**: Map tile updates debounced at 500ms to prevent excessive API calls
- **Caching**: Weather data cached for 10 minutes via NodeCache
- **Lazy Loading**: Graph tiles and weather stations loaded on-demand
- **Simple Mode**: Disables Mapbox interactive map to reduce bandwidth
- **Mobile Optimization**: Reduced data consumption for mobile users

## Pin Folder Feature

The Pin Folder system allows users to maintain a collection of pins (locations) that may or may not be in an itinerary, enabling experimentation with different trip configurations.

**Key Components**:
- **Pin Synchronization**: Ensures the pin folder always contains a unique set of pins from all saved trips
- **Automatic Sync**: Pins are automatically synchronized when trips are saved or updated
- **Pin Management**: Users can add pins to itineraries or remove them completely
- **Data Consistency**: Pins removed from all trips are automatically removed from the pin folder

**Implementation Details**:
- Backend: `backend/src/firebase/registerPinFolderHandlers.ts` - Core pin folder management endpoints
- Frontend: `frontend/src/features/PinFolder/` - UI components and services for pin interaction
- Integration: `backend/src/firebase/registerSaveTripHandler.ts` - Automatic pin sync on trip save/update

**User Workflows**:
1. Save pins from search results to pin folder
2. View all saved pins in the pin folder panel
3. Add pins from folder to current day's itinerary
4. Remove pins from folder (with option to remove from all trips)
5. Automatic synchronization when trips are modified

## Highway Preloading Optimization

The pathfinding system includes a highway corridor preloading feature that dramatically improves performance for long-distance East Coast routes by caching major highway networks.

**Performance Improvements**:
- **Average Speedup**: 91.7% faster pathfinding with preloaded data
- **Time Savings**: Average 9,405ms per route (up to 13,940ms for Boston-NYC)
- **Node Reduction**: 45.8% fewer nodes explored during A* search
- **Covered Routes**: I-95, I-295, US-1 corridors along the East Coast

**Implementation Details**:
- Preloaded data: `backend/src/street-graph/corridorLoader.ts` - Loads major highway networks at server startup
- Cache management: `backend/src/street-graph/corridorCacheLoader.ts` - Manages preloaded graph data
- Data generation: `backend/src/generate-important-roads-east-coast.ts` - Overpass API queries for highway data
- Benchmarking: `backend/src/benchmarkRoutePerformance.ts` - Performance testing suite

**Benchmark Routes**:
1. Providence Zoo → Central Park: 97.6% speedup, 9,017ms saved
2. Boston → NYC: 93.0% speedup, 13,940ms saved
3. Philadelphia → DC: 84.5% speedup, 5,257ms saved

**How It Works**:
1. Server startup loads precomputed highway network from Overpass API
2. Major highway nodes and edges cached in graph tiles before first query
3. A* algorithm finds optimal paths immediately without tile fetch delays
4. Fallback to on-demand loading for routes outside preloaded corridors

## Privacy-Preserving Data Export

The application provides a privacy-preserving data export feature that allows researchers and urban planners to access anonymized travel data while protecting individual user privacy.

**Privacy Transformations**:
- **User Anonymization**: SHA256 hashing replaces all user IDs with deterministic, non-reversible hashes
- **Coordinate Noise Injection**: Gaussian noise with ~50m standard deviation added to all coordinates to prevent precise location tracking
- **Temporal Truncation**: Exact timestamps converted to "YYYY-MM" format to reduce daily pattern prediction
- **Activity Date Anonymization**: Specific dates replaced with relative labels ("day1", "day2") while preserving trip structure

**Implementation Details**:
- Backend: `backend/src/firebase/dataRequestHandler.ts` - Data export endpoint with privacy controls
- Privacy utilities: `backend/src/utils/privacyUtils.ts` - Transformation functions for anonymization
- Query parameters: `type` (reviews/trips), `key` (location filter), `aggregate` (optional spatial/temporal aggregation)

**Use Cases**:
1. Urban planning departments analyzing pedestrian traffic patterns
2. Public health agencies studying active mobility trends
3. Transportation researchers evaluating infrastructure needs
4. Environmental agencies measuring carbon emission impacts

**Trade-offs and Limitations**:
- Noise injection may occasionally shift coastal coordinates into water
- Excessive generalization reduces analytical precision for fine-grained studies
- K-anonymity constraints (k ≥ 50) may limit data availability for rural areas
- Secure sandbox access model limits raw data manipulation flexibility

## Sprint History Context

This codebase evolved through multiple sprints:
- **Sprint 3**: Backend API server with FBI and Census integration
- **Sprint 4**: Transit data, enhanced error handling, Playwright tests
- **Sprint 5**: Frontend implementation with accessibility focus, dark/simple modes
- **Sprint 6**: Travel planner with comprehensive geospatial features
- **Sprint 7**: Pin folder feature implementation for saving and organizing activities with Firebase
- **Sprint 8**: A* pathfinding algorithm with Euclidean/Haversine metrics, multi-stop routing, privacy policy design for data sharing with urban planning stakeholders, analysis of hierarchical graph partitioning and distributed spatial databases
- **Sprint 9**: A* pathfinding algorithm supports for long-distance routes (250miles+), prioritizing fetching highway. Preserving data request endpoint with SHA256 user hashing, Gaussian noise injection for coordinates, temporal/date anonymization.

When debugging, check sprint README files:
- Backend: `backend/README3.md`, `backend/README4.md`
- Frontend: `frontend/README5.md`, `frontend/README6.md`
- Project root: `README8.md`, `README9.md`

## Useful References

- FBI API Docs: https://api.usa.gov/crime/fbi/cde/
- Census Geocoding: https://geocoding.geo.census.gov/geocoder/
- ACS API: https://api.census.gov/data/2023/acs/acs5/subject/
- Mapbox GL: https://docs.mapbox.com/mapbox-gl-js/
- React DnD Kit: https://docs.dndkit.com/

## Pathfinding Test Plan (Sprint 7)

**Objectives**
- Validate that the backend A* implementation finds a “best path” between two pins quickly and reliably.
- For this sprint, verify path existence and path length (number of nodes) rather than exact node sequences.
- Confirm endpoint `POST /find-path` integration and frontend route rendering work as expected.

**Scope**
- Algorithms: `Astar.ts` (A*), `multiStopAStar.ts` (multi-stop chaining), `shortestTwoPointPath.ts` (nearest node + conversion).
- API: `POST /find-path` via `bestRouteHandler.ts` and registration in `server.ts`.
- Frontend: `MapView.tsx` route fetch and line rendering (smoke checks only).

**Unit Tests (Backend)**
- A* finds a path in a single tile
  - Seed a tiny graph (`graphCache`) with nodes `A-B-C-D` in tile `0,0`.
  - Confirm path exists and length equals expected minimal hops (e.g., 4 nodes).
  - Run with default metric (Euclidean) and custom metric (Haversine) via strategy pattern.
- No-path scenario
  - Two disconnected components in the same tile → expect `[]`.
- Missing start/goal
  - If either node is absent from the index → expect `[]`.
- Multiple correct answers
  - Construct a graph with two equal‑cost routes; assert existence and minimal length only (not exact sequence).
- Near-edge behavior (deferred detailed checks)
  - Keep test nodes away from tile boundaries to avoid neighbor prefetch.
  - Deeper neighbor‑tile loading validation is deferred to the next sprint.
- Multi-stop chaining
  - Seed nodes for three stops; verify `routeThroughStops` concatenates segments, skipping duplicate junction nodes.
  - Validate overall path existence and reasonable length growth vs. pairwise paths.
- Strategy pattern correctness
  - Pass `haversineDistance` and confirm the algorithm accepts custom distance metrics and still returns valid paths.

**Integration Tests (Backend API)**
- Implemented in `backend/src/street-graph/testing/findPath.integration.test.ts`.
- `POST /find-path` happy path
  - Body: `{ points: [{lat,lng}, {lat,lng}], distanceMetric: "euclidean" | "haversine" }`.
  - Expect `200`, a `path` array of `{lat,lng}`, and length ≥ 2.
  - Tests both default and explicit distance metrics.
- Metric mapping
  - Verify `distanceMetric` string correctly maps to `euclid` or `haversine` in handler.
  - Tests `euclidean`, `haversine`, and unknown metrics.
- Validation errors
  - Fewer than 2 points → `400`.
  - Non‑numeric `lat/lng` → handled gracefully with timeout protection.
  - Tests missing points, insufficient points, invalid formats.
- Multi‑point (3+ waypoints)
  - Ensure path is returned and length reflects concatenated segments.
  - Tests 3‑point waypoint routing.
- Performance checks
  - Lightweight response time validation (< 1 second for simple paths).
- Server health
  - Health check endpoint validation.

- San Francisco real‑data cases (single tile)
  - Seeds tile `377,-1225` with POIs: Cable Carts, Nintendo Store, Tadaima, Japan Center, Fillmore, Kevin Chris Pho, City Lights.
  - Valid 2‑point route within SF tile: Cable Carts → Japan Center (haversine metric).
  - Multi‑waypoint route within SF tile: Cable Carts → Tadaima → Japan Center → Fillmore (euclidean metric).

- Dev server real‑data cases (multi‑tile, live Overpass)
  - Implemented in `backend/src/street-graph/testing/findPath.dev.integration.test.ts` (requires running backend dev server).
  - Validates routing across real SF POIs with live tile fetching and neighbor preloading.
  - Uses tile warm‑ups (short nearby requests) to reduce Overpass latency and rate limits.
  - Per‑test timeouts increased (up to 30s) with `AbortController` safeguards.
  - Fail‑fast: suite checks `http://localhost:3001/` in `beforeAll` and throws if the server isn’t running.
  - No silent skips: server‑up guards removed so each test truly requires the live backend.

**Test Data & Fixtures**
- In‑memory `graphCache` seeding with a single `GraphTile`:
  - Keep coordinates centered within tile `0,0` (e.g., around `0.05, 0.05`) to avoid edge‑triggered neighbor loads.
  - Use realistic weights (e.g., Haversine) for adjacent edges to keep heuristic admissible.
  - Make direct “shortcut” edges deliberately more expensive when testing optimality.
- San Francisco tile seeding:
  - Seed tile key `377,-1225` (computed via `latIdx=floor(37.78/0.1)`, `lngIdx=floor(-122.43/0.1)`).
  - Include POIs and connect nearby locations with bidirectional edges.
  - Edge weights use `haversineDistance` to keep heuristic admissible; keep all coords within the same tile to avoid neighbor tile loads.
- Dev server fixtures:
  - Real tiles fetched via `ensureTileLoaded` → `waitForGraphTiles` → Overpass API.
  - Warm tiles with short requests near target routes (e.g., central SF and western SF) before longer routes.
  - Prefer multi‑waypoint sequences to keep segments local and predictable across tiles.
