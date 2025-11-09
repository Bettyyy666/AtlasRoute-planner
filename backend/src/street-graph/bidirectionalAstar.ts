import { buildNodeIndex, haversineDistance, euclid } from "./tileUtils.js";
import { NodeId, DistanceMetric } from "./graphSchema.js";
import { getNeighbors, getTileKeyForNode, loadNeighborTiles } from "./lazyLoader.js";
import { preloadCorridorTiles } from "./corridorLoader.js";
import { touchTile, evictIfNeeded, markCorridorTiles } from "./cacheManager.js";
import { getCorridorTiles } from "./corridorLoader.js";

/**
 * Bidirectional A* for long-distance routing.
 *
 * For routes spanning 250 miles, traditional A* may explore tens of thousands
 * of nodes. Bidirectional search runs two simultaneous searches:
 * - Forward: from start toward goal
 * - Backward: from goal toward start
 *
 * When the searches meet, we've found the shortest path. This typically
 * explores only half as many nodes as unidirectional search.
 *
 * This implementation also integrates:
 * - Corridor-based tile preloading
 * - LRU cache management
 * - Progress tracking
 * - Timeout handling
 */

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
 * Bidirectional A* with corridor preloading and cache management.
 *
 * @param nodeIds - Array with start and goal node IDs
 * @param distanceMetric - Distance function for heuristic
 * @param timeoutMs - Maximum time to search (default: 120 seconds for long routes)
 * @param onProgress - Optional callback for progress updates
 * @returns Array of node IDs representing the path, or [] if no path found
 */
export async function bidirectionalAstar(
  nodeIds: string[],
  distanceMetric: DistanceMetric = haversineDistance,
  timeoutMs: number = 120000,
  onProgress?: (forward: number, backward: number, elapsed: number) => void
): Promise<string[]> {
  if (nodeIds.length < 2) {
    console.warn("Need at least start and goal nodes");
    return nodeIds;
  }

  const startTime = Date.now();
  const startId = nodeIds[0];
  const goalId = nodeIds[nodeIds.length - 1];

  // Build node index
  let nodeIndex = buildNodeIndex();

  if (!nodeIndex[startId] || !nodeIndex[goalId]) {
    console.error("Start or goal node not found in graph");
    return [];
  }

  const startNode = nodeIndex[startId];
  const goalNode = nodeIndex[goalId];

  const metricName = distanceMetric === euclid ? "Euclidean" :
                     distanceMetric === haversineDistance ? "Haversine" : "Custom";
  console.log(`Bidirectional A* using ${metricName} from ${startId} to ${goalId}`);

  // Preload corridor tiles with larger buffer to capture bridges and highways
  // For long-distance routes, we need a wider corridor to find major roads
  const straightMeters = haversineDistance(startNode.lat, startNode.lon, goalNode.lat, goalNode.lon);
  const corridorBuffer = straightMeters > 20000 ? 5 : 3; // 5 tiles for >20km routes, 3 otherwise

  const corridorTileKeys = getCorridorTiles(
    startNode.lat, startNode.lon,
    goalNode.lat, goalNode.lon,
    corridorBuffer
  );
  markCorridorTiles(corridorTileKeys);

  console.log(`Preloading ${corridorTileKeys.length} corridor tiles (buffer: ${corridorBuffer})...`);
  await preloadCorridorTiles(
    startNode.lat, startNode.lon,
    goalNode.lat, goalNode.lon,
    corridorBuffer,
    5, // batch size increased from 3 to 5
    (loaded, total) => {
      const elapsed = (Date.now() - startTime) / 1000;
      console.log(`  Loaded ${loaded}/${total} tiles (${elapsed.toFixed(1)}s)`);
    }
  );

  // Rebuild node index after preloading
  nodeIndex = buildNodeIndex();

  if (!nodeIndex[startId] || !nodeIndex[goalId]) {
    console.error("Start or goal node not found after corridor preload");
    return [];
  }

  // Forward search (start → goal)
  const fwdOpenSet = new PriorityQueue();
  const fwdClosedSet = new Set<NodeId>();
  const fwdGScore = new Map<NodeId, number>();
  const fwdCameFrom = new Map<NodeId, NodeId>();

  // Backward search (goal → start)
  const bwdOpenSet = new PriorityQueue();
  const bwdClosedSet = new Set<NodeId>();
  const bwdGScore = new Map<NodeId, number>();
  const bwdCameFrom = new Map<NodeId, NodeId>();

  // Heuristic for forward search
  const fwdHeuristic = (nodeId: NodeId): number => {
    const node = nodeIndex[nodeId];
    if (!node) return Infinity;
    return distanceMetric(node.lat, node.lon, goalNode.lat, goalNode.lon);
  };

  // Heuristic for backward search
  const bwdHeuristic = (nodeId: NodeId): number => {
    const node = nodeIndex[nodeId];
    if (!node) return Infinity;
    return distanceMetric(node.lat, node.lon, startNode.lat, startNode.lon);
  };

  // Initialize both searches
  fwdGScore.set(startId, 0);
  fwdOpenSet.enqueue(startId, fwdHeuristic(startId));
  touchTile(getTileKeyForNode(startId, nodeIndex), 2); // Priority 2 (critical)

  bwdGScore.set(goalId, 0);
  bwdOpenSet.enqueue(goalId, bwdHeuristic(goalId));
  touchTile(getTileKeyForNode(goalId, nodeIndex), 2);

  // Best meeting point found so far
  let bestMeetingPoint: NodeId | null = null;
  let bestTotalCost = Infinity;

  let iterations = 0;
  // Increase iteration limit for long-distance routes (>20km need more iterations)
  const maxIterations = straightMeters > 20000 ? 500000 : 100000;

  // Alternating bidirectional search
  while (!fwdOpenSet.isEmpty() && !bwdOpenSet.isEmpty() && iterations < maxIterations) {
    iterations++;

    // Check timeout
    const elapsed = Date.now() - startTime;
    if (elapsed > timeoutMs) {
      console.warn(`Timeout after ${(elapsed / 1000).toFixed(1)}s, ${iterations} iterations`);
      break;
    }

    // Progress callback every 1000 iterations
    if (iterations % 1000 === 0) {
      evictIfNeeded(); // Periodic cache cleanup
      if (onProgress) {
        onProgress(fwdClosedSet.size, bwdClosedSet.size, elapsed / 1000);
      }
    }

    // Alternate between forward and backward search
    const isForward = iterations % 2 === 0;

    if (isForward) {
      // Forward step
      const current = fwdOpenSet.dequeue();
      if (!current) break;
      const currentId = current.id;

      // Check if backward search has reached this node
      if (bwdClosedSet.has(currentId)) {
        const totalCost = fwdGScore.get(currentId)! + bwdGScore.get(currentId)!;
        if (totalCost < bestTotalCost) {
          bestTotalCost = totalCost;
          bestMeetingPoint = currentId;
        }
      }

      fwdClosedSet.add(currentId);

      // Explore neighbors
      const neighbors = await getNeighbors(currentId, nodeIndex);

      for (const neighbor of neighbors) {
        const neighborId = neighbor.id;

        if (fwdClosedSet.has(neighborId)) continue;

        // Ensure neighbor exists
        if (!nodeIndex[neighborId]) {
          const currentNode = nodeIndex[currentId];
          const currentTileKey = getTileKeyForNode(currentId, nodeIndex);
          await loadNeighborTiles(currentNode.lat, currentNode.lon, currentTileKey);

          const updatedIndex = buildNodeIndex();
          Object.assign(nodeIndex, updatedIndex);

          if (!nodeIndex[neighborId]) {
            continue;
          }
        }

        const tentativeG = fwdGScore.get(currentId)! + neighbor.weight;

        if (!fwdGScore.has(neighborId) || tentativeG < fwdGScore.get(neighborId)!) {
          fwdCameFrom.set(neighborId, currentId);
          fwdGScore.set(neighborId, tentativeG);
          const f = tentativeG + fwdHeuristic(neighborId);
          fwdOpenSet.enqueue(neighborId, f);

          touchTile(getTileKeyForNode(neighborId, nodeIndex), 0);
        }
      }
    } else {
      // Backward step (same logic, reversed)
      const current = bwdOpenSet.dequeue();
      if (!current) break;
      const currentId = current.id;

      if (fwdClosedSet.has(currentId)) {
        const totalCost = fwdGScore.get(currentId)! + bwdGScore.get(currentId)!;
        if (totalCost < bestTotalCost) {
          bestTotalCost = totalCost;
          bestMeetingPoint = currentId;
        }
      }

      bwdClosedSet.add(currentId);

      const neighbors = await getNeighbors(currentId, nodeIndex);

      for (const neighbor of neighbors) {
        const neighborId = neighbor.id;

        if (bwdClosedSet.has(neighborId)) continue;

        if (!nodeIndex[neighborId]) {
          const currentNode = nodeIndex[currentId];
          const currentTileKey = getTileKeyForNode(currentId, nodeIndex);
          await loadNeighborTiles(currentNode.lat, currentNode.lon, currentTileKey);

          const updatedIndex = buildNodeIndex();
          Object.assign(nodeIndex, updatedIndex);

          if (!nodeIndex[neighborId]) {
            continue;
          }
        }

        const tentativeG = bwdGScore.get(currentId)! + neighbor.weight;

        if (!bwdGScore.has(neighborId) || tentativeG < bwdGScore.get(neighborId)!) {
          bwdCameFrom.set(neighborId, currentId);
          bwdGScore.set(neighborId, tentativeG);
          const f = tentativeG + bwdHeuristic(neighborId);
          bwdOpenSet.enqueue(neighborId, f);

          touchTile(getTileKeyForNode(neighborId, nodeIndex), 0);
        }
      }
    }
  }

  // Reconstruct path through meeting point
  if (bestMeetingPoint) {
    const fwdPath = reconstructPath(fwdCameFrom, bestMeetingPoint);
    const bwdPath = reconstructPath(bwdCameFrom, bestMeetingPoint);
    bwdPath.shift(); // Remove duplicate meeting point
    const fullPath = [...fwdPath, ...bwdPath.reverse()];

    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`  Bidirectional A* found path: ${fullPath.length} nodes, ${iterations} iterations, ${elapsed.toFixed(1)}s`);
    console.log(`  Explored: ${fwdClosedSet.size} forward, ${bwdClosedSet.size} backward`);

    return fullPath;
  }

  console.warn(`No path found after ${iterations} iterations`);
  return [];
}

/**
 * Reconstruct path from cameFrom map.
 */
function reconstructPath(cameFrom: Map<NodeId, NodeId>, current: NodeId): NodeId[] {
  const path: NodeId[] = [current];
  while (cameFrom.has(current)) {
    current = cameFrom.get(current)!;
    path.unshift(current);
  }
  return path;
}
