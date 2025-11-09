import { graphCache } from "../globalVariables.js";
import { GraphTile } from "./graphSchema.js";
import * as fs from "fs";
import * as path from "path";

/**
 * Intelligent cache management for graph tiles.
 *
 * This module implements:
 * 1. LRU (Least Recently Used) eviction policy
 * 2. Cache size limits to prevent unbounded memory growth
 * 3. Optional disk-based persistence for frequently accessed tiles
 * 4. Priority-based retention (corridor tiles kept longer)
 *
 * For 250-mile routes, we need to balance:
 * - Loading enough tiles ahead to keep A* running smoothly
 * - Not exhausting memory with thousands of tiles
 * - Respecting Overpass API rate limits
 */

interface TileMetadata {
  key: string;
  lastAccessed: number;
  accessCount: number;
  priority: number; // 0 = normal, 1 = corridor, 2 = critical (start/goal)
}

/**
 * Default cache configuration
 *
 * For long-distance routing, we keep a smaller in-memory cache (top 500-1000 tiles)
 * and rely on disk cache for the rest. This balances speed with memory usage.
 */
export const CACHE_CONFIG = {
  /** Maximum number of tiles to keep in memory (top N most relevant) */
  maxTiles: 500,

  /** Maximum memory usage (approximate, in MB) */
  maxMemoryMB: 50,

  /** Enable disk caching for frequently accessed tiles */
  enableDiskCache: true,

  /** Directory for disk cache (relative to backend root) */
  diskCacheDir: "./data/tile-cache",

  /** Minimum access count before considering "relevant" */
  relevanceThreshold: 2,
};

/**
 * Metadata for all tiles, even evicted ones
 */
const tileMetadata = new Map<string, TileMetadata>();

/**
 * Track tiles currently in the corridor (higher priority)
 */
const corridorTiles = new Set<string>();

/**
 * Diagnostic list of recently-evicted tiles. Test/diagnostic code can read
 * this using `consumeEvictedTiles()` to see which tiles were removed by
 * the eviction policy during a run.
 */
export const evictedTiles: string[] = [];

/**
 * Record tile access for LRU tracking.
 */
export function touchTile(key: string, priority: number = 0): void {
  const now = Date.now();
  const existing = tileMetadata.get(key);

  if (existing) {
    existing.lastAccessed = now;
    existing.accessCount++;
    existing.priority = Math.max(existing.priority, priority);
  } else {
    tileMetadata.set(key, {
      key,
      lastAccessed: now,
      accessCount: 1,
      priority,
    });
  }
}

/**
 * Mark tiles as part of the current corridor (higher retention priority).
 */
export function markCorridorTiles(keys: string[]): void {
  corridorTiles.clear();
  for (const key of keys) {
    corridorTiles.add(key);
    touchTile(key, 1); // Priority 1 for corridor
  }
}

/**
 * Estimate memory usage of the current cache.
 * Rough estimate: ~100KB per tile on average.
 */
function estimateCacheMemoryMB(): number {
  const tileCount = Object.keys(graphCache).length;
  return (tileCount * 100) / 1024; // Convert KB to MB
}

/**
 * Evict least recently used tiles to stay within limits.
 *
 * Eviction rules:
 * 1. Never evict tiles with priority >= 2 (critical)
 * 2. Prefer evicting non-corridor tiles
 * 3. Among non-corridor tiles, evict LRU first
 * 4. If still over limit, evict corridor tiles (oldest first)
 */
export function evictIfNeeded(): void {
  const currentCount = Object.keys(graphCache).length;
  const currentMemoryMB = estimateCacheMemoryMB();

  if (currentCount <= CACHE_CONFIG.maxTiles && currentMemoryMB <= CACHE_CONFIG.maxMemoryMB) {
    return; // Within limits
  }

  console.log(`Cache over limit: ${currentCount} tiles, ~${currentMemoryMB.toFixed(1)}MB. Evicting...`);

  // Build list of eviction candidates
  const candidates: Array<{ key: string; score: number }> = [];

  for (const key of Object.keys(graphCache)) {
    const meta = tileMetadata.get(key);
    if (!meta) {
      // No metadata, safe to evict
      candidates.push({ key, score: 0 });
      continue;
    }

    // Never evict critical tiles (start/goal)
    if (meta.priority >= 2) {
      continue;
    }

    // Compute eviction score (lower = evict first)
    // - Recent access increases score
    // - High access count increases score
    // - Corridor membership increases score
    const age = Date.now() - meta.lastAccessed;
    const isCorridorMember = corridorTiles.has(key);

    const score = meta.accessCount * 1000 - age / 1000 + (isCorridorMember ? 10000 : 0);

    candidates.push({ key, score });
  }

  // Sort by score (ascending = evict first)
  candidates.sort((a, b) => a.score - b.score);

  // Evict tiles until we're under the limit
  const targetCount = Math.floor(CACHE_CONFIG.maxTiles * 0.8); // Evict to 80% capacity
  const toEvict = Math.max(currentCount - targetCount, 0);

  for (let i = 0; i < Math.min(toEvict, candidates.length); i++) {
    const key = candidates[i].key;

    // Optionally persist to disk before evicting (if frequently accessed)
    if (CACHE_CONFIG.enableDiskCache) {
      const meta = tileMetadata.get(key);
      if (meta && meta.accessCount >= CACHE_CONFIG.relevanceThreshold) {
        persistTileToDisk(key, graphCache[key]);
      }
    }

    delete graphCache[key];
    corridorTiles.delete(key);
    // Record evicted tile for diagnostics
    evictedTiles.push(key);
    console.log(`  Evicted tile ${key} (score: ${candidates[i].score.toFixed(0)})`);
  }

  console.log(`Cache after eviction: ${Object.keys(graphCache).length} tiles`);
}

/**
 * Save a tile to disk for later retrieval.
 */
function persistTileToDisk(key: string, tile: GraphTile): void {
  try {
    if (!fs.existsSync(CACHE_CONFIG.diskCacheDir)) {
      fs.mkdirSync(CACHE_CONFIG.diskCacheDir, { recursive: true });
    }

    const filename = key.replace(/,/g, "_") + ".json";
    const filepath = path.join(CACHE_CONFIG.diskCacheDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(tile), "utf-8");
    console.log(`  Persisted tile ${key} to disk`);
  } catch (err) {
    console.warn(`Failed to persist tile ${key}:`, err);
  }
}

/**
 * Load a tile from disk cache if available.
 */
export function loadTileFromDisk(key: string): GraphTile | null {
  if (!CACHE_CONFIG.enableDiskCache) {
    return null;
  }

  try {
    const filename = key.replace(/,/g, "_") + ".json";
    const filepath = path.join(CACHE_CONFIG.diskCacheDir, filename);

    if (!fs.existsSync(filepath)) {
      return null;
    }

    const data = fs.readFileSync(filepath, "utf-8");
    const tile = JSON.parse(data) as GraphTile;
    console.log(`  Loaded tile ${key} from disk cache`);
    return tile;
  } catch (err) {
    console.warn(`Failed to load tile ${key} from disk:`, err);
    return null;
  }
}

/**
 * Clear all cache (useful for testing).
 */
export function clearCache(): void {
  for (const key of Object.keys(graphCache)) {
    delete graphCache[key];
  }
  tileMetadata.clear();
  corridorTiles.clear();
  console.log("Cache cleared");
}

/**
 * Return and clear the diagnostic list of evicted tiles.
 */
export function consumeEvictedTiles(): string[] {
  const out = evictedTiles.splice(0, evictedTiles.length);
  return out;
}

/**
 * Temporarily mark a set of tiles as critical (priority 2) to prevent eviction.
 * Returns a map of previous priorities so the caller can restore them later.
 */
export function holdTilesCritical(keys: string[]): Record<string, number> {
  const prev: Record<string, number> = {};
  for (const k of keys) {
    const meta = (tileMetadata.get(k) as TileMetadata | undefined);
    prev[k] = meta ? meta.priority : 0;
    touchTile(k, 2);
  }
  return prev;
}

/**
 * Restore previously-saved tile priorities (from holdTilesCritical)
 */
export function restoreTilePriorities(prev: Record<string, number>): void {
  for (const k of Object.keys(prev)) {
    const meta = tileMetadata.get(k);
    if (meta) meta.priority = prev[k];
  }
}

/**
 * Get cache statistics for monitoring.
 */
export function getCacheStats(): {
  tileCount: number;
  estimatedMemoryMB: number;
  corridorTileCount: number;
  totalAccesses: number;
} {
  let totalAccesses = 0;
  for (const meta of tileMetadata.values()) {
    totalAccesses += meta.accessCount;
  }

  return {
    tileCount: Object.keys(graphCache).length,
    estimatedMemoryMB: estimateCacheMemoryMB(),
    corridorTileCount: corridorTiles.size,
    totalAccesses,
  };
}
