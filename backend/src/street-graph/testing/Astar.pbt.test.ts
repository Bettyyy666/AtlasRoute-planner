import { describe, it, expect } from "vitest";
import { aStarWithOnDemandTiles } from "../Astar.js";
import { graphCache } from "../../globalVariables.js";
import type { GraphTile } from "../graphSchema.js";

// ============================================================================
// CORRECTNESS SUBPROPERTY PREDICATES
// ============================================================================
// A path P is correct iff it satisfies ALL of these subproperties:
// 1. VALIDITY: Each consecutive pair of nodes is connected by an edge
// 2. ENDPOINTS: P starts at start and ends at goal
// 3. OPTIMALITY: P has minimum total cost among all paths from start to goal
//
// Subproperties 1 and 2 are efficiently checkable (O(n) and O(1)).
// Subproperty 3 cannot be efficiently checked for arbitrary graphs,
// but we compare against Dijkstra or hard-code expected costs for concrete inputs.
// ============================================================================

/**
 * Subproperty 1: VALIDITY
 * Checks if path is valid (each consecutive pair connected by edge).
 * Runtime: O(|path|)
 */
function isValidPath(
  path: string[],
  neighbors: Record<string, { id: string; weight: number }[]>
): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    const u = path[i];
    const v = path[i + 1];
    const edge = (neighbors[u] || []).find((e) => e.id === v);
    if (!edge) return false;
  }
  return true;
}

/**
 * Subproperty 2: ENDPOINTS
 * Checks if path starts at start and ends at goal.
 * Runtime: O(1)
 */
function hasCorrectEndpoints(
  path: string[],
  start: string,
  goal: string
): boolean {
  if (path.length === 0) return false;
  return path[0] === start && path[path.length - 1] === goal;
}

/**
 * Helper: Compute total cost of a path by summing edge weights.
 * Returns Infinity if path is invalid.
 * Runtime: O(|path|)
 */
function pathCost(
  path: string[],
  neighbors: Record<string, { id: string; weight: number }[]>
): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const u = path[i];
    const v = path[i + 1];
    const edge = (neighbors[u] || []).find((e) => e.id === v);
    if (!edge) return Infinity;
    total += edge.weight;
  }
  return total;
}

/**
 * Subproperty 3: OPTIMALITY (via Dijkstra baseline)
 * We can't efficiently check optimality for arbitrary graphs,
 * but we can compute optimal cost with Dijkstra and compare.
 * Runtime: O(V log V + E) where V = vertices, E = edges
 */
function dijkstraCost(
  startId: string,
  goalId: string,
  neighbors: Record<string, { id: string; weight: number }[]>
): number | null {
  const dist: Record<string, number> = {};
  const visited = new Set<string>();
  const pq: Array<{ id: string; d: number }> = [];
  const insert = (id: string, d: number) => {
    pq.push({ id, d });
    pq.sort((a, b) => a.d - b.d);
  };
  dist[startId] = 0;
  insert(startId, 0);
  while (pq.length) {
    const { id, d } = pq.shift()!;
    if (visited.has(id)) continue;
    if (id === goalId) return d;
    visited.add(id);
    for (const e of neighbors[id] || []) {
      const nd = d + e.weight;
      if (dist[e.id] === undefined || nd < dist[e.id]) {
        dist[e.id] = nd;
        insert(e.id, nd);
      }
    }
  }
  return null;
}

// ============================================================================
// TEST UTILITIES
// ============================================================================

// Simple deterministic RNG (mulberry32)
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Build a single-tile grid graph with unit edge weights
function buildGridTile(width: number, height: number, obstacleProb: number, seed: number) {
  const rand = mulberry32(seed);
  const tileKey = "0,0";
  const baseLat = 0.05; // keep well within tile bounds
  const baseLon = 0.05;
  const step = 0.001;   // small spacing to avoid edges

  // Node ids: r{row}c{col}
  const nodes: { id: string; lat: number; lon: number }[] = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      nodes.push({ id: `r${r}c${c}`, lat: baseLat + r * step, lon: baseLon + c * step });
    }
  }

  const index: Record<string, { lat: number; lon: number }> = Object.fromEntries(
    nodes.map((n) => [n.id, { lat: n.lat, lon: n.lon }])
  );

  const neighbors: Record<string, { id: string; weight: number }[]> = {};
  const addEdge = (a: string, b: string) => {
    (neighbors[a] ??= []).push({ id: b, weight: 1 });
    (neighbors[b] ??= []).push({ id: a, weight: 1 });
  };

  // Potential 4-neighbor edges with obstacles
  const nodeId = (r: number, c: number) => `r${r}c${c}`;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const a = nodeId(r, c);
      // Right
      if (c + 1 < width && rand() > obstacleProb) addEdge(a, nodeId(r, c + 1));
      // Down
      if (r + 1 < height && rand() > obstacleProb) addEdge(a, nodeId(r + 1, c));
    }
  }

  const tile: GraphTile = { tileKey, nodes, neighbors };
  graphCache[tileKey] = tile;

  return { tileKey, index, nodeId };
}

// BFS baseline for shortest path in an unweighted graph
function bfsShortestPathLength(
  startId: string,
  goalId: string,
  neighbors: Record<string, { id: string; weight: number }[]>
): number | null {
  const queue: string[] = [startId];
  const dist: Record<string, number> = { [startId]: 0 };
  let qi = 0;
  while (qi < queue.length) {
    const u = queue[qi++];
    if (u === goalId) return dist[u];
    const nbrs = neighbors[u] || [];
    for (const v of nbrs) {
      if (dist[v.id] === undefined) {
        dist[v.id] = dist[u] + 1;
        queue.push(v.id);
      }
    }
  }
  return null;
}

describe("A* property-based tests (single-tile random grids)", () => {
  it("A* finds optimal path length vs BFS or returns [] when unreachable (seeded cases)", async () => {
    const cases = 15; // keep runtime modest
    const width = 6;
    const height = 6;
    const obstacleProb = 0.20; // 20% chance an edge is blocked

    for (let k = 1; k <= cases; k++) {
      // Clear graph cache before each case
      for (const key of Object.keys(graphCache)) delete graphCache[key];

      const { tileKey, nodeId } = buildGridTile(width, height, obstacleProb, 1234 + k);
      const tile = graphCache[tileKey]!;

      // Random start/goal (using the same seed for reproducibility)
      const rnd = mulberry32(5678 + k);
      const sr = Math.floor(rnd() * height);
      const sc = Math.floor(rnd() * width);
      const gr = Math.floor(rnd() * height);
      const gc = Math.floor(rnd() * width);
      const start = nodeId(sr, sc);
      const goal = nodeId(gr, gc);

      // BFS baseline length
      const bfsLen = bfsShortestPathLength(start, goal, tile.neighbors);

      // Run A*
      const path = await aStarWithOnDemandTiles([start, goal]);

      if (bfsLen === null) {
        // No path exists; A* should return []
        expect(path).toEqual([]);
      } else {
        // ========================================
        // STEP 3: Invoke subproperty predicates
        // ========================================

        // Subproperty 1: VALIDITY - each consecutive pair is connected
        expect(isValidPath(path, tile.neighbors)).toBe(true);

        // Subproperty 2: ENDPOINTS - starts at start, ends at goal
        expect(hasCorrectEndpoints(path, start, goal)).toBe(true);

        // Subproperty 3: OPTIMALITY - cost matches BFS optimal
        // For unit-weight graphs, path length - 1 = number of edges = cost
        expect(path.length - 1).toBe(bfsLen);

        // ========================================
        // STEP 4: Hard-coded aspects
        // ========================================
        // For unit-weight grids, we can hard-code additional properties:
        // - No cycles (path should have unique nodes)
        const uniq = new Set(path);
        expect(uniq.size).toBe(path.length);

        // - Path cost should equal path length - 1
        const cost = pathCost(path, tile.neighbors);
        expect(cost).toBe(path.length - 1);
      }
    }
  }, 20000);

  it("A* (haversine heuristic) matches Dijkstra cost on haversine-weighted grids", async () => {
    const cases = 10;
    const width = 5;
    const height = 5;
    const obstacleProb = 0.15;

    for (let k = 1; k <= cases; k++) {
      for (const key of Object.keys(graphCache)) delete graphCache[key];
      // Build grid with haversine weights
      const rand = mulberry32(2222 + k);
      const tileKey = "0,0";
      const baseLat = 0.05;
      const baseLon = 0.05;
      const step = 0.001;
      const nodes: { id: string; lat: number; lon: number }[] = [];
      for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
          nodes.push({ id: `r${r}c${c}`, lat: baseLat + r * step, lon: baseLon + c * step });
        }
      }
      const neighbors: Record<string, { id: string; weight: number }[]> = {};
      const nodeId = (r: number, c: number) => `r${r}c${c}`;
      const addEdge = (a: string, b: string) => {
        const A = nodes.find((n) => n.id === a)!;
        const B = nodes.find((n) => n.id === b)!;
        const w = Math.hypot(B.lon - A.lon, B.lat - A.lat); // Euclid in degrees; small scale consistency
        (neighbors[a] ??= []).push({ id: b, weight: w });
        (neighbors[b] ??= []).push({ id: a, weight: w });
      };
      for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
          const a = nodeId(r, c);
          if (c + 1 < width && rand() > obstacleProb) addEdge(a, nodeId(r, c + 1));
          if (r + 1 < height && rand() > obstacleProb) addEdge(a, nodeId(r + 1, c));
        }
      }
      const tile: GraphTile = { tileKey, nodes, neighbors };
      graphCache[tileKey] = tile;

      const rnd = mulberry32(3333 + k);
      const sr = Math.floor(rnd() * height);
      const sc = Math.floor(rnd() * width);
      const gr = Math.floor(rnd() * height);
      const gc = Math.floor(rnd() * width);
      const start = nodeId(sr, sc);
      const goal = nodeId(gr, gc);

      const dj = dijkstraCost(start, goal, neighbors);
      const path = await aStarWithOnDemandTiles([start, goal]);
      if (dj === null) {
        expect(path).toEqual([]);
      } else {
        // ========================================
        // STEP 3: Invoke subproperty predicates
        // ========================================

        // Subproperty 1: VALIDITY - each consecutive pair is connected
        expect(isValidPath(path, neighbors)).toBe(true);

        // Subproperty 2: ENDPOINTS - starts at start, ends at goal
        expect(hasCorrectEndpoints(path, start, goal)).toBe(true);

        // Subproperty 3: OPTIMALITY - cost matches Dijkstra optimal
        const cost = pathCost(path, neighbors);
        expect(Math.abs(cost - dj)).toBeLessThan(1e-9);

        // ========================================
        // STEP 4: Hard-coded aspects
        // ========================================
        // For these weighted graphs, we know:
        // - Path cost should be finite (not Infinity)
        expect(cost).toBeLessThan(Infinity);
        // - No cycles in optimal paths (path should have unique nodes)
        const uniq = new Set(path);
        expect(uniq.size).toBe(path.length);
      }
    }
  }, 20000);

  it("Admissible heuristic: haversine straight-line ≤ remaining path cost along final path", async () => {
    // Build a small open grid with haversine weights
    for (const key of Object.keys(graphCache)) delete graphCache[key];
    const tileKey = "0,0";
    const baseLat = 0.05;
    const baseLon = 0.05;
    const step = 0.001;
    const width = 5, height = 5;
    const nodes: { id: string; lat: number; lon: number }[] = [];
    for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) nodes.push({ id: `r${r}c${c}`, lat: baseLat + r*step, lon: baseLon + c*step });
    const neighbors: Record<string, { id: string; weight: number }[]> = {};
    const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]));
    const id = (r:number,c:number)=>`r${r}c${c}`;
    const add = (a:string,b:string)=>{
      const A=nodeById[a],B=nodeById[b];
      const w = Math.hypot(B.lon-A.lon,B.lat-A.lat);
      (neighbors[a]??=[]).push({id:b,weight:w});
      (neighbors[b]??=[]).push({id:a,weight:w});
    };
    for(let r=0;r<height;r++)for(let c=0;c<width;c++){ if(c+1<width) add(id(r,c),id(r,c+1)); if(r+1<height) add(id(r,c),id(r+1,c)); }
    graphCache[tileKey] = { tileKey, nodes, neighbors } as GraphTile;

    const start = id(0,0), goal = id(4,4);
    const path = await aStarWithOnDemandTiles([start, goal]);

    // ========================================
    // STEP 3: Invoke subproperty predicates
    // ========================================

    // Subproperty 1: VALIDITY - each consecutive pair is connected
    expect(isValidPath(path, neighbors)).toBe(true);

    // Subproperty 2: ENDPOINTS - starts at start, ends at goal
    expect(hasCorrectEndpoints(path, start, goal)).toBe(true);

    // Subproperty 3: OPTIMALITY - compare with Dijkstra
    const optimalCost = dijkstraCost(start, goal, neighbors);
    expect(optimalCost).not.toBeNull();
    const cost = pathCost(path, neighbors);
    expect(Math.abs(cost - optimalCost!)).toBeLessThan(1e-9);

    // ========================================
    // STEP 4: Hard-coded aspects
    // ========================================
    // For this specific graph (5x5 grid), we can hard-code expected properties:
    // - Start is (0,0), goal is (4,4), so Manhattan distance is 8 hops
    // - Euclidean path will be diagonal-ish, so path length should be reasonable
    expect(path.length).toBeGreaterThanOrEqual(2);
    expect(path.length).toBeLessThanOrEqual(width + height); // At most L-shaped

    // For each node in final path, heuristic ≤ remaining path cost along that path
    for(let i=0;i<path.length;i++){
      const u = path[i];
      const U = nodeById[u];
      const G = nodeById[goal];
      const h = Math.hypot(G.lon-U.lon, G.lat-U.lat);
      const remCost = pathCost(path.slice(i), neighbors);
      expect(h).toBeLessThanOrEqual(remCost + 1e-12);
    }
  });

  it("Waypoint monotonicity: enforcing a stop cannot yield cheaper total cost", async () => {
    // Build an open grid with unit weights
    for (const key of Object.keys(graphCache)) delete graphCache[key];
    const { tileKey, nodeId } = buildGridTile(6, 6, 0.0, 9999);
    const tile = graphCache[tileKey]!;
    const start = nodeId(0,0);
    const mid = nodeId(2,3);
    const goal = nodeId(5,5);

    // Get direct path
    const direct = await aStarWithOnDemandTiles([start, goal]);

    // Get path via forced waypoint
    const viaMid = [
      ...(await aStarWithOnDemandTiles([start, mid])).slice(0, -1),
      ...(await aStarWithOnDemandTiles([mid, goal]))
    ];

    // ========================================
    // STEP 3: Invoke subproperty predicates
    // ========================================

    // Both paths should satisfy validity and endpoints
    expect(isValidPath(direct, tile.neighbors)).toBe(true);
    expect(hasCorrectEndpoints(direct, start, goal)).toBe(true);

    expect(isValidPath(viaMid, tile.neighbors)).toBe(true);
    expect(hasCorrectEndpoints(viaMid, start, goal)).toBe(true);

    // ========================================
    // STEP 4: Hard-coded aspects
    // ========================================
    // For this specific unit-weight grid, we can hard-code:
    // - Path lengths in unit-weight grid reflect cost
    // - Enforcing mid should not be cheaper than direct
    const directCost = pathCost(direct, tile.neighbors);
    const viaMidCost = pathCost(viaMid, tile.neighbors);
    expect(viaMidCost).toBeGreaterThanOrEqual(directCost);

    // Path lengths should reflect costs (for unit weights)
    expect(viaMid.length - 1).toBeGreaterThanOrEqual(direct.length - 1);

    // Verify mid is actually in the via-mid path
    expect(viaMid).toContain(mid);
  });
});