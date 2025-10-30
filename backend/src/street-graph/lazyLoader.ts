import { TILE_SIZE, graphCache } from "../globalVariables.js";
import { ensureTileLoaded } from "./tileUtils.js";
import { NodeId, Neighbor } from "./graphSchema.js";

const EDGE_FRAC = 0.08;

/**
 * Compute bounding box for a given tile key.
 *
 *   STUDENT NOTES:
 * - Tile keys are stored as "i,j" where i and j are grid coordinates.
 * - Each tile covers TILE_SIZE degrees of latitude/longitude.
 * - This function converts the key into numeric bounds you can use.
 *
 * @param key - tile key string (e.g. "42,17")
 * @param size - optional override for tile size (defaults to TILE_SIZE)
 * @returns bounding box information for the tile
 */
function boundsFromKey(key: string, size = TILE_SIZE) {
  const [iStr, jStr] = key.split(",");
  const i = parseInt(iStr, 10);
  const j = parseInt(jStr, 10);

  const minLat = i * size;
  const maxLat = minLat + size;
  const minLon = j * size;
  const maxLon = minLon + size;

  return { i, j, minLat, minLon, maxLat, maxLon };
}

/**
 * Check if a given (lat, lon) is close to the edge of its tile.
 *
 *   STUDENT NOTES:
 * - Use this to decide whether to prefetch neighbor tiles.
 * - A point is considered "near the edge" if it's within 8% of
 *   any tile border.
 *
 * @param lat - latitude of the point
 * @param lon - longitude of the point
 * @param key - tile key string (the tile that contains the point)
 * @returns true if the point is near the edge of the tile
 */
export function nearEdge(lat: number, lon: number, key: string): boolean {
  const { minLat, minLon, maxLat, maxLon } = boundsFromKey(key);
  const padLat = TILE_SIZE * EDGE_FRAC;
  const padLon = TILE_SIZE * EDGE_FRAC;

  return (
    lat <= minLat + padLat ||
    lat >= maxLat - padLat ||
    lon <= minLon + padLon ||
    lon >= maxLon - padLon
  );
}
/**
 *   STUDENT TODO:
 * Implement a function that uses `nearEdge()` to detect when you
 * should load neighbor tiles.
 **/

/**
 * Get tile key from a node ID by looking it up in the node index.
 *
 * @param nodeId - The node ID to look up
 * @param nodeIndex - Record mapping node IDs to their coordinates
 * @returns Tile key string in format "i,j"
 */
export function getTileKeyForNode(
  nodeId: NodeId,
  nodeIndex: Record<string, { lat: number; lon: number }>
): string {
  const node = nodeIndex[nodeId];
  if (!node) {
    throw new Error(`Node ${nodeId} not found in node index`);
  }
  const latIdx = Math.floor(node.lat / TILE_SIZE);
  const lonIdx = Math.floor(node.lon / TILE_SIZE);
  return `${latIdx},${lonIdx}`;
}

/**
 * Load neighboring tiles if we're near a tile boundary.
 * Uses `nearEdge()` to detect when neighbor tiles should be loaded.
 *
 * @param lat - Latitude of the point
 * @param lon - Longitude of the point
 * @param currentKey - Current tile key
 */
export async function loadNeighborTiles(
  lat: number,
  lon: number,
  currentKey: string
): Promise<void> {
  const [iStr, jStr] = currentKey.split(",");
  const i = parseInt(iStr, 10);
  const j = parseInt(jStr, 10);

  // Determine which neighbors to load based on position
  const latIdx = Math.floor(lat / TILE_SIZE);
  const lonIdx = Math.floor(lon / TILE_SIZE);

  const latPos = (lat - latIdx * TILE_SIZE) / TILE_SIZE;
  const lonPos = (lon - lonIdx * TILE_SIZE) / TILE_SIZE;

  const tilesToLoad: string[] = [];

  // Near top edge
  if (latPos > 0.92) tilesToLoad.push(`${i + 1},${j}`);
  // Near bottom edge
  if (latPos < 0.08) tilesToLoad.push(`${i - 1},${j}`);
  // Near right edge
  if (lonPos > 0.92) tilesToLoad.push(`${i},${j + 1}`);
  // Near left edge
  if (lonPos < 0.08) tilesToLoad.push(`${i},${j - 1}`);

  // Load corner tiles if near corners
  if (latPos > 0.92 && lonPos > 0.92) tilesToLoad.push(`${i + 1},${j + 1}`);
  if (latPos > 0.92 && lonPos < 0.08) tilesToLoad.push(`${i + 1},${j - 1}`);
  if (latPos < 0.08 && lonPos > 0.92) tilesToLoad.push(`${i - 1},${j + 1}`);
  if (latPos < 0.08 && lonPos < 0.08) tilesToLoad.push(`${i - 1},${j - 1}`);

  // Load tiles in parallel
  await Promise.allSettled(
    tilesToLoad.map((key) =>
      ensureTileLoaded(key).catch((err) => {
        console.warn(`Failed to load neighbor tile ${key}:`, err);
      })
    )
  );
}

/**
 * Get neighbors for a node, ensuring tiles are loaded as needed.
 * Uses nearEdge() to determine if neighbor tiles should be preloaded.
 *
 * @param nodeId - The node ID to get neighbors for
 * @param nodeIndex - Record mapping node IDs to their coordinates
 * @returns Array of neighbor nodes with their weights
 */
export async function getNeighbors(
  nodeId: NodeId,
  nodeIndex: Record<string, { lat: number; lon: number }>
): Promise<Neighbor[]> {
  const tileKey = getTileKeyForNode(nodeId, nodeIndex);

  // Ensure the tile is loaded
  if (!graphCache[tileKey]) {
    await ensureTileLoaded(tileKey);
  }

  const tile = graphCache[tileKey];
  if (!tile) {
    console.warn(`Tile ${tileKey} not available for node ${nodeId}`);
    return [];
  }

  const neighbors = tile.neighbors[nodeId] || [];

  // Check if we're near an edge and should load neighbor tiles
  const node = nodeIndex[nodeId];
  if (node && nearEdge(node.lat, node.lon, tileKey)) {
    await loadNeighborTiles(node.lat, node.lon, tileKey);
  }

  return neighbors;
}
