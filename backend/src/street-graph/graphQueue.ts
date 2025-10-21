import { graphCache } from "../globalVariables.js";
import { fetchGraphDataFromAPI } from "./fetchGraphFromAPI.js";
import { BBox, GraphTile } from "./graphSchema.js";

/**
 * Represents a queued graph tile fetch.
 * Students do not need to modify this type.
 */
type GraphTask = {
  tileKey: string;
  tileSize: number;
  resolve: () => void;
  reject: (err: any) => void;
};

/**
 * Internal queue of tiles waiting to be fetched.
 * Students do not need to manipulate this directly.
 */
const graphTaskQueue: GraphTask[] = [];

/**
 * Tracks in-flight tile fetches to avoid duplicate requests.
 */
const graphTileMap = new Map<string, Promise<void>>();

/**
 * Ensures only one queue processor runs at a time.
 */
let graphProcessPromise: Promise<void> | null = null;

const MAX_RETRIES = 4;
const INITIAL_BACKOFF_MS = 800;
const MAX_BACKOFF_MS = 30_000;
let globalCooldownUntil = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Adds a tile fetch to the queue
 *
 * You will **call this function** when they need a tile that
 * has not yet been loaded. You should NOT change this implementation.
 *
 * Look over waitForGraphTiles and understand how it relates to this function
 */
export function enqueueGraphTask(
  tileKey: string,
  tileSize: number
): Promise<void> {
  if (graphTileMap.has(tileKey)) return graphTileMap.get(tileKey)!;
  if (graphCache[tileKey]) return Promise.resolve();

  const promise = new Promise<void>((resolve, reject) => {
    graphTaskQueue.push({ tileKey, tileSize, resolve, reject });
  });

  graphTileMap.set(tileKey, promise);

  // Ensure the queue processor runs
  if (!graphProcessPromise) {
    graphProcessPromise = processGraphQueue().finally(() => {
      graphProcessPromise = null;
    });
  }

  return promise.catch((e) => {
    graphTileMap.delete(tileKey);
    throw e;
  });
}

/**
 * Continuously processes the tile queue until empty.
 * Handles retries, backoff, and ingesting data into memory.
 * DO NOT modify this function but do understand how it works.
 */
async function processGraphQueue() {
  while (graphTaskQueue.length > 0) {
    const { tileKey, tileSize, resolve, reject } = graphTaskQueue.shift()!;
    const [minLat, minLon, maxLat, maxLon] = tileKeyToBounds(tileKey, tileSize);
    const bbox: BBox = [minLon, minLat, maxLon, maxLat];

    let backoff = INITIAL_BACKOFF_MS;
    let done = false;

    for (let attempt = 0; attempt <= MAX_RETRIES && !done; attempt++) {
      const now = Date.now();
      if (now < globalCooldownUntil) {
        await sleep(globalCooldownUntil - now);
      }

      try {
        const tileData: GraphTile = await fetchGraphDataFromAPI(bbox);
        graphCache[tileKey] = tileData;
        resolve();
        done = true;
      } catch (err: any) {
        // Retry logic if the API rate-limits or fails temporarily
        const msg = String(err?.message || "");
        const statusMatch = msg.match(/status\s+(\d{3})/i);
        const status =
          (err?.status as number) ??
          (statusMatch ? Number(statusMatch[1]) : undefined);

        const retriable =
          status === 0 ||
          status === 429 ||
          status === 502 ||
          status === 503 ||
          status === 504 ||
          status === undefined;
        const lastTry = attempt === MAX_RETRIES;

        if (status === 429) {
          // Apply global cooldown if server tells us we're rate-limited
          globalCooldownUntil = Date.now() + Math.max(2000, backoff);
        }

        if (!retriable || lastTry) {
          reject(err);
          break;
        }

        // Exponential backoff with jitter
        const wait = backoff + Math.random() * 250;
        await sleep(wait);
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      }
    }

    graphTileMap.delete(tileKey);
  }
}

/**
 * Converts a tileKey ("latIndex,lngIndex") to bounding box coordinates.
 * Students will likely call this when deciding which tiles to load.
 */
export function tileKeyToBounds(
  tileKey: string,
  tileSize: number
): [minLat: number, minLon: number, maxLat: number, maxLon: number] {
  const [latIndex, lngIndex] = tileKey.split(",").map(Number);
  const minLat = latIndex * tileSize;
  const minLon = lngIndex * tileSize;
  const maxLat = (latIndex + 1) * tileSize;
  const maxLon = (lngIndex + 1) * tileSize;
  return [minLat, minLon, maxLat, maxLon];
}

/**
 * Ensures that all required tiles are loaded before continuing.
 * Use this whenever you want to wait for for the information of the tiles to be done fetching
 */
export async function waitForGraphTiles(tileKeys: string[]): Promise<void> {
  const keys = Array.from(new Set(tileKeys));

  const waits = keys.map((k) => {
    if (graphCache[k]) return Promise.resolve();

    const inFlight = graphTileMap.get(k);
    if (inFlight) return inFlight;

    return enqueueGraphTask(k, 0.1);
  });

  const results = await Promise.allSettled(waits);
  const fail = results.find((r) => r.status === "rejected") as
    | PromiseRejectedResult
    | undefined;

  if (fail) throw fail.reason;
}
