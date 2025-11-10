/**
 * generate-important-roads-east-coast.ts
 *
 * Generates a cached road bundle for the route between
 * "Roger Williams Park Zoo, Providence, RI" and "Central Park, New York City".
 *
 * This script:
 * 1. Defines a bounding box covering the Providence to NYC corridor
 * 2. Fetches detailed road data for tiles along this corridor
 * 3. Prioritizes major interstates and US highways
 * 4. Saves the bundle as a JSON file for offline use
 *
 * Usage:
 *   npx ts-node src/generate-important-roads-east-coast.ts
 */

import fs from "fs";
import path from "path";
import { TILE_SIZE } from "./globalVariables.js";
import { BBox, GraphTile } from "./street-graph/graphSchema.js";

// ============================================================================
// CONFIGURATION
// ============================================================================

const REGION = "Providence to NYC Corridor";
const BBOX: BBox = [-74.1, 40.5, -71.4, 41.9]; // [minLon, minLat, maxLon, maxLat]
const TILE_BUFFER = 1; // Number of tiles to buffer on each side of corridor
const TARGET_WAYS = [
  "I-95",
  "I-295",
  "US-1",
  "US-9",
  "Cross Bronx Expressway",
  "New England Thruway",
];

const OUTPUT_DIR = path.join(
  process.cwd(),
  "backend",
  "data",
  "important-roads"
);
const OUTPUT_FILE = path.join(OUTPUT_DIR, "east-coast-corridor.json");

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Ensures the output directory exists.
 */
function ensureOutputDirectory(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`✓ Created output directory: ${OUTPUT_DIR}`);
  }
}

/**
 * Builds a grid of tile keys covering the specified bounding box.
 *
 * @param bbox - Bounding box [minLon, minLat, maxLon, maxLat]
 * @returns Array of tile keys in format "latIdx,lonIdx"
 */
function buildTilePlanGrid(bbox: BBox): string[] {
  const [minLon, minLat, maxLon, maxLat] = bbox;

  const minLatIdx = Math.floor(minLat / TILE_SIZE);
  const maxLatIdx = Math.floor(maxLat / TILE_SIZE);
  const minLonIdx = Math.floor(minLon / TILE_SIZE);
  const maxLonIdx = Math.floor(maxLon / TILE_SIZE);

  const tiles: string[] = [];
  for (let i = minLatIdx; i <= maxLatIdx; i++) {
    for (let j = minLonIdx; j <= maxLonIdx; j++) {
      tiles.push(`${i},${j}`);
    }
  }

  return tiles;
}

/**
 * Converts a tile key string (e.g., "3,5") into bounding coordinates.
 *
 * @param tileKey - String like "i,j" representing tile indices
 * @returns Tuple [minLat, minLon, maxLat, maxLon]
 */
function tileKeyToBounds(
  tileKey: string
): [minLat: number, minLon: number, maxLat: number, maxLon: number] {
  const [iStr, jStr] = tileKey.split(",");
  const i = parseInt(iStr, 10);
  const j = parseInt(jStr, 10);
  const minLat = i * TILE_SIZE;
  const minLon = j * TILE_SIZE;
  return [minLat, minLon, minLat + TILE_SIZE, minLon + TILE_SIZE];
}

/**
 * Overpass API endpoints with failover support
 */
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

let currentEndpointIndex = 0;
let endpointFailures = new Map<string, number>();
const MAX_CONCURRENT_REQUESTS = 3;
let activeRequests = 0;
const requestQueue: Array<() => void> = [];

/**
 * Acquire a slot for making a request (concurrency limiter)
 */
async function acquireRequestSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT_REQUESTS) {
    activeRequests++;
    return;
  }

  await new Promise<void>((resolve) => {
    requestQueue.push(resolve);
  });
}

/**
 * Release a request slot and process next queued request
 */
function releaseRequestSlot(): void {
  const next = requestQueue.shift();
  if (next) {
    next();
  } else {
    activeRequests--;
  }
}

/**
 * Get next endpoint, skipping recently failed ones
 */
function getNextEndpoint(): string {
  const now = Date.now();
  for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
    const endpoint = OVERPASS_ENDPOINTS[currentEndpointIndex];
    const lastFailure = endpointFailures.get(endpoint) || 0;

    if (now - lastFailure < 60000) {
      currentEndpointIndex =
        (currentEndpointIndex + 1) % OVERPASS_ENDPOINTS.length;
      continue;
    }

    return endpoint;
  }

  return OVERPASS_ENDPOINTS[0];
}

/**
 * Mark endpoint as failed
 */
function markEndpointFailure(endpoint: string): void {
  endpointFailures.set(endpoint, Date.now());
  currentEndpointIndex = (currentEndpointIndex + 1) % OVERPASS_ENDPOINTS.length;
}

/**
 * Concurrency-limited fetch with automatic retry
 */
async function rateLimitedFetch(
  url: string,
  query: string,
  retries = 2
): Promise<Response> {
  await acquireRequestSlot();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: query,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 429) {
      console.warn(`⏱️  Overpass rate limited, waiting 5s before retry...`);
      markEndpointFailure(url);
      releaseRequestSlot();
      await new Promise((resolve) => setTimeout(resolve, 5000));

      if (retries > 0) {
        const nextUrl = getNextEndpoint();
        console.log(`🔁 Retrying with alternate endpoint: ${nextUrl}`);
        return rateLimitedFetch(nextUrl, query, retries - 1);
      }
      return response;
    }

    if (response.status === 504) {
      console.warn(`⏱️  Overpass gateway timeout, waiting 10s...`);
      markEndpointFailure(url);
      releaseRequestSlot();
      await new Promise((resolve) => setTimeout(resolve, 10000));

      if (retries > 0) {
        const nextUrl = getNextEndpoint();
        console.log(`🔁 Retrying with alternate endpoint: ${nextUrl}`);
        return rateLimitedFetch(nextUrl, query, retries - 1);
      }
      return response;
    }

    if (!response.ok) {
      releaseRequestSlot();
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    releaseRequestSlot();
    return response;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      console.warn(`⏱️  Request timeout, retrying...`);
    } else {
      console.warn(`Network error: ${(error as Error).message}`);
    }

    markEndpointFailure(url);

    if (retries > 0) {
      const nextUrl = getNextEndpoint();
      releaseRequestSlot();
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return rateLimitedFetch(nextUrl, query, retries - 1);
    }

    releaseRequestSlot();
    throw error;
  }
}

/**
 * Fetches detailed road data for a single tile.
 * First tries major highways, then falls back to all roads if needed.
 *
 * @param tileKey - Tile key string "i,j"
 * @returns GraphTile object with nodes and neighbors
 */
async function fetchDetailedTile(tileKey: string): Promise<GraphTile> {
  const [minLat, minLon, maxLat, maxLon] = tileKeyToBounds(tileKey);

  const midLat = 0.5 * (minLat + maxLat);
  const cosMid = Math.cos((midLat * Math.PI) / 180);
  const K_LAT = 111_320;
  const K_LON = 111_320 * cosMid;

  const fastMeters = (
    aLat: number,
    aLon: number,
    bLat: number,
    bLon: number
  ) => {
    const dx = (bLon - aLon) * K_LON;
    const dy = (bLat - aLat) * K_LAT;
    return Math.hypot(dx, dy);
  };

  const highwayOnlyRegex =
    "^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link)$";

  const allRoadsRegex =
    "^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|residential|living_street|unclassified)$";

  let data: any;
  let usedFallback = false;

  const highwayQuery = `
[out:json][timeout:25];
(
  way["highway"~"${highwayOnlyRegex}"](${minLat},${minLon},${maxLat},${maxLon});
);
(._; >;);
out skel geom;
`;

  try {
    const url = getNextEndpoint();
    const response = await rateLimitedFetch(url, highwayQuery);
    data = await response.json();

    const wayCount = data.elements.filter(
      (el: any) => el.type === "way"
    ).length;

    if (wayCount === 0) {
      console.log(
        `  No highways found in tile ${tileKey}, trying fallback with all roads...`
      );

      const allRoadsQuery = `
[out:json][timeout:25];
(
  way["highway"~"${allRoadsRegex}"](${minLat},${minLon},${maxLat},${maxLon});
);
(._; >;);
out skel geom;
`;

      const fallbackUrl = getNextEndpoint();
      const fallbackResponse = await rateLimitedFetch(
        fallbackUrl,
        allRoadsQuery
      );
      data = await fallbackResponse.json();
      usedFallback = true;
    }
  } catch (e) {
    console.error(
      `⚠️  Failed to fetch tile ${tileKey} after all retries: ${
        (e as Error).message
      }`
    );
    return buildFallbackTile(tileKey);
  }

  // Build node index and adjacency list
  const needed = new Set<string>();
  const nodeUsageCount: Record<string, number> = {};

  for (const el of data.elements) {
    if (el.type === "way" && el.nodes?.length >= 2) {
      for (let i = 0; i < el.nodes.length; i++) {
        const nodeId = String(el.nodes[i]);
        needed.add(nodeId);
        nodeUsageCount[nodeId] = (nodeUsageCount[nodeId] || 0) + 1;
      }
    }
  }

  const nodesById: Record<string, { id: string; lat: number; lon: number }> =
    {};
  for (const el of data.elements) {
    if (el.type === "node" && needed.has(String(el.id))) {
      nodesById[el.id] = { id: String(el.id), lat: el.lat, lon: el.lon };
    }
  }

  const neighbors: Record<string, { id: string; weight: number }[]> = {};
  const addNbr = (from: string, to: string, w: number) => {
    (neighbors[from] ??= []).push({ id: to, weight: w });
  };

  const MIN_SPACING_METERS = 40;

  for (const el of data.elements) {
    if (el.type !== "way" || !el.nodes || el.nodes.length < 2) continue;

    const nodeIds = el.nodes.map((id: number) => String(id));
    let prevKeptId = nodeIds[0];
    let prevKeptNode = nodesById[prevKeptId];
    let lastNode = prevKeptNode;
    let accumDist = 0;

    if (!prevKeptNode) continue;

    for (let i = 1; i < nodeIds.length; i++) {
      const currentId = nodeIds[i];
      const currentNode = nodesById[currentId];
      if (!lastNode || !currentNode) {
        lastNode = currentNode || lastNode;
        continue;
      }

      const stepDist = fastMeters(
        lastNode.lat,
        lastNode.lon,
        currentNode.lat,
        currentNode.lon
      );
      accumDist += stepDist;

      const usageCount = nodeUsageCount[currentId] || 0;
      const isLast = i === nodeIds.length - 1;
      const mustKeep = usageCount > 1 || isLast;

      if (!mustKeep && accumDist < MIN_SPACING_METERS) {
        delete nodesById[currentId];
        lastNode = currentNode;
        continue;
      }

      addNbr(prevKeptId, currentId, accumDist);
      addNbr(currentId, prevKeptId, accumDist);

      prevKeptId = currentId;
      prevKeptNode = currentNode;
      lastNode = currentNode;
      accumDist = 0;
    }
  }

  const nodeCount = Object.keys(nodesById).length;
  const edgeCount = Object.values(neighbors).reduce(
    (sum, list) => sum + list.length,
    0
  );

  const strategy = usedFallback ? "all roads (fallback)" : "highways only";
  console.log(
    `✓ Tile ${tileKey}: ${nodeCount} nodes, ${edgeCount} edges [${strategy}]`
  );

  return {
    tileKey,
    nodes: Object.values(nodesById),
    neighbors,
  };
}

/**
 * Builds a fallback tile with minimal data (empty or placeholder).
 * Used when tile fetch fails or no data is available.
 *
 * @param tileKey - Tile key string "i,j"
 * @returns Empty GraphTile
 */
function buildFallbackTile(tileKey: string): GraphTile {
  console.log(`⚠️  Returning empty fallback tile for ${tileKey}`);
  return {
    tileKey,
    nodes: [],
    neighbors: {},
  };
}

// ============================================================================
// MAIN SCRIPT
// ============================================================================

async function main(): Promise<void> {
  console.log(`\n🚗 Generating cached road bundle: ${REGION}\n`);
  console.log(`Region: ${REGION}`);
  console.log(`Bounding Box: [${BBOX.join(", ")}]`);
  console.log(`Tile Buffer: ${TILE_BUFFER}`);
  console.log(`Target Ways: ${TARGET_WAYS.join(", ")}\n`);

  ensureOutputDirectory();

  // Build tile grid for the bounding box
  console.log(`📍 Building tile grid...`);
  const tileKeys = buildTilePlanGrid(BBOX);
  console.log(`Found ${tileKeys.length} tiles to fetch\n`);

  // Fetch detailed data for each tile
  console.log(`📡 Fetching detailed tile data...\n`);
  const tiles: GraphTile[] = [];
  let successCount = 0;
  let fallbackCount = 0;

  for (let i = 0; i < tileKeys.length; i++) {
    const tileKey = tileKeys[i];
    console.log(`[${i + 1}/${tileKeys.length}] Fetching tile ${tileKey}...`);

    try {
      const tile = await fetchDetailedTile(tileKey);

      if (tile.nodes.length === 0) {
        fallbackCount++;
      } else {
        successCount++;
      }

      tiles.push(tile);
    } catch (error) {
      console.error(
        `❌ Error fetching tile ${tileKey}: ${(error as Error).message}`
      );
      tiles.push(buildFallbackTile(tileKey));
      fallbackCount++;
    }

    // Add slight delay between requests to be respectful to API
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Build output object with metadata
  console.log(
    `\n✅ Fetch complete: ${successCount} successful, ${fallbackCount} fallback\n`
  );

  const output = {
    meta: {
      region: REGION,
      createdAt: new Date().toISOString(),
      bbox: {
        minLat: BBOX[1],
        minLon: BBOX[0],
        maxLat: BBOX[3],
        maxLon: BBOX[2],
      },
      targetWays: TARGET_WAYS,
      tileCount: tiles.length,
      successCount,
      fallbackCount,
    },
    tiles,
  };

  // Calculate statistics
  let totalNodes = 0;
  let totalEdges = 0;

  for (const tile of tiles) {
    totalNodes += tile.nodes.length;
    totalEdges += Object.values(tile.neighbors).reduce(
      (sum, list) => sum + list.length,
      0
    );
  }

  console.log(`📊 Bundle Statistics:`);
  console.log(`  Total Nodes: ${totalNodes}`);
  console.log(`  Total Edges: ${totalEdges}`);
  console.log(`  Total Tiles: ${tiles.length}`);

  // Write to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\n✓ Bundle saved to: ${OUTPUT_FILE}`);
  console.log(
    `  File size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(2)} KB\n`
  );
}

// Run the script
main().catch((error) => {
  console.error(`❌ Fatal error: ${error.message}`);
  process.exit(1);
});
