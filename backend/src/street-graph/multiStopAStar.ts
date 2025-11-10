import { aStarWithOnDemandTiles } from "./Astar.js";
import { DistanceMetric } from "./graphSchema.js";
import { getCorridorTiles } from "./corridorLoader.js";
import { buildNodeIndex, ensureTileLoaded, haversineDistance } from "./tileUtils.js";
import { markCorridorTiles, consumeEvictedTiles, getCacheStats, holdTilesCritical, restoreTilePriorities, evictIfNeeded } from "./cacheManager.js";
import { graphCache } from "../globalVariables.js";
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
    // For 2-point routes
    const nodeIndex = buildNodeIndex();
    const start = nodeIndex[nodeIds[0]];
    const goal = nodeIndex[nodeIds[1]];

    if (start && goal) {
      const straightMeters = haversineDistance(start.lat, start.lon, goal.lat, goal.lon);
      const straightKm = straightMeters / 1000;
      console.log(`2-point route: finding path for ${straightKm.toFixed(1)} km route`);
    }
    return await aStarWithOnDemandTiles(nodeIds, distanceMetric);
  }

  // For multiple stops, route through each consecutive pair
  const fullPath: NodeId[] = [];

  // --- Stitching / preloading across multiple segments ---
  // Preload/mark the union of corridor tiles for all consecutive pairs so
  // the separate A* calls operate on a connected graph. This reduces the
  // chance that the per-segment corridor loading produces disjoint graphs.
  let prevPrioritiesToRestore: Record<string, number> | undefined;

  try {
    const nodeIndex = buildNodeIndex();
    const corridorSet = new Set<string>();

    for (let i = 0; i < nodeIds.length - 1; i++) {
      const a = nodeIndex[nodeIds[i]];
      const b = nodeIndex[nodeIds[i + 1]];
      if (!a || !b) continue;
      // Adaptive corridor buffer based on segment distance
      // Reduced buffer sizes for faster loading when Overpass is overloaded
      const segmentDist = haversineDistance(a.lat, a.lon, b.lat, b.lon);
      let bufferSize = 2;
      if (segmentDist > 150000) {
        bufferSize = 4; // 4 tiles for >150km (reduced from 7 for API overload)
      } else if (segmentDist > 100000) {
        bufferSize = 4; // 4 tiles for >100km (reduced from 6)
      } else if (segmentDist > 50000) {
        bufferSize = 3; // 3 tiles for >50km (reduced from 5)
      } else if (segmentDist > 20000) {
        bufferSize = 3; // 3 tiles for >20km (reduced from 4)
      }
      const keys = getCorridorTiles(a.lat, a.lon, b.lat, b.lon, bufferSize);
      for (const k of keys) corridorSet.add(k);
    }

    if (corridorSet.size > 0) {
      const keys = Array.from(corridorSet);
      console.log(`Preloading union of corridor tiles (${keys.length} tiles with adaptive buffer)`);

      // Report cache stats before preload
      console.log("Cache before stitching preload:", getCacheStats());

      // Mark corridor tiles to raise their retention priority (but not critical)
      // For very long routes, marking all tiles as critical causes OOM
      markCorridorTiles(keys);

      // Only mark start/goal tiles as critical to prevent eviction
      // Let other corridor tiles be evictable if memory pressure is high
      const startTileKey = Object.keys(graphCache).find(k =>
        graphCache[k].nodes.some(n => n.id === nodeIds[0])
      );
      const endTileKey = Object.keys(graphCache).find(k =>
        graphCache[k].nodes.some(n => n.id === nodeIds[nodeIds.length - 1])
      );

      const criticalTiles = [startTileKey, endTileKey].filter(Boolean) as string[];
      if (criticalTiles.length > 0) {
        prevPrioritiesToRestore = holdTilesCritical(criticalTiles);
        console.log(`Marked ${criticalTiles.length} start/goal tiles as critical (not all ${keys.length} corridor tiles)`);
      }

      // Load in batches to avoid overwhelming the tile queue
      // Larger batches for better parallelization
      const batchSize = 10;
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        await Promise.allSettled(
          batch.map((k) => ensureTileLoaded(k).catch(() => undefined))
        );

        // Aggressively evict non-critical tiles every 50 tiles for memory management
        if (i % 50 === 0 && i > 0) {
          evictIfNeeded();
        }
      }
      // Report cache stats and any evicted tiles after preload
      console.log("Cache after stitching preload:", getCacheStats());
      const evictedAfterPreload = consumeEvictedTiles();
      if (evictedAfterPreload.length > 0) {
        console.warn(`Tiles evicted during preload (${evictedAfterPreload.length}): ${evictedAfterPreload.join(', ')}`);
      }

      // Verify neighbor references across loaded tiles: any neighbor IDs
      // that point to nodes not present in the current node index indicate
      // possible boundary / stitching issues.
      const nodeIndexAfter = buildNodeIndex();
      const missingNeighborMap: Record<string, string[]> = {};
      for (const [tileKey, tile] of Object.entries(graphCache)) {
        for (const fromId of Object.keys(tile.neighbors || {})) {
          for (const nbr of tile.neighbors[fromId]) {
            if (!nodeIndexAfter[nbr.id]) {
              (missingNeighborMap[tileKey] ??= []).push(`${fromId}->${nbr.id}`);
            }
          }
        }
      }
      const missingCount = Object.values(missingNeighborMap).reduce((s, a) => s + a.length, 0);
      if (missingCount > 0) {
        console.warn(`Detected ${missingCount} neighbor references to missing nodes after preload. Sample (per tile):`);
        for (const k of Object.keys(missingNeighborMap).slice(0, 10)) {
          console.warn(`  ${k}: ${missingNeighborMap[k].slice(0,20).join(', ')}`);
        }
      } else {
        console.log("No missing neighbor references detected after stitching preload.");
      }
    }
  } catch (e) {
    // If stitching fails for any reason, we still proceed with per-segment A*
    console.warn("Stitching/preload failed:", e);
  }

  for (let i = 0; i < nodeIds.length - 1; i++) {
    const start = nodeIds[i];
    const end = nodeIds[i + 1];

    // Rebuild node index to get up-to-date coordinates
    const nodeIndexNow = buildNodeIndex();
    const sNode = nodeIndexNow[start];
    const eNode = nodeIndexNow[end];

    // Choose routing algorithm based on segment distance
    let segmentPath: string[] = [];
    if (sNode && eNode) {
      const straightMeters = haversineDistance(sNode.lat, sNode.lon, eNode.lat, eNode.lon);
      const straightKm = straightMeters / 1000;

      console.log(`Segment ${i + 1}/${nodeIds.length - 1}: finding path for ${straightKm.toFixed(1)} km segment`);
      segmentPath = await aStarWithOnDemandTiles([start, end], distanceMetric);
    } else {
      // Fallback if node coords unavailable
      console.log(`Segment ${i + 1}/${nodeIds.length - 1}: finding path (distance unknown)`);
      segmentPath = await aStarWithOnDemandTiles([start, end], distanceMetric);
    }

    if (segmentPath.length === 0) {
      console.warn(`No path found between ${start} and ${end}`);
      // If we can't find a path to the next stop, return what we have so far
      return fullPath.length > 0 ? fullPath : [];
    }

    // Report any tiles evicted while computing this segment
    const evictedDuringSegment = consumeEvictedTiles();
    if (evictedDuringSegment.length > 0) {
      console.warn(`Tiles evicted during segment ${i + 1}/${nodeIds.length - 1} (${evictedDuringSegment.length}): ${evictedDuringSegment.join(', ')}`);
    }

    // Add this segment to the full path
    if (fullPath.length === 0) {
      // First segment - add all nodes
      fullPath.push(...segmentPath);
    } else {
      // Subsequent segments - skip the first node (it's the same as the last node of previous segment)
      fullPath.push(...segmentPath.slice(1));
    }

    // Add diagnostics to validate graph connectivity for the second segment
    if (i === 0) {
      const isConnected = validateGraphConnectivity(start, end);
      if (!isConnected) {
        console.warn(`Graph connectivity validation failed between ${start} and ${end}`);
        return fullPath.length > 0 ? fullPath : [];
      }
    }
  }

  // Attempt to restore priorities (if we set them earlier)
  try {
    if (typeof prevPrioritiesToRestore !== "undefined") {
      restoreTilePriorities(prevPrioritiesToRestore);
      console.log("Restored tile priorities after routing");
    }
  } catch (e) {
    console.warn("Failed to restore tile priorities:", e);
  }

  return fullPath;
}

// Add diagnostics to validate graph connectivity for the second segment
function validateGraphConnectivity(startNodeId: string, goalNodeId: string): boolean {
  const nodeIndex = buildNodeIndex();
  const startNode = nodeIndex[startNodeId];
  const goalNode = nodeIndex[goalNodeId];

  if (!startNode || !goalNode) {
    console.warn(`Start or goal node not found in the graph. Start: ${startNodeId}, Goal: ${goalNodeId}`);
    return false;
  }

  // Build neighbor lookup map from all tiles for efficient access
  const neighborMap: Record<string, Array<{ id: string; weight: number }>> = {};
  for (const tile of Object.values(graphCache)) {
    if (tile.neighbors) {
      for (const [nodeId, neighbors] of Object.entries(tile.neighbors)) {
        neighborMap[nodeId] = neighbors;
      }
    }
  }

  const visited = new Set<string>();
  const stack: string[] = [startNodeId];

  while (stack.length > 0) {
    const currentNodeId = stack.pop();
    if (!currentNodeId) continue;

    if (currentNodeId === goalNodeId) {
      console.log(`Start and goal nodes are connected.`);
      return true;
    }

    if (!visited.has(currentNodeId)) {
      visited.add(currentNodeId);

      // Look up neighbors from the pre-built map
      const neighbors = neighborMap[currentNodeId] || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.id)) {
          stack.push(neighbor.id);
        }
      }
    }
  }

  console.warn(`Start and goal nodes are not connected. Start: ${startNodeId}, Goal: ${goalNodeId}`);
  return false;
}

// Expand corridor preloading buffer for the second segment
function expandCorridorBuffer(a: { lat: number; lon: number }, b: { lat: number; lon: number }, corridorSet: Set<string>): void {
  const expandedBuffer = 3; // Increase buffer size for corridor preloading
  const keys = getCorridorTiles(a.lat, a.lon, b.lat, b.lon, expandedBuffer);
  for (const k of keys) corridorSet.add(k);
}
