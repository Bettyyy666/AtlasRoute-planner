import { buildNodeIndex, haversineDistance, euclid, ensureTileLoaded } from "./tileUtils.js";
import { NodeId, DistanceMetric, FetchMode } from "./graphSchema.js";
import { getNeighbors, getTileKeyForNode, loadNeighborTiles } from "./lazyLoader.js";
import { preloadCorridorTiles, estimateCorridorTileCount } from "./corridorLoader.js";
import { touchTile, evictIfNeeded, markCorridorTiles } from "./cacheManager.js";
import { getCorridorTiles } from "./corridorLoader.js";
import { graphCache } from "../globalVariables.js";
import { ModeController } from "./graphModeController.js";
import { getHighwayFetchMode, setHighwayFetchMode, ensureTileLoaded as loadTileWithMode } from "./tileLoadingStrategy.js";

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

  // Build node index and get start/goal nodes
  let nodeIndex = buildNodeIndex();

  if (!nodeIndex[startId] || !nodeIndex[goalId]) {
    console.error("Start or goal node not found in graph");
    return [];
  }

  const startNode = nodeIndex[startId];
  const goalNode = nodeIndex[goalId];
  
  // Calculate initial distance and setup mode controller
  const straightLineDistance = haversineDistance(startNode.lat, startNode.lon, goalNode.lat, goalNode.lon);
  // More aggressive mode selection for long routes
  const initialMode: FetchMode = straightLineDistance >= 150_000 ? "backbone" :
                                straightLineDistance >= 50_000 ? "express" :
                                "detailed";
  console.log(`Initial mode: ${initialMode} for ${(straightLineDistance/1000).toFixed(1)}km route`);
  const modeCtl = new ModeController(initialMode);
  setHighwayFetchMode(initialMode);

  // Progress tracking variables
  let closestToGoal = straightLineDistance;
  let lastProgressIteration = 0;
  let stallsWithoutProgress = 0;
  let totalStallEvents = 0;
  let startGatewayFound = false;
  let goalGatewayFound = false;
  let stuckNearStartDetected = false;
  let edgePrefetchAttempts = 0;

  // Quick connectivity check: do start and goal have neighbors?
  let startHasNeighbors = false;
  let goalHasNeighbors = false;
  let startNeighborCount = 0;
  let goalNeighborCount = 0;

  for (const tile of Object.values(graphCache)) {
    if (tile.neighbors[startId]?.length > 0) {
      startHasNeighbors = true;
      startNeighborCount = tile.neighbors[startId].length;
    }
    if (tile.neighbors[goalId]?.length > 0) {
      goalHasNeighbors = true;
      goalNeighborCount = tile.neighbors[goalId].length;
    }
  }

  console.log(`  Start node ${startId} has ${startNeighborCount} neighbors`);
  console.log(`  Goal node ${goalId} has ${goalNeighborCount} neighbors`);

  if (!startHasNeighbors) {
    console.error(`⚠️  Start node ${startId} has NO neighbors - isolated node!`);
    return [];
  }
  if (!goalHasNeighbors) {
    console.error(`⚠️  Goal node ${goalId} has NO neighbors - isolated node!`);
    return [];
  }

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
  console.log(`  Estimated route: ${(straightLineDistance / 1000).toFixed(1)} km, ~${estimatedTileCount} tiles`);

  // Auto-enable corridor preloading for long routes with adaptive buffer
  const shouldPreload = enableCorridorPreload ?? (estimatedTileCount > 3);

  if (shouldPreload && estimatedTileCount > 0) {
    // Adaptive corridor buffer based on distance
    const bufferSize = straightLineDistance > 200_000 ? 3 :
                      straightLineDistance > 100_000 ? 2 : 1;
                      
    console.log(`  Preloading corridor tiles with ${bufferSize}x buffer...`);
    const corridorTileKeys = getCorridorTiles(
      startNode.lat, startNode.lon,
      goalNode.lat, goalNode.lon,
      bufferSize
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

  // Weighted A* heuristic (epsilon-admissible)
  // For long routes, bias toward goal more aggressively for faster search
  let heuristicWeight = 1.0;
  if (straightLineDistance > 400000) {
    heuristicWeight = 4.0; // 300% weight for >400km (very aggressive)
  } else if (straightLineDistance > 200000) {
    heuristicWeight = 3.0; // 200% weight for >200km (aggressive)
  } else if (straightLineDistance > 100000) {
    heuristicWeight = 2.0; // 100% weight for >100km
  } else if (straightLineDistance > 50000) {
    heuristicWeight = 1.5; // 50% weight for >50km
  } else if (straightLineDistance > 20000) {
    heuristicWeight = 1.3; // 30% weight for >20km
  } else if (straightLineDistance > 10000) {
    heuristicWeight = 1.1; // 10% weight for >10km
  }

  if (heuristicWeight > 1.0) {
    console.log(`  Heuristic weight: ${heuristicWeight}x (epsilon-admissible A*)`);
  }

  // Heuristic function using the provided distance metric (strategy pattern)
  const heuristic = (nodeId: NodeId): number => {
    const node = nodeIndex[nodeId];
    if (!node) return Infinity;
    return heuristicWeight * distanceMetric(node.lat, node.lon, goalNode.lat, goalNode.lon);
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
  // Adaptive iteration limit based on distance
  let maxIterations = 100000;
  if (straightLineDistance > 400000) {
    maxIterations = 10000000; // 10M for >400km (very long routes)
  } else if (straightLineDistance > 200000) {
    maxIterations = 5000000; // 5M for >200km (long routes like NY-Providence)
  } else if (straightLineDistance > 150000) {
    maxIterations = 3000000; // 3M for >150km
  } else if (straightLineDistance > 100000) {
    maxIterations = 2000000; // 2M for >100km
  } else if (straightLineDistance > 50000) {
    maxIterations = 1000000; // 1M for >50km
  } else if (straightLineDistance > 20000) {
    maxIterations = 500000; // 500k for >20km
  } else if (straightLineDistance > 10000) {
    maxIterations = 250000; // 250k for >10km (like NYC within-borough routes)
  }

  console.log(`  Max iterations: ${maxIterations.toLocaleString()} for ${(straightLineDistance / 1000).toFixed(1)} km route`);

  // A* main loop
  while (!openSet.isEmpty()) {
    const current = openSet.dequeue();
    if (!current) break;

    const currentId = current.id;
    iterations++;

    // Periodic cache management and progress logging
    // More frequent checks for long routes
    const checkInterval = straightLineDistance > 200000 ? 500 : 1000;
    if (iterations % checkInterval === 0) {
      evictIfNeeded();
      const elapsed = (Date.now() - startTime) / 1000;
      const currentMode = getHighwayFetchMode();
      console.log(`    A* iteration ${iterations}, explored ${closedSet.size} nodes (${elapsed.toFixed(1)}s), mode: ${currentMode}`);

      // Consider mode switch based on multiple metrics
      const explorationRate = closedSet.size / iterations;
      const node = nodeIndex[currentId];
      const dist = haversineDistance(node.lat, node.lon, goalNode.lat, goalNode.lon);
      const progress = 100 * (1 - (dist / straightLineDistance));

      // More aggressive mode switching conditions for long routes
      if ((iterations > 2500 && explorationRate < 0.2) || // Low exploration rate
          (iterations > 50000 && progress < 15) || // Stuck far from goal
          (iterations > 250000 && progress < 40)) { // Really stuck
        
        modeCtl.maybeSwitch({
          distToGoal: dist,
          stalls: totalStallEvents,
          progressPct: progress,
          tilesLoaded: Object.keys(graphCache).length,
          openSetSize: closedSet.size,
          gatewayStart: startGatewayFound,
          gatewayGoal: goalGatewayFound,
          stuckNearStart: stuckNearStartDetected,
          edgePrefetchAttempts: edgePrefetchAttempts
        });
        
        const newMode = modeCtl.current;
        if (getHighwayFetchMode() !== newMode) {
          setHighwayFetchMode(newMode);
          console.log(`    Switching to ${newMode} mode (progress: ${progress.toFixed(1)}%, exploration: ${(explorationRate*100).toFixed(1)}%)`);
        }
      }
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

    // Update progress metrics for mode switching
    const node = nodeIndex[currentId];
    const dist = haversineDistance(node.lat, node.lon, goalNode.lat, goalNode.lon);
    const progress = 100 * (1 - (dist / straightLineDistance));
    
    // Track mode switching metrics
    if (dist < closestToGoal) {
      closestToGoal = dist;
      lastProgressIteration = iterations;
      stallsWithoutProgress = 0;
    } else if (iterations - lastProgressIteration > 1000) {
      stallsWithoutProgress++;
      if (stallsWithoutProgress > 3) {
        totalStallEvents++;
        modeCtl.maybeSwitch({
          distToGoal: dist,
          stalls: totalStallEvents,
          progressPct: progress,
          tilesLoaded: Object.keys(graphCache).length,
          openSetSize: closedSet.size,
          gatewayStart: startGatewayFound,
          gatewayGoal: goalGatewayFound,
          stuckNearStart: stuckNearStartDetected,
          edgePrefetchAttempts: edgePrefetchAttempts
        });
        setHighwayFetchMode(modeCtl.current);
        stallsWithoutProgress = 0;
      }
    }

    for (const neighbor of neighbors) {
      const neighborId = neighbor.id;

      // Skip if already evaluated
      if (closedSet.has(neighborId)) continue;

      // Ensure neighbor node exists in index
      if (!nodeIndex[neighborId]) {
        // The neighbor is in an unloaded tile - we need to load it
        const node = nodeIndex[currentId];
        const currentTileKey = getTileKeyForNode(currentId, nodeIndex);
        edgePrefetchAttempts++;

        console.log(`  Neighbor ${neighborId} not in index, current node at ${currentTileKey}`);

        // First, try loading adjacent tiles based on current position
        await loadTileWithMode(currentTileKey); // Load with current mode

        // Rebuild node index after loading new tiles
        let updatedIndex = buildNodeIndex();
        Object.assign(nodeIndex, updatedIndex);

        // If still not found, try loading tiles in the direction of the goal
        if (!nodeIndex[neighborId]) {
          if (goalNode) {
            const dirToGoalLat = goalNode.lat > node.lat ? 1 : -1;
            const dirToGoalLng = goalNode.lon > node.lon ? 1 : -1;

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

  // No path found - check if nodes are in different connected components
  const elapsed = (Date.now() - startTime) / 1000;
  console.warn(`No path found from ${startId} to ${goalId} after ${iterations} iterations (${elapsed.toFixed(1)}s)`);

  // Diagnostic info
  console.warn(`  Explored ${closedSet.size} nodes out of ${Object.keys(nodeIndex).length} total nodes in graph`);
  const explorationPercent = (closedSet.size / Object.keys(nodeIndex).length * 100).toFixed(1);
  console.warn(`  Exploration: ${explorationPercent}% of loaded graph`);

  if (closedSet.size > 10000) {
    console.warn(`  ⚠️  Large exploration suggests graph may be disconnected at bridges/tunnels`);
    console.warn(`  💡 Try routes within the same borough, or check if road types include *_link roads`);
  }

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

