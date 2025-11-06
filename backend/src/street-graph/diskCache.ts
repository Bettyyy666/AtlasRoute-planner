import * as fs from "fs";
import * as path from "path";
import { GraphTile } from "./graphSchema.js";

/**
 * Disk-based persistent cache for graph tiles.
 *
 * This module provides fast disk caching to avoid redundant Overpass API calls.
 * Tiles are stored as JSON files on disk and can be retrieved much faster than
 * making new API requests (milliseconds vs. seconds).
 *
 * Key features:
 * - Persistent across server restarts
 * - Fast retrieval (disk I/O faster than network)
 * - Frequency tracking for intelligent eviction
 * - Configurable cache size limits
 */

const CACHE_DIR = path.join(process.cwd(), "data", "tile-cache");
const METADATA_FILE = path.join(CACHE_DIR, "_metadata.json");

interface TileMetadata {
  key: string;
  accessCount: number;
  lastAccessed: number;
  size: number; // bytes
  cachedAt: number;
}

interface CacheMetadata {
  tiles: Record<string, TileMetadata>;
  totalSize: number;
}

let metadata: CacheMetadata = { tiles: {}, totalSize: 0 };

/**
 * Initialize the disk cache directory and load metadata.
 */
export function initDiskCache(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    console.log(`Created disk cache directory: ${CACHE_DIR}`);
  }

  if (fs.existsSync(METADATA_FILE)) {
    try {
      const data = fs.readFileSync(METADATA_FILE, "utf-8");
      metadata = JSON.parse(data);
      console.log(`Loaded disk cache metadata: ${Object.keys(metadata.tiles).length} tiles, ${(metadata.totalSize / 1024 / 1024).toFixed(2)} MB`);
    } catch (err) {
      console.warn("Failed to load cache metadata, starting fresh:", err);
      metadata = { tiles: {}, totalSize: 0 };
    }
  }
}

/**
 * Save metadata to disk.
 */
function saveMetadata(): void {
  try {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save cache metadata:", err);
  }
}

/**
 * Get the file path for a tile key.
 */
function getTilePath(key: string): string {
  const safeKey = key.replace(/,/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(CACHE_DIR, `${safeKey}.json`);
}

/**
 * Check if a tile exists in the disk cache.
 */
export function hasCachedTile(key: string): boolean {
  return metadata.tiles[key] !== undefined && fs.existsSync(getTilePath(key));
}

/**
 * Load a tile from the disk cache.
 * Returns null if not found or corrupted.
 */
export function loadCachedTile(key: string): GraphTile | null {
  if (!metadata.tiles[key]) {
    return null;
  }

  const tilePath = getTilePath(key);
  if (!fs.existsSync(tilePath)) {
    // File was deleted but metadata still exists
    delete metadata.tiles[key];
    saveMetadata();
    return null;
  }

  try {
    const data = fs.readFileSync(tilePath, "utf-8");
    const tile = JSON.parse(data) as GraphTile;

    // Update access metadata
    metadata.tiles[key].accessCount++;
    metadata.tiles[key].lastAccessed = Date.now();
    saveMetadata();

    console.log(`Loaded tile ${key} from disk cache (accessed ${metadata.tiles[key].accessCount} times)`);
    return tile;
  } catch (err) {
    console.error(`Failed to load cached tile ${key}:`, err);
    // Remove corrupted file
    try {
      fs.unlinkSync(tilePath);
      delete metadata.tiles[key];
      saveMetadata();
    } catch {}
    return null;
  }
}

/**
 * Save a tile to the disk cache.
 */
export function saveCachedTile(key: string, tile: GraphTile): void {
  const tilePath = getTilePath(key);

  try {
    const data = JSON.stringify(tile);
    fs.writeFileSync(tilePath, data, "utf-8");

    const size = Buffer.byteLength(data, "utf-8");

    // Update metadata
    if (metadata.tiles[key]) {
      metadata.totalSize -= metadata.tiles[key].size;
    }

    metadata.tiles[key] = {
      key,
      accessCount: metadata.tiles[key]?.accessCount || 1,
      lastAccessed: Date.now(),
      size,
      cachedAt: Date.now(),
    };

    metadata.totalSize += size;
    saveMetadata();

    console.log(`Saved tile ${key} to disk cache (${(size / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.error(`Failed to save tile ${key} to disk:`, err);
  }
}

/**
 * Get cache statistics.
 */
export function getDiskCacheStats(): {
  tileCount: number;
  totalSizeMB: number;
  topTiles: Array<{ key: string; accessCount: number }>;
} {
  const sortedTiles = Object.values(metadata.tiles)
    .sort((a, b) => b.accessCount - a.accessCount)
    .slice(0, 10);

  return {
    tileCount: Object.keys(metadata.tiles).length,
    totalSizeMB: metadata.totalSize / 1024 / 1024,
    topTiles: sortedTiles.map(t => ({ key: t.key, accessCount: t.accessCount })),
  };
}

/**
 * Evict least frequently used tiles to stay under size limit.
 *
 * @param maxSizeMB - Maximum cache size in megabytes
 */
export function evictDiskCacheLFU(maxSizeMB: number = 500): void {
  const maxBytes = maxSizeMB * 1024 * 1024;

  if (metadata.totalSize <= maxBytes) {
    return;
  }

  console.log(`Disk cache over limit (${(metadata.totalSize / 1024 / 1024).toFixed(2)} MB > ${maxSizeMB} MB), evicting...`);

  // Sort tiles by access count (ascending = evict first)
  const tiles = Object.values(metadata.tiles).sort((a, b) => {
    // Least frequently used first
    if (a.accessCount !== b.accessCount) {
      return a.accessCount - b.accessCount;
    }
    // If same access count, evict oldest
    return a.lastAccessed - b.lastAccessed;
  });

  let evicted = 0;
  for (const tile of tiles) {
    if (metadata.totalSize <= maxBytes * 0.8) {
      break; // Evict to 80% capacity
    }

    const tilePath = getTilePath(tile.key);
    try {
      fs.unlinkSync(tilePath);
      metadata.totalSize -= tile.size;
      delete metadata.tiles[tile.key];
      evicted++;
    } catch (err) {
      console.warn(`Failed to evict tile ${tile.key}:`, err);
    }
  }

  saveMetadata();
  console.log(`Evicted ${evicted} tiles, cache now ${(metadata.totalSize / 1024 / 1024).toFixed(2)} MB`);
}

/**
 * Clear the entire disk cache.
 */
export function clearDiskCache(): void {
  console.log("Clearing disk cache...");

  for (const key of Object.keys(metadata.tiles)) {
    const tilePath = getTilePath(key);
    try {
      if (fs.existsSync(tilePath)) {
        fs.unlinkSync(tilePath);
      }
    } catch (err) {
      console.warn(`Failed to delete tile ${key}:`, err);
    }
  }

  metadata = { tiles: {}, totalSize: 0 };
  saveMetadata();

  console.log("Disk cache cleared");
}

/**
 * Get tiles that would benefit from caching (frequently accessed).
 */
export function getFrequentlyAccessedTiles(minAccess: number = 3): string[] {
  return Object.values(metadata.tiles)
    .filter(t => t.accessCount >= minAccess)
    .map(t => t.key);
}
