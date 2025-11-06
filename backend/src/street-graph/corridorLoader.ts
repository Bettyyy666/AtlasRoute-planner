import { TILE_SIZE } from "../globalVariables.js";
import { ensureTileLoaded } from "./tileUtils.js";

/**
 * Corridor-based tile prediction for long-distance routing.
 *
 * This module implements intelligent tile prefetching along the expected
 * path corridor from start to goal. For long-distance routes (e.g., 250 miles),
 * this dramatically reduces the number of A* iterations by ensuring tiles
 * are loaded ahead of time.
 *
 * Strategy:
 * 1. Compute straight-line corridor from start to goal
 * 2. Add buffer width to corridor to account for road deviations
 * 3. Load tiles in order of proximity to straight line
 * 4. Load in batches to avoid overwhelming the Overpass API
 */

/**
 * Compute tile key from latitude and longitude.
 */
function getTileKey(lat: number, lon: number): string {
  const latIdx = Math.floor(lat / TILE_SIZE);
  const lonIdx = Math.floor(lon / TILE_SIZE);
  return `${latIdx},${lonIdx}`;
}

/**
 * Compute all tile keys that intersect a corridor between two points.
 *
 * @param startLat - Starting latitude
 * @param startLon - Starting longitude
 * @param goalLat - Goal latitude
 * @param goalLon - Goal longitude
 * @param bufferTiles - Number of tiles on each side of the corridor (default: 1)
 * @returns Array of tile keys sorted by distance from start
 */
export function getCorridorTiles(
  startLat: number,
  startLon: number,
  goalLat: number,
  goalLon: number,
  bufferTiles: number = 1
): string[] {
  const startKey = getTileKey(startLat, startLon);
  const goalKey = getTileKey(goalLat, goalLon);

  // Parse tile indices
  const [startLatIdx, startLonIdx] = startKey.split(",").map(Number);
  const [goalLatIdx, goalLonIdx] = goalKey.split(",").map(Number);

  // Compute bounding box with buffer
  const minLatIdx = Math.min(startLatIdx, goalLatIdx) - bufferTiles;
  const maxLatIdx = Math.max(startLatIdx, goalLatIdx) + bufferTiles;
  const minLonIdx = Math.min(startLonIdx, goalLonIdx) - bufferTiles;
  const maxLonIdx = Math.max(startLonIdx, goalLonIdx) + bufferTiles;

  // Line equation from start to goal (in tile index space)
  const dx = goalLonIdx - startLonIdx;
  const dy = goalLatIdx - startLatIdx;
  const length = Math.hypot(dx, dy);

  if (length === 0) {
    return [startKey];
  }

  // Normalized direction vector
  const dirX = dx / length;
  const dirY = dy / length;

  // Collect all tiles in the buffered corridor
  const tilesWithDistance: Array<{ key: string; distance: number }> = [];

  for (let i = minLatIdx; i <= maxLatIdx; i++) {
    for (let j = minLonIdx; j <= maxLonIdx; j++) {
      const key = `${i},${j}`;

      // Tile center in index space
      const tileCenterI = i + 0.5;
      const tileCenterJ = j + 0.5;

      // Vector from start to tile center
      const toTileI = tileCenterI - startLatIdx;
      const toTileJ = tileCenterJ - startLonIdx;

      // Project onto line direction to get distance along path
      const projectionDistance = toTileI * dirY + toTileJ * dirX;

      // Distance from tile center to line (perpendicular distance)
      const perpDistance = Math.abs(toTileI * dirX - toTileJ * dirY);

      // Only include tiles within buffer distance from the line
      if (perpDistance <= bufferTiles + 0.5) {
        tilesWithDistance.push({ key, distance: projectionDistance });
      }
    }
  }

  // Sort by distance from start (this ensures we load tiles in order)
  tilesWithDistance.sort((a, b) => a.distance - b.distance);

  return tilesWithDistance.map(t => t.key);
}

/**
 * Preload tiles along the corridor from start to goal.
 *
 * This function loads tiles in batches to avoid overwhelming the API
 * and provides progress feedback for long-distance routes.
 *
 * @param startLat - Starting latitude
 * @param startLon - Starting longitude
 * @param goalLat - Goal latitude
 * @param goalLon - Goal longitude
 * @param bufferTiles - Number of tiles on each side (default: 1)
 * @param batchSize - Number of tiles to load in parallel (default: 3)
 * @param onProgress - Optional callback for progress updates
 */
export async function preloadCorridorTiles(
  startLat: number,
  startLon: number,
  goalLat: number,
  goalLon: number,
  bufferTiles: number = 1,
  batchSize: number = 3,
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  const corridorTiles = getCorridorTiles(startLat, startLon, goalLat, goalLon, bufferTiles);

  console.log(`Preloading ${corridorTiles.length} tiles along corridor from (${startLat.toFixed(4)}, ${startLon.toFixed(4)}) to (${goalLat.toFixed(4)}, ${goalLon.toFixed(4)})`);

  let loaded = 0;

  // Load tiles in batches to respect API rate limits
  for (let i = 0; i < corridorTiles.length; i += batchSize) {
    const batch = corridorTiles.slice(i, i + batchSize);

    await Promise.allSettled(
      batch.map(key =>
        ensureTileLoaded(key).catch(err => {
          console.warn(`Failed to preload tile ${key}:`, err);
        })
      )
    );

    loaded += batch.length;
    if (onProgress) {
      onProgress(loaded, corridorTiles.length);
    }
  }

  console.log(`Preloaded ${loaded}/${corridorTiles.length} corridor tiles`);
}

/**
 * Estimate the number of tiles needed for a route.
 * Useful for setting expectations and timeouts.
 *
 * @param startLat - Starting latitude
 * @param startLon - Starting longitude
 * @param goalLat - Goal latitude
 * @param goalLon - Goal longitude
 * @returns Estimated number of tiles along the corridor
 */
export function estimateCorridorTileCount(
  startLat: number,
  startLon: number,
  goalLat: number,
  goalLon: number,
  bufferTiles: number = 1
): number {
  return getCorridorTiles(startLat, startLon, goalLat, goalLon, bufferTiles).length;
}
