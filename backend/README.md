# Backend Server

## Endpoints

### Activities

- **POST /upload-csv**: Uploads CSV from Google Sheets or local file and caches activities.
- **GET /activityLocations**: Returns initial activity locations from sample CSV.

### Weather

- **POST /upload-weather-csv**: Fetches weather data for loaded tiles, computes Voronoi polygons, and assigns weather to activities.

### Tiles

- **POST /update-visible-tiles**: Updates visible tiles and triggers activity, graph, and weather updates.

### Redlining

- **POST /highlight-redlining**: Returns redlining features filtered by visible tiles.

### Filters

- **POST /filter**: Filters activities by criteria (boolean or operator-based).

### Routing

- **POST /find-path**: Calculates best routes through activities using multi-stop A\*.

---

## Installation

`npm install`
Also create a .env file and paste

DEMO_KEY=RRoPNnRfxqIaWFb4DIFscvVH3VPMAv6n6OzAWKFN
NOAA_API_TOKEN= byNMxnYoSnQIOZtGlseYbkalildsKwCi
PORT=3001
SPREADSHEET=https://docs.google.com/spreadsheets/d/1966LRbZilujssoH7i9mXXpTeDbQ9RDStNPl0sNibOvw/export?format=csv&gid=0

Add only after sprint 6 but you will find these inside of your firebase console
FIREBASE_PROJECT_ID= ...
FIREBASE_CLIENT_EMAIL= ...
FIREBASE_PRIVATE_KEY= ...

at last download the redlinning data and create a data folder under backend, inside palce a file named redliningData.json found here:
https://drive.google.com/file/d/1vCFbyVQl_5ABWLulOGKhuuiWA1i2cK_R/view?usp=drive_link

## Scripts

| Command                  | Description                                             |
| ------------------------ | ------------------------------------------------------- | ------------------------------- |
| `npm run dev`            | Start server in development mode using ts-node.         |
| `npm run debug`          | Start server with Node.js inspector for debugging.      | Go to chrome://inspect/#devices |
| `npm run test`           | Run all tests using Vitest.                             |
| `npm run test:watch`     | Run Vitest in watch mode.                               |
| `npm run test:external`  | Run tests that require external resources.              |
| `npm run test:file`      | Run Vitest for a single file.                           |
| ------------------------ | ------------------------------------------------------- |