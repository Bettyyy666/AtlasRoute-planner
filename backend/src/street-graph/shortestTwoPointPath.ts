import { RoutingAlgorithm, DistanceMetric } from "./graphSchema.js";
import { graphCache, TILE_SIZE } from "../globalVariables.js";
import {
  buildNodeIndex,
  ensureTileLoaded,
  haversineDistance,
} from "./tileUtils.js";

/**
 * Handles a shortest-path request by:
 *  1. Making sure the tiles that contain the start and goal are loaded.
 *  2. Finding the nearest graph nodes to each input point.
 *  3. Calling the chosen routing algorithm.
 *  4. Converting the resulting node IDs into lat/lon pairs.
 *
 * @param points - Array of `{lat, lng}` points, first = start, last = goal
 * @param algorithm - A function implementing a routing algorithm (A*, Dijkstra, etc.)
 * @param distanceMetric - Optional custom distance metric for A* heuristic
 * @returns An object with a `path` array of `{lat, lng}` points to draw on a map.
 *
 *  STUDENT NOTES:
 * - This function doesn't know how A* works,
 *   it just delegates to the `algorithm` you pass in.
 * - Your `algorithm` function should take an array of node IDs (start + goal)
 *   and return an array of node IDs representing the path.
 */
export async function handleShortestPathRequest(
  points: { lat: number; lng: number }[],
  algorithm: RoutingAlgorithm,
  distanceMetric?: DistanceMetric
): Promise<{ path: { lat: number; lng: number }[] }> {
  // 1. Ensure tiles for start & goal are loaded into the graph cache
  await ensureStartGoalTiles(points);

  // 2. Find the nearest graph nodes to the requested points
  const nodes = points.map((p) => findNearestGraphNode(p));

  // 3. Call the routing algorithm (e.g., your A* implementation) with optional distance metric
  const pathIds = await algorithm(nodes as string[], distanceMetric);

  // 4. Build a fast lookup of nodes → coordinates
  const nodeIndex = buildNodeIndex();

  // 5. Convert the path node IDs to actual lat/lng coords for visualization
  const coords = pathIds.map((nodeId) => {
    const node = nodeIndex[nodeId];
    return { lat: node.lat, lng: node.lon };
  });

  return { path: coords };
}

/**
 * Compute the tile key from a lat/lng pair, given the tile size.
 * @param lat - Latitude
 * @param lng - Longitude
 * @param tileSize - Size of one tile (degrees)
 * @returns a string like `"123,456"` representing the tile indices
 */
export function tileKeyFromCoord(
  lat: number,
  lng: number,
  tileSize: number
): string {
  const latIdx = Math.floor(lat / tileSize);
  const lngIdx = Math.floor(lng / tileSize);
  return `${latIdx},${lngIdx}`;
}

/**
 * Ensures that all waypoint tiles AND connecting corridor tiles are loaded before routing.
 * This prevents A* from getting stuck at tile boundaries.
 */
async function ensureStartGoalTiles(points: { lat: number; lng: number }[]) {
  // Collect all unique tile keys for waypoints
  const waypointTiles = new Set<string>();
  for (const point of points) {
    const tileKey = tileKeyFromCoord(point.lat, point.lng, TILE_SIZE);
    waypointTiles.add(tileKey);
  }

  console.log(`Loading ${waypointTiles.size} waypoint tiles: ${Array.from(waypointTiles).join(', ')}`);

  // Load all waypoint tiles in parallel
  await Promise.all(
    Array.from(waypointTiles).map(key =>
      ensureTileLoaded(key).catch(err => {
        console.error(`Failed to load waypoint tile ${key}:`, err);
        throw err;
      })
    )
  );

  // For short routes (< 5 tiles apart), also preload connecting tiles
  // This prevents A* from missing paths that cross tile boundaries
  const start = points[0];
  const goal = points[points.length - 1];
  const startKey = tileKeyFromCoord(start.lat, start.lng, TILE_SIZE);
  const goalKey = tileKeyFromCoord(goal.lat, goal.lng, TILE_SIZE);

  const [startLat, startLng] = startKey.split(',').map(Number);
  const [goalLat, goalLng] = goalKey.split(',').map(Number);

  const latDistance = Math.abs(goalLat - startLat);
  const lngDistance = Math.abs(goalLng - startLng);
  const tileDistance = Math.max(latDistance, lngDistance);

  if (tileDistance > 0 && tileDistance < 5) {
    // Load corridor tiles between start and goal
    const corridorTiles = new Set<string>();

    const minLat = Math.min(startLat, goalLat);
    const maxLat = Math.max(startLat, goalLat);
    const minLng = Math.min(startLng, goalLng);
    const maxLng = Math.max(startLng, goalLng);

    // Load all tiles in the bounding box
    for (let lat = minLat; lat <= maxLat; lat++) {
      for (let lng = minLng; lng <= maxLng; lng++) {
        const key = `${lat},${lng}`;
        if (!waypointTiles.has(key)) {
          corridorTiles.add(key);
        }
      }
    }

    if (corridorTiles.size > 0) {
      console.log(`Loading ${corridorTiles.size} corridor tiles: ${Array.from(corridorTiles).join(', ')}`);
      await Promise.all(
        Array.from(corridorTiles).map(key =>
          ensureTileLoaded(key).catch(err => {
            console.warn(`Failed to load corridor tile ${key}:`, err);
            // Don't throw - corridor tiles are optional
          })
        )
      );
    }
  }

  console.log(`Total tiles loaded: ${Object.keys(graphCache).length}`);
}

/**
 * Find the nearest graph node to a given coordinate.
 *
 *  STUDENT NOTES:
 * - This is a brute-force search over all nodes currently in `graphCache`.
 * - For large graphs, you might want to implement a spatial index (e.g. KD-tree)
 *   for faster nearest-neighbor lookups, but this is good enough for now.
 *
 * @param pos - Object with `lat` and `lng`
 * @returns the closest node ID, or null if no nodes are available
 */
export function findNearestGraphNode(pos: {
  lat: number;
  lng: number;
}): string | null {
  let closestNodeId: string | null = null;
  let minDist = Infinity;

  for (const tileData of Object.values(graphCache)) {
    for (const node of tileData.nodes) {
      const dist = haversineDistance(pos.lat, pos.lng, node.lat, node.lon);
      if (dist < minDist) {
        minDist = dist;
        closestNodeId = node.id;
      }
    }
  }

  return closestNodeId;
}
