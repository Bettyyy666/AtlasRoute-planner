import { buildNodeIndex, haversineDistance, euclid, ensureTileLoaded } from "./tileUtils.js";
import { NodeId, DistanceMetric } from "./graphSchema.js";
import { getNeighbors, getTileKeyForNode, loadNeighborTiles } from "./lazyLoader.js";
import { preloadCorridorTiles, estimateCorridorTileCount } from "./corridorLoader.js";
import { touchTile, evictIfNeeded, markCorridorTiles } from "./cacheManager.js";
import { getCorridorTiles } from "./corridorLoader.js";

// Re-export haversineDistance so callers can use it as a distance metric
export { haversineDistance };

/**
 * Simple priority queue implementation using a min-heap.
 */
class PriorityQueue {
  private heap: { id: NodeId; priority: number }[] = [];

  enqueue(id: NodeId, priority: number): void {
    this.heap.push({ id, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  dequeue(): { id: NodeId; priority: number } | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();

    const min = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);
    return min;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[index].priority >= this.heap[parentIndex].priority) break;
      [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      let minIndex = index;
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;

      if (leftChild < this.heap.length && this.heap[leftChild].priority < this.heap[minIndex].priority) {
        minIndex = leftChild;
      }
      if (rightChild < this.heap.length && this.heap[rightChild].priority < this.heap[minIndex].priority) {
        minIndex = rightChild;
      }
      if (minIndex === index) break;

      [this.heap[index], this.heap[minIndex]] = [this.heap[minIndex], this.heap[index]];
      index = minIndex;
    }
  }
}


/**
 * aStarWithOnDemandTiles
 *
 * Enhanced A* pathfinding with corridor-based preloading and cache management.
 * Optimized for long-distance routes (up to 250 miles).
 *
 * @param nodeIds - An array of node IDs that represent the path goals.
 *                  The first ID is the start node, the last ID is the goal node.
 * @param distanceMetric - Optional custom distance metric function.
 *                         Defaults to Euclidean distance.
 *                         Can be set to haversineDistance for more accurate geographic distances.
 * @param enableCorridorPreload - Whether to preload tiles along the corridor (default: true for routes > 5 tiles)
 *
 * Features:
 * - Corridor-based tile preloading for long-distance routes
 * - LRU cache management to prevent memory exhaustion
 * - Progress tracking and timeout handling
 * - Automatic detection of long-distance routes
 *
 * @returns A Promise that resolves to an array of node IDs representing the final path.
 */
export async function aStarWithOnDemandTiles(
  nodeIds: string[],
  distanceMetric: DistanceMetric = euclid, // or haversineDistance
  enableCorridorPreload?: boolean
): Promise<string[]> {
  if (nodeIds.length < 2) {
    console.warn("Need at least start and goal nodes");
    return nodeIds;
  }

  const startTime = Date.now();
  const startId = nodeIds[0];
  const goalId = nodeIds[nodeIds.length - 1];

  // Build node index for fast lookups
  let nodeIndex = buildNodeIndex();

  if (!nodeIndex[startId] || !nodeIndex[goalId]) {
    console.error("Start or goal node not found in graph");
    return [];
  }

  const startNode = nodeIndex[startId];
  const goalNode = nodeIndex[goalId];

  // Log which distance metric is being used
  const metricName = distanceMetric === euclid ? "Euclidean" :
                     distanceMetric === haversineDistance ? "Haversine" : "Custom";
  console.log(`A* using ${metricName} distance metric for pathfinding from ${startId} to ${goalId}`);

  // Estimate route distance and tile count
  const estimatedTileCount = estimateCorridorTileCount(
    startNode.lat, startNode.lon,
    goalNode.lat, goalNode.lon,
    1 // buffer
  );
  const straightLineDistance = haversineDistance(startNode.lat, startNode.lon, goalNode.lat, goalNode.lon);
  console.log(`  Estimated route: ${(straightLineDistance / 1000).toFixed(1)} km, ~${estimatedTileCount} tiles`);

  // Auto-enable corridor preloading for long routes (> 5 tiles)
  const shouldPreload = enableCorridorPreload ?? (estimatedTileCount > 5);

  if (shouldPreload && estimatedTileCount > 0) {
    console.log(`  Preloading corridor tiles...`);
    const corridorTileKeys = getCorridorTiles(
      startNode.lat, startNode.lon,
      goalNode.lat, goalNode.lon,
      1 // buffer
    );
    markCorridorTiles(corridorTileKeys);

    await preloadCorridorTiles(
      startNode.lat, startNode.lon,
      goalNode.lat, goalNode.lon,
      1, // buffer
      3, // batch size
      (loaded, total) => {
        const elapsed = (Date.now() - startTime) / 1000;
        console.log(`    Loaded ${loaded}/${total} tiles (${elapsed.toFixed(1)}s)`);
      }
    );

    // Rebuild node index after preloading
    nodeIndex = buildNodeIndex();

    if (!nodeIndex[startId] || !nodeIndex[goalId]) {
      console.error("Start or goal node not found after corridor preload");
      return [];
    }
  }

  // Mark start and goal tiles as critical (never evict)
  touchTile(getTileKeyForNode(startId, nodeIndex), 2);
  touchTile(getTileKeyForNode(goalId, nodeIndex), 2);

  // Heuristic function using the provided distance metric (strategy pattern)
  const heuristic = (nodeId: NodeId): number => {
    const node = nodeIndex[nodeId];
    if (!node) return Infinity;
    return distanceMetric(node.lat, node.lon, goalNode.lat, goalNode.lon);
  };

  // Initialize data structures
  const openSet = new PriorityQueue();
  const closedSet = new Set<NodeId>();
  const gScore = new Map<NodeId, number>();
  const fScore = new Map<NodeId, number>();
  const cameFrom = new Map<NodeId, NodeId>();

  // Initialize start node
  gScore.set(startId, 0);
  fScore.set(startId, heuristic(startId));
  openSet.enqueue(startId, fScore.get(startId)!);

  let iterations = 0;
  const maxIterations = 100000; // Safety limit for long routes

  // A* main loop
  while (!openSet.isEmpty()) {
    const current = openSet.dequeue();
    if (!current) break;

    const currentId = current.id;
    iterations++;

    // Periodic cache management and progress logging
    if (iterations % 1000 === 0) {
      evictIfNeeded();
      const elapsed = (Date.now() - startTime) / 1000;
      console.log(`    A* iteration ${iterations}, explored ${closedSet.size} nodes (${elapsed.toFixed(1)}s)`);
    }

    // Safety limit
    if (iterations > maxIterations) {
      console.warn(`A* exceeded max iterations (${maxIterations})`);
      break;
    }

    // Goal reached - reconstruct path
    if (currentId === goalId) {
      const path = reconstructPath(cameFrom, currentId);
      console.log(`  A* found path with ${path.length} nodes, explored ${closedSet.size} nodes`);
      return path;
    }

    closedSet.add(currentId);

    // Get neighbors (with lazy tile loading)
    const neighbors = await getNeighbors(currentId, nodeIndex);

    for (const neighbor of neighbors) {
      const neighborId = neighbor.id;

      // Skip if already evaluated
      if (closedSet.has(neighborId)) continue;

      // Ensure neighbor node exists in index
      if (!nodeIndex[neighborId]) {
        // The neighbor is in an unloaded tile - we need to load it
        const currentNode = nodeIndex[currentId];
        const currentTileKey = getTileKeyForNode(currentId, nodeIndex);

        console.log(`  Neighbor ${neighborId} not in index, current node at ${currentTileKey}`);

        // First, try loading adjacent tiles based on current position
        await loadNeighborTiles(currentNode.lat, currentNode.lon, currentTileKey);

        // Rebuild node index after loading new tiles
        let updatedIndex = buildNodeIndex();
        Object.assign(nodeIndex, updatedIndex);

        // If still not found, try loading tiles in the direction of the goal
        if (!nodeIndex[neighborId]) {
          const goalNode = nodeIndex[goalId];
          if (goalNode) {
            const dirToGoalLat = goalNode.lat > currentNode.lat ? 1 : -1;
            const dirToGoalLng = goalNode.lon > currentNode.lon ? 1 : -1;

            const [i, j] = currentTileKey.split(',').map(Number);
            const extraTilesToLoad = [
              `${i + dirToGoalLat},${j}`,
              `${i},${j + dirToGoalLng}`,
              `${i + dirToGoalLat},${j + dirToGoalLng}`
            ];

            console.log(`  Loading extra tiles toward goal: ${extraTilesToLoad.join(', ')}`);
            await Promise.allSettled(
              extraTilesToLoad.map(key =>
                ensureTileLoaded(key).catch(err => {
                  console.warn(`Failed to load tile ${key}:`, err);
                })
              )
            );

            updatedIndex = buildNodeIndex();
            Object.assign(nodeIndex, updatedIndex);
          }

          if (!nodeIndex[neighborId]) {
            console.warn(`  Neighbor ${neighborId} still not found after extra loading - skipping`);
            continue;
          }
        }
      }

      // Calculate tentative g score
      const tentativeG = gScore.get(currentId)! + neighbor.weight;

      // If this path to neighbor is better than any previous one
      if (!gScore.has(neighborId) || tentativeG < gScore.get(neighborId)!) {
        cameFrom.set(neighborId, currentId);
        gScore.set(neighborId, tentativeG);
        const f = tentativeG + heuristic(neighborId);
        fScore.set(neighborId, f);
        openSet.enqueue(neighborId, f);

        // Track tile access for cache management
        touchTile(getTileKeyForNode(neighborId, nodeIndex), 0);
      }
    }
  }

  // No path found
  const elapsed = (Date.now() - startTime) / 1000;
  console.warn(`No path found from ${startId} to ${goalId} after ${iterations} iterations (${elapsed.toFixed(1)}s)`);
  return [];
}


/**
 * Reconstruct the path from start to goal using the cameFrom map.
 */
function reconstructPath(cameFrom: Map<NodeId, NodeId>, current: NodeId): NodeId[] {
  const path: NodeId[] = [current];
  while (cameFrom.has(current)) {
    current = cameFrom.get(current)!;
    path.unshift(current);
  }
  return path;
}

