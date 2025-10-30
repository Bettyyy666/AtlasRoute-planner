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
 * Ensures that both the start and goal tiles are loaded before routing.
 */
async function ensureStartGoalTiles(points: { lat: number; lng: number }[]) {
  const start = points[0];
  const goal = points[points.length - 1];

  const startKey = tileKeyFromCoord(start.lat, start.lng, TILE_SIZE);
  const goalKey = tileKeyFromCoord(goal.lat, goal.lng, TILE_SIZE);

  await ensureTileLoaded(startKey);
  await ensureTileLoaded(goalKey);
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
