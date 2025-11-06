import { graphCache } from "../../globalVariables.js";
import { buildNodeIndex } from "../tileUtils.js";

/**
 * Diagnostic tool to check graph connectivity and identify disconnected components.
 *
 * Usage:
 *   After loading tiles for your route, call this function to verify
 *   that start and goal nodes are in the same connected component.
 */

/**
 * Perform BFS from a start node to find all reachable nodes.
 * @param startNodeId - Node ID to start from
 * @returns Set of all node IDs reachable from start
 */
function findConnectedComponent(startNodeId: string): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [startNodeId];
  visited.add(startNodeId);

  while (queue.length > 0) {
    const current = queue.shift()!;

    // Find the tile containing this node
    let currentNeighbors: Array<{ id: string; weight: number }> = [];
    for (const tile of Object.values(graphCache)) {
      if (tile.neighbors[current]) {
        currentNeighbors = tile.neighbors[current];
        break;
      }
    }

    // Add unvisited neighbors to queue
    for (const neighbor of currentNeighbors) {
      if (!visited.has(neighbor.id)) {
        visited.add(neighbor.id);
        queue.push(neighbor.id);
      }
    }
  }

  return visited;
}

/**
 * Check if two nodes are in the same connected component.
 * @param startNodeId - Start node ID
 * @param goalNodeId - Goal node ID
 * @returns Object with connectivity info and statistics
 */
export function checkConnectivity(
  startNodeId: string,
  goalNodeId: string
): {
  connected: boolean;
  startComponentSize: number;
  goalComponentSize: number;
  totalNodes: number;
  message: string;
} {
  const nodeIndex = buildNodeIndex();
  const totalNodes = Object.keys(nodeIndex).length;

  // Check if nodes exist
  if (!nodeIndex[startNodeId]) {
    return {
      connected: false,
      startComponentSize: 0,
      goalComponentSize: 0,
      totalNodes,
      message: `Start node ${startNodeId} not found in graph`
    };
  }

  if (!nodeIndex[goalNodeId]) {
    return {
      connected: false,
      startComponentSize: 0,
      goalComponentSize: 0,
      totalNodes,
      message: `Goal node ${goalNodeId} not found in graph`
    };
  }

  // Find connected component from start
  console.log(`Finding connected component from start node ${startNodeId}...`);
  const startComponent = findConnectedComponent(startNodeId);
  const startComponentSize = startComponent.size;

  // Check if goal is in start's component
  if (startComponent.has(goalNodeId)) {
    return {
      connected: true,
      startComponentSize,
      goalComponentSize: startComponentSize,
      totalNodes,
      message: `✅ Nodes are connected! Component size: ${startComponentSize} nodes (${((startComponentSize / totalNodes) * 100).toFixed(1)}% of graph)`
    };
  }

  // Goal is not reachable - find goal's component
  console.log(`Goal not reachable from start. Finding goal's component...`);
  const goalComponent = findConnectedComponent(goalNodeId);
  const goalComponentSize = goalComponent.size;

  return {
    connected: false,
    startComponentSize,
    goalComponentSize,
    totalNodes,
    message: `❌ Nodes are DISCONNECTED!\n` +
      `  Start component: ${startComponentSize} nodes (${((startComponentSize / totalNodes) * 100).toFixed(1)}% of graph)\n` +
      `  Goal component: ${goalComponentSize} nodes (${((goalComponentSize / totalNodes) * 100).toFixed(1)}% of graph)\n` +
      `  This route requires road types not included in the Overpass query.`
  };
}

/**
 * Find all connected components in the current graph.
 * Useful for understanding graph structure.
 */
export function findAllComponents(): Array<{
  size: number;
  sampleNodeId: string;
}> {
  const nodeIndex = buildNodeIndex();
  const allNodes = Object.keys(nodeIndex);
  const visited = new Set<string>();
  const components: Array<{ size: number; sampleNodeId: string }> = [];

  for (const nodeId of allNodes) {
    if (!visited.has(nodeId)) {
      const component = findConnectedComponent(nodeId);

      // Mark all nodes in this component as visited
      for (const node of component) {
        visited.add(node);
      }

      components.push({
        size: component.size,
        sampleNodeId: nodeId
      });
    }
  }

  // Sort by size (largest first)
  components.sort((a, b) => b.size - a.size);

  console.log(`\nFound ${components.length} connected components:`);
  components.forEach((comp, i) => {
    console.log(`  Component ${i + 1}: ${comp.size} nodes (${((comp.size / allNodes.length) * 100).toFixed(1)}%)`);
  });

  return components;
}
