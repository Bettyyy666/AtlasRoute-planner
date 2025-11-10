import { FetchMode } from "./graphSchema.js";
import { ensureTileLoaded as loadTile } from "./tileUtils.js";
import { graphCache, TILE_SIZE } from "../globalVariables.js";
import { GraphNode } from "./graphSchema.js";

let currentFetchMode: FetchMode = "detailed";

/**
 * Get the current fetch mode
 */
export function getHighwayFetchMode(): FetchMode {
  return currentFetchMode;
}

/**
 * Set the current fetch mode
 */
export function setHighwayFetchMode(mode: FetchMode) {
  if (mode !== currentFetchMode) {
    console.log(`Switching fetch mode: ${currentFetchMode} → ${mode}`);
    currentFetchMode = mode;
  }
}

/**
 * Get tile key from lat/lon coordinates
 */
export function getTileKeyFromCoords(lat: number, lon: number): string {
  const latIdx = Math.floor(lat / TILE_SIZE);
  const lonIdx = Math.floor(lon / TILE_SIZE);
  return `${latIdx},${lonIdx}`;
}

/**
 * Load a tile with the given mode requirement
 */
export async function loadTileWithMode(tileKey: string, mode: FetchMode) {
  const existingTile = graphCache[tileKey];
  if (existingTile?.metadata?.fetchMode === mode) {
    return;
  }

  // Delete existing tile with wrong mode
  if (existingTile) {
    delete graphCache[tileKey];
  }

  const prevMode = getHighwayFetchMode();
  setHighwayFetchMode(mode);
  
  try {
    await loadTile(tileKey);
  } finally {
    setHighwayFetchMode(prevMode);
  }
}

/**
 * Ensure a tile is loaded with at least the specified minimum layer
 */
export async function ensureTileLoaded(
  tileKey: string, 
  opts: { minLayer: FetchMode } = { minLayer: "detailed" }
) {
  const existingTile = graphCache[tileKey];
  if (!existingTile) {
    return loadTileWithMode(tileKey, opts.minLayer);
  }

  const currentMode = existingTile.metadata?.fetchMode ?? "detailed";
  const needsUpgrade = (
    (opts.minLayer === "detailed" && currentMode !== "detailed") ||
    (opts.minLayer === "express" && currentMode === "backbone")
  );

  if (needsUpgrade) {
    return loadTileWithMode(tileKey, opts.minLayer);
  }
}

/**
 * Find the tile containing a node and load it
 */
export async function findAndLoadTileForNode(
  nodeId: string, 
  nearTileKey: string
): Promise<string> {
  const [baseLat, baseLon] = nearTileKey.split(",").map(Number);
  
  // Search in a 3x3 grid around the near tile
  for (let dLat = -1; dLat <= 1; dLat++) {
    for (let dLon = -1; dLon <= 1; dLon++) {
      const tileKey = `${baseLat + dLat},${baseLon + dLon}`;
      await loadTile(tileKey);
      const tile = graphCache[tileKey];
      if (tile?.neighbors[nodeId]) {
        return tileKey;
      }
    }
  }
  
  throw new Error(`Could not find tile containing node ${nodeId}`);
}