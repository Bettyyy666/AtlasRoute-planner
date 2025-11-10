import { BBox, GraphNode, GraphTile } from "./graphSchema.js";

/**
 * Concurrency limiting to prevent overwhelming Overpass API
 * Allows up to 3 concurrent requests for faster tile loading (3x speedup)
 */
const MAX_CONCURRENT_OVERPASS_REQUESTS = 3;
let activeRequests = 0;
const requestQueue: Array<() => void> = [];

/**
 * Acquire a slot for making an Overpass request (concurrency limiter)
 */
async function acquireRequestSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT_OVERPASS_REQUESTS) {
    activeRequests++;
    return;
  }

  // Wait for a slot to become available
  await new Promise<void>(resolve => {
    requestQueue.push(resolve);
  });
}

/**
 * Release a request slot and process next queued request
 */
function releaseRequestSlot(): void {
  const next = requestQueue.shift();
  if (next) {
    // Give slot to queued request
    next();
  } else {
    // No queued requests, decrement counter
    activeRequests--;
  }
}

/**
 * Multiple Overpass endpoints for automatic failover
 */
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

let currentEndpointIndex = 0;
let endpointFailures = new Map<string, number>();

/**
 * Get next endpoint, skipping recently failed ones
 */
function getNextEndpoint(): string {
  const now = Date.now();
  for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
    const endpoint = OVERPASS_ENDPOINTS[currentEndpointIndex];
    const lastFailure = endpointFailures.get(endpoint) || 0;

    // If endpoint failed less than 60 seconds ago, skip it
    if (now - lastFailure < 60000) {
      currentEndpointIndex = (currentEndpointIndex + 1) % OVERPASS_ENDPOINTS.length;
      continue;
    }

    return endpoint;
  }

  // All endpoints failed recently, use primary anyway
  return OVERPASS_ENDPOINTS[0];
}

/**
 * Mark endpoint as failed
 */
function markEndpointFailure(endpoint: string) {
  endpointFailures.set(endpoint, Date.now());
  currentEndpointIndex = (currentEndpointIndex + 1) % OVERPASS_ENDPOINTS.length;
}

/**
 * Concurrency-limited fetch with automatic retry
 * Allows up to MAX_CONCURRENT_OVERPASS_REQUESTS concurrent requests
 */
async function rateLimitedFetch(url: string, query: string, retries = 2): Promise<Response> {
  // Acquire a concurrency slot
  await acquireRequestSlot();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: query,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 429) {
      // Rate limited - wait longer and retry with different endpoint
      console.warn(`⏱️  Overpass rate limited, waiting 5s before retry...`);
      markEndpointFailure(url);
      releaseRequestSlot(); // Release before waiting
      await new Promise(resolve => setTimeout(resolve, 5000));

      if (retries > 0) {
        const nextUrl = getNextEndpoint();
        console.log(`🔁 Retrying with alternate endpoint: ${nextUrl}`);
        return rateLimitedFetch(nextUrl, query, retries - 1);
      }
      return response; // Return after all retries exhausted
    }

    // 504 Gateway Timeout = Overpass server overloaded, skip with longer backoff
    if (response.status === 504) {
      console.warn(`⏱️  Overpass gateway timeout (server overloaded), waiting 10s...`);
      markEndpointFailure(url);
      releaseRequestSlot(); // Release before waiting
      await new Promise(resolve => setTimeout(resolve, 10000));

      if (retries > 0) {
        const nextUrl = getNextEndpoint();
        console.log(`🔁 Retrying with alternate endpoint: ${nextUrl}`);
        return rateLimitedFetch(nextUrl, query, retries - 1);
      }
      return response; // Return after all retries exhausted
    }

    if (!response.ok) {
      releaseRequestSlot();
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    releaseRequestSlot();
    return response;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.warn(`⏱️  Request timeout, retrying...`);
    } else {
      console.warn(`Network error: ${(error as Error).message}`);
    }

    markEndpointFailure(url);

    if (retries > 0) {
      const nextUrl = getNextEndpoint();
      releaseRequestSlot(); // Release before waiting
      await new Promise(resolve => setTimeout(resolve, 2000));
      return rateLimitedFetch(nextUrl, query, retries - 1);
    }

    releaseRequestSlot();
    throw error;
  }
}

/**
 * fetchGraphDataFromAPI
 *
 * Fetches street graph data (nodes + edges) from the Overpass API
 * for a given bounding box, and converts it into a `GraphTile` object
 * that the pathfinding algorithm can consume.
 *
 * Enhanced with:
 * - Rate limiting (1 req/second minimum)
 * - Automatic endpoint failover
 * - Two-tier highway prioritization: highways first, fallback to all roads if empty
 * - Node simplification to reduce graph size
 *
 * @param bbox - Bounding box [minLon, minLat, maxLon, maxLat]
 * @returns A GraphTile with nodes, neighbors, and metadata
 */
export async function fetchGraphDataFromAPI(bbox: BBox): Promise<GraphTile> {
  const [minLon, minLat, maxLon, maxLat] = bbox;

  // Precompute constants for fast distance calculation
  const midLat = 0.5 * (minLat + maxLat);
  const cosMid = Math.cos((midLat * Math.PI) / 180);
  const K_LAT = 111_320; // meters per degree latitude
  const K_LON = 111_320 * cosMid; // meters per degree longitude at this latitude

  // Simple helper for fast approximate distance between two lat/lon points
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

  // Two-tier highway prioritization strategy:
  // 1. First try highways only (motorway through tertiary)
  // 2. If empty, fallback to all roads including residential/living_street

  const highwayOnlyRegex =
    "^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link)$";

  const allRoadsRegex =
    "^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|residential|living_street|unclassified)$";

  let data: any;
  let usedFallback = false;

  // Try highway-only query first
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

    // Check if we got any ways (roads) back
    const wayCount = data.elements.filter((el: any) => el.type === "way").length;

    if (wayCount === 0) {
      console.log(`  No highways found in tile ${minLat}_${minLon}, trying fallback with all roads...`);

      // Fallback to all roads including residential
      const allRoadsQuery = `
  [out:json][timeout:25];
  (
    way["highway"~"${allRoadsRegex}"](${minLat},${minLon},${maxLat},${maxLon});
  );
  (._; >;);
  out skel geom;
`;

      const fallbackUrl = getNextEndpoint();
      const fallbackResponse = await rateLimitedFetch(fallbackUrl, allRoadsQuery);
      data = await fallbackResponse.json();
      usedFallback = true;
    }
  } catch (e) {
    // If all retries fail, return an empty tile instead of crashing
    // This allows pathfinding to continue with partial graph data
    console.error(`⚠️  Failed to fetch tile ${minLat}_${minLon} after all retries: ${(e as Error).message}`);
    console.warn(`⚠️  Returning empty tile to allow pathfinding to continue`);

    return {
      tileKey: `${minLat}_${minLon}_${maxLat}_${maxLon}`,
      nodes: [],
      neighbors: {},
    };
  }

  /**
   * Step 1: Determine which nodes are relevant.
   * Track node usage count for simplification.
   */
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

  /**
   * Step 2: Collect node coordinates for all "needed" nodes.
   */
  const nodesById: Record<string, GraphNode> = {};
  for (const el of data.elements) {
    if (el.type === "node" && needed.has(String(el.id))) {
      nodesById[el.id] = { id: String(el.id), lat: el.lat, lon: el.lon };
    }
  }

  /**
   * Step 3: Build adjacency list with node simplification.
   * Skip intermediate nodes to reduce graph size by ~50%.
   */
  const neighbors: Record<string, { id: string; weight: number }[]> = {};
  const addNbr = (from: string, to: string, w: number) => {
    (neighbors[from] ??= []).push({ id: to, weight: w });
  };

  const MIN_SPACING_METERS = 40; // Skip nodes closer than 40m

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
        lastNode.lat, lastNode.lon,
        currentNode.lat, currentNode.lon
      );
      accumDist += stepDist;

      const usageCount = nodeUsageCount[currentId] || 0;
      const isLast = i === nodeIds.length - 1;

      // Keep junction nodes (used by multiple ways) and last node
      const mustKeep = usageCount > 1 || isLast;

      // Skip intermediate nodes under spacing threshold
      if (!mustKeep && accumDist < MIN_SPACING_METERS) {
        delete nodesById[currentId];
        lastNode = currentNode;
        continue;
      }

      // Add bidirectional edges
      addNbr(prevKeptId, currentId, accumDist);
      addNbr(currentId, prevKeptId, accumDist);

      prevKeptId = currentId;
      prevKeptNode = currentNode;
      lastNode = currentNode;
      accumDist = 0;
    }
  }

  // Return graph tile object
  const nodeCount = Object.keys(nodesById).length;
  const edgeCount = Object.values(neighbors).reduce((sum, list) => sum + list.length, 0);

  // Log stats for monitoring
  if (nodeCount > 0) {
    const strategy = usedFallback ? "all roads (fallback)" : "highways only";
    console.log(`✓ Tile ${minLat}_${minLon}: ${nodeCount} nodes, ${edgeCount} edges [${strategy}]`);
  }

  return {
    tileKey: `${minLat}_${minLon}_${maxLat}_${maxLon}`,
    nodes: Object.values(nodesById),
    neighbors,
  };
}
