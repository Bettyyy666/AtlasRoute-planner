/**
 * corridorCacheLoader.ts
 *
 * Loads pre-generated road bundles (like the east-coast-corridor) into memory
 * when the server starts. This enables fast routing for popular corridors
 * without waiting for Overpass API calls.
 *
 * Usage:
 *   - Call loadCorridorBundles() in server startup
 *   - Tiles from the bundle are automatically available in graphCache
 */

import fs from "fs";
import path from "path";
import { graphCache } from "../globalVariables.js";
import { GraphTile } from "./graphSchema.js";

interface CorridorBundleMetadata {
  region: string;
  createdAt: string;
  bbox: {
    minLat: number;
    minLon: number;
    maxLat: number;
    maxLon: number;
  };
  targetWays: string[];
  tileCount: number;
  successCount: number;
  fallbackCount: number;
}

interface CorridorBundle {
  meta: CorridorBundleMetadata;
  tiles: GraphTile[];
}

/**
 * Loads a corridor bundle from a JSON file and populates graphCache.
 *
 * @param filePath - Path to the corridor bundle JSON file
 * @returns Promise<number> - Number of tiles loaded
 */
export async function loadCorridorBundle(filePath: string): Promise<number> {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Corridor bundle not found: ${filePath}`);
      return 0;
    }

    console.log(`📚 Loading corridor bundle: ${path.basename(filePath)}...`);

    const data = fs.readFileSync(filePath, "utf-8");
    const bundle = JSON.parse(data) as CorridorBundle;

    if (!bundle.meta || !bundle.tiles) {
      console.warn(`⚠️  Invalid corridor bundle format: ${filePath}`);
      return 0;
    }

    // Load tiles into graphCache
    let loadedCount = 0;
    for (const tile of bundle.tiles) {
      if (tile.nodes && tile.neighbors) {
        graphCache[tile.tileKey] = tile;
        loadedCount++;
      }
    }

    // Log statistics
    console.log(`✓ Loaded corridor bundle: "${bundle.meta.region}"`);
    console.log(`  - Tiles loaded: ${loadedCount}/${bundle.tiles.length}`);
    console.log(
      `  - Bounding box: [${bundle.meta.bbox.minLat.toFixed(
        2
      )}, ${bundle.meta.bbox.minLon.toFixed(
        2
      )}, ${bundle.meta.bbox.maxLat.toFixed(
        2
      )}, ${bundle.meta.bbox.maxLon.toFixed(2)}]`
    );
    console.log(`  - Target routes: ${bundle.meta.targetWays.join(", ")}`);
    console.log(
      `  - Created: ${new Date(bundle.meta.createdAt).toLocaleDateString()}`
    );

    return loadedCount;
  } catch (error) {
    console.error(
      `❌ Failed to load corridor bundle: ${(error as Error).message}`
    );
    return 0;
  }
}

/**
 * Loads all available corridor bundles from the important-roads directory.
 * This is called automatically during server startup.
 *
 * @returns Promise<{ totalTiles: number; bundlesLoaded: number }>
 */
export async function loadAllCorridorBundles(): Promise<{
  totalTiles: number;
  bundlesLoaded: number;
}> {
  const bundleDir = path.join(process.cwd(), "data", "important-roads");

  if (!fs.existsSync(bundleDir)) {
    console.log(`📁 No corridor bundles directory found: ${bundleDir}`);
    return { totalTiles: 0, bundlesLoaded: 0 };
  }

  const files = fs
    .readdirSync(bundleDir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"));

  if (files.length === 0) {
    console.log(`📁 No corridor bundles found in ${bundleDir}`);
    return { totalTiles: 0, bundlesLoaded: 0 };
  }

  console.log(`\n🛣️  Loading corridor bundles (${files.length} found)\n`);

  let totalTiles = 0;
  let bundlesLoaded = 0;

  for (const file of files) {
    const filePath = path.join(bundleDir, file);
    const tilesLoaded = await loadCorridorBundle(filePath);

    if (tilesLoaded > 0) {
      totalTiles += tilesLoaded;
      bundlesLoaded++;
    }
  }

  console.log(
    `\n✅ Corridor bundles loaded: ${bundlesLoaded} bundles, ${totalTiles} total tiles\n`
  );

  return { totalTiles, bundlesLoaded };
}

/**
 * Gets statistics about loaded corridor bundles.
 *
 * @returns Object with bundle and tile statistics
 */
export function getCorridorBundleStats(): {
  tilesInCache: number;
  estimatedCacheSizeMB: number;
  sampleTileKeys: string[];
} {
  const tileKeys = Object.keys(graphCache);
  let estimatedSize = 0;

  // Rough estimate: average tile ~200KB
  estimatedSize = tileKeys.length * 200;

  return {
    tilesInCache: tileKeys.length,
    estimatedCacheSizeMB: estimatedSize / 1024,
    sampleTileKeys: tileKeys.slice(0, 5),
  };
}
