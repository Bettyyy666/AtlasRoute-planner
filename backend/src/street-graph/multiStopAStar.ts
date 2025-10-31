import { aStarWithOnDemandTiles } from "./Astar.js";
import { DistanceMetric } from "./graphSchema.js";
export type NodeId = string;

/**
 * Plan a route that visits multiple stops in order.
 *
 *   STUDENT NOTES:
 * - You are given an array of node IDs to visit, in order.
 * - You already wrote A* for two points, now think about how to
 *   reuse it to handle many points.
 *
 * @param nodeIds - ordered list of node IDs to route through
 * @param distanceMetric - optional custom distance metric for A* heuristic
 * @returns a full path visiting each stop, as an array of node IDs
 */
export async function routeThroughStops(
  nodeIds: NodeId[],
  distanceMetric?: DistanceMetric
): Promise<NodeId[]> {
  // Handle edge cases
  if (nodeIds.length === 0) {
    return [];
  }

  if (nodeIds.length === 1) {
    return nodeIds;
  }

  if (nodeIds.length === 2) {
    // Just run A* once for two nodes
    return await aStarWithOnDemandTiles(nodeIds, distanceMetric);
  }

  // For multiple stops, route through each consecutive pair
  const fullPath: NodeId[] = [];

  for (let i = 0; i < nodeIds.length - 1; i++) {
    const start = nodeIds[i];
    const end = nodeIds[i + 1];

    // Find path between this pair
    const segmentPath = await aStarWithOnDemandTiles([start, end], distanceMetric);

    if (segmentPath.length === 0) {
      console.warn(`No path found between ${start} and ${end}`);
      // If we can't find a path to the next stop, return what we have so far
      return fullPath.length > 0 ? fullPath : [];
    }

    // Add this segment to the full path
    if (fullPath.length === 0) {
      // First segment - add all nodes
      fullPath.push(...segmentPath);
    } else {
      // Subsequent segments - skip the first node (it's the same as the last node of previous segment)
      fullPath.push(...segmentPath.slice(1));
    }
  }

  return fullPath;
}
