import { buildNodeIndex, haversineDistance, euclid } from "./tileUtils.js";
import { NodeId, DistanceMetric } from "./graphSchema.js";
import { getNeighbors, getTileKeyForNode, loadNeighborTiles } from "./lazyLoader.js";

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
 * Implement the A* pathfinding algorithm with strategy pattern for distance metrics.
 *
 * @param nodeIds - An array of node IDs that represent the path goals.
 *                  The first ID is the start node, the last ID is the goal node.
 * @param distanceMetric - Optional custom distance metric function.
 *                         Defaults to Euclidean distance.
 *                         Can be set to haversineDistance for more accurate geographic distances.
 *
 * Your task:
 * 1. Implement A* search to find the shortest path from the start node to the goal node (within a tile for Sprint 7).
 * 2. Use the provided graph/tile-loading utilities to:
 *    - Fetch neighbors for the current node.
 * 3. Once the goal is reached, reconstruct the path and return an array of node IDs
 *    representing the shortest path.
 *
 * Tips:
 * - Use a priority queue (min-heap) for selecting the next node with the lowest fScore.
 * - Define a good heuristic function (e.g., Euclidean distance or Haversine distance).
 * - Handle lazy tile loading when exploring neighbors that are in unloaded tiles.
 *
 * @returns A Promise that resolves to an array of node IDs representing the final path.
 */
export async function aStarWithOnDemandTiles(
  nodeIds: string[],
  distanceMetric: DistanceMetric = euclid // or haversineDistance
): Promise<string[]> {
  if (nodeIds.length < 2) {
    console.warn("Need at least start and goal nodes");
    return nodeIds;
  }

  const startId = nodeIds[0];
  const goalId = nodeIds[nodeIds.length - 1];

  // Build node index for fast lookups
  const nodeIndex = buildNodeIndex();

  if (!nodeIndex[startId] || !nodeIndex[goalId]) {
    console.error("Start or goal node not found in graph");
    return [];
  }

  const startNode = nodeIndex[startId];
  const goalNode = nodeIndex[goalId];

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

  // A* main loop
  while (!openSet.isEmpty()) {
    const current = openSet.dequeue();
    if (!current) break;

    const currentId = current.id;

    // Goal reached - reconstruct path
    if (currentId === goalId) {
      return reconstructPath(cameFrom, currentId);
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
        // Try to load the tile containing this neighbor
        const currentNode = nodeIndex[currentId];
        const currentTileKey = getTileKeyForNode(currentId, nodeIndex);
        await loadNeighborTiles(currentNode.lat, currentNode.lon, currentTileKey);

        // Rebuild node index after loading new tiles
        const updatedIndex = buildNodeIndex();
        Object.assign(nodeIndex, updatedIndex);

        if (!nodeIndex[neighborId]) {
          console.warn(`Neighbor node ${neighborId} not found after tile loading`);
          continue;
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
      }
    }
  }

  // No path found
  console.warn(`No path found from ${startId} to ${goalId}`);
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

