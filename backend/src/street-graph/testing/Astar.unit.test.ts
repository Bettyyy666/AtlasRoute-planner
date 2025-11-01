import { describe, it, expect, beforeEach } from "vitest";
import { aStarWithOnDemandTiles, haversineDistance } from "../Astar.js";
import { graphCache, TILE_SIZE } from "../../globalVariables.js";
import type { GraphTile } from "../graphSchema.js";

// Helper: reset graph cache before each test
beforeEach(() => {
  for (const key of Object.keys(graphCache)) {
    delete graphCache[key];
  }
});

// Helper: build a simple single-tile graph with a clear shortest path
function seedSingleTileGraph(): {
  tileKey: string;
  nodes: Record<string, { lat: number; lon: number }>;
} {
  // Keep coordinates away from tile edges (avoid neighbor tile prefetch)
  // TILE_SIZE default is 0.1; put everything near 0.05, 0.05 in tile "0,0"
  const tileKey = "0,0";
  const baseLat = 0.05;
  const baseLon = 0.05;

  const nodes = {
    A: { lat: baseLat, lon: baseLon },
    B: { lat: baseLat, lon: baseLon + 0.005 },
    C: { lat: baseLat, lon: baseLon + 0.010 },
    D: { lat: baseLat, lon: baseLon + 0.015 }
  };

  const neighbors: Record<string, { id: string; weight: number }[]> = {
    // Use realistic weights based on haversine distance for adjacent segments
    // and make the direct B->D edge deliberately more expensive than going via C
    // so the cheapest path is A -> B -> C -> D.
    A: [{ id: "B", weight: haversineDistance(nodes.A.lat, nodes.A.lon, nodes.B.lat, nodes.B.lon) }],
    B: [
      { id: "A", weight: haversineDistance(nodes.B.lat, nodes.B.lon, nodes.A.lat, nodes.A.lon) },
      { id: "C", weight: haversineDistance(nodes.B.lat, nodes.B.lon, nodes.C.lat, nodes.C.lon) },
      { id: "D", weight: 5000 }
    ],
    C: [
      { id: "B", weight: haversineDistance(nodes.C.lat, nodes.C.lon, nodes.B.lat, nodes.B.lon) },
      { id: "D", weight: haversineDistance(nodes.C.lat, nodes.C.lon, nodes.D.lat, nodes.D.lon) }
    ],
    D: [
      { id: "C", weight: haversineDistance(nodes.D.lat, nodes.D.lon, nodes.C.lat, nodes.C.lon) },
      { id: "B", weight: 5000 }
    ]
  };

  const tile: GraphTile = {
    tileKey,
    nodes: Object.entries(nodes).map(([id, coord]) => ({
      id,
      lat: coord.lat,
      lon: coord.lon
    })),
    neighbors
  };

  graphCache[tileKey] = tile;

  return { tileKey, nodes };
}

describe("A* pathfinding (single-tile)", () => {
  it("finds a path between A and D and prefers the cheapest route", async () => {
    seedSingleTileGraph();

    const path = await aStarWithOnDemandTiles(["A", "D"]);
    // Existence
    expect(Array.isArray(path)).toBe(true);
    expect(path.length).toBeGreaterThan(0);

    // Starts at A, ends at D
    expect(path[0]).toBe("A");
    expect(path[path.length - 1]).toBe("D");

    // Should take A -> B -> C -> D (4 nodes) instead of A -> B -> D (3 nodes but heavier: 11 total)
    expect(path.length).toBe(4);
  });

  it("defaults to Euclidean heuristic when no metric is provided", async () => {
    seedSingleTileGraph();

    const path = await aStarWithOnDemandTiles(["A", "D"]);
    expect(path[0]).toBe("A");
    expect(path[path.length - 1]).toBe("D");
    expect(path.length).toBe(4);
  });

  it("accepts a custom distance metric (haversine) and still finds the same path here", async () => {
    seedSingleTileGraph();

    const path = await aStarWithOnDemandTiles(["A", "D"], haversineDistance);
    expect(path[0]).toBe("A");
    expect(path[path.length - 1]).toBe("D");
    expect(path.length).toBe(4);
  });

  it("returns [] when start or goal is missing from the graph", async () => {
    seedSingleTileGraph();

    const pathMissingStart = await aStarWithOnDemandTiles(["Z", "D"]);
    expect(pathMissingStart).toEqual([]);

    const pathMissingGoal = await aStarWithOnDemandTiles(["A", "Z"]);
    expect(pathMissingGoal).toEqual([]);

    const pathMissing = await aStarWithOnDemandTiles(["X", "Z"]);
    expect(pathMissing).toEqual([]);
  });

  it("returns [] when no path exists between start and goal", async () => {
    // Build two disconnected components in the same tile
    const tileKey = "0,0";
    const baseLat = 0.05;
    const baseLon = 0.05;

    const nodes = {
      A: { lat: baseLat, lon: baseLon },
      B: { lat: baseLat, lon: baseLon + 0.005 },
      // disconnected component
      C: { lat: baseLat + 0.005, lon: baseLon + 0.02 },
      D: { lat: baseLat + 0.005, lon: baseLon + 0.025 }
    };

    const neighbors: Record<string, { id: string; weight: number }[]> = {
      A: [{ id: "B", weight: 1 }],
      B: [{ id: "A", weight: 1 }],
      C: [{ id: "D", weight: 1 }],
      D: [{ id: "C", weight: 1 }]
    };

    const tile: GraphTile = {
      tileKey,
      nodes: Object.entries(nodes).map(([id, coord]) => ({
        id,
        lat: coord.lat,
        lon: coord.lon
      })),
      neighbors
    };
    graphCache[tileKey] = tile;

    const path = await aStarWithOnDemandTiles(["A", "D"]);
    expect(path).toEqual([]);
  });
});