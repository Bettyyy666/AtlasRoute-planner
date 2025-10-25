# Sprint 7: Pathfinding

### Task A: Code Walk
#### Core Components
1. **Graph Data Structure**
- Defined in `graphSchema.ts`:
  - `GraphNode`: Represents points with latitude/longitude coordinates
  - `GraphEdge`: Represents weighted connections between nodes
  - `GraphTile`: Contains nodes and adjacency lists for a geographic region

2. **Tile Management System**
- The map is divided into tiles (0.1 degree squares)
- `tileUtils.ts` manages:
  - Coordinate to tile key conversion
  - On-demand graph data loading
  - Geographic distance calculations using Haversine formula

3. **Data Flow**
```
Frontend Request → /find-path endpoint
  ↓
handleShortestPathRequest():
  1. Load required map tiles
  2. Find nearest nodes to start/end points
  3. Execute routing algorithm (A*/Dijkstra)
  4. Convert node IDs back to coordinates
  ↓
Frontend receives path coordinates
```

#### Integration Points

The backend exposes a RESTful endpoint `/find-path` that accepts:
```typescript
POST {
  points: [
    { lat: number, lng: number },  // start
    { lat: number, lng: number }   // end
  ]
}
```

And returns:
```typescript
{
  path: [
    { lat: number, lng: number },  // waypoints...
  ]
}
```

### Task C: Design And Prototyping
#### Route Search Implementation Plan

##### Overview
The route search feature will find optimal paths between activities using A* pathfinding with lazy loading of map data. This approach balances performance and memory usage by only loading map tiles as needed during the search.

##### Technical Architecture

###### 1. Data Structures
```typescript
interface MapTile {
  id: string;               // Tile identifier (e.g., "lat_lng")
  nodes: GraphNode[];       // Nodes within this tile
  edges: GraphEdge[];       // Edges connecting nodes
  bbox: BoundingBox;        // Tile boundaries
  loaded: boolean;          // Lazy loading status
}

interface GraphNode {
  id: string;
  lat: number;
  lng: number;
  edges: string[];         // Adjacent edge IDs
}

interface GraphEdge {
  id: string;
  start: string;          // Start node ID
  end: string;            // End node ID
  weight: number;         // Distance/time cost
  metadata?: any;         // Optional street/path info
}
```

###### 2. Core Components

**TileManager (Existing)**
- Manages the lifecycle of map tiles
- Implements lazy loading strategy
- Key methods:
  ```typescript
  async loadTile(lat: number, lng: number): Promise<MapTile>
  unloadTile(tileId: string): void
  getTileForCoordinate(lat: number, lng: number): string
  ```

**PathFinder (New)**
- Implements A* algorithm with tile-aware searching
- Key methods:
  ```typescript
  async findPath(start: Coordinate, end: Coordinate): Promise<Path>
  private async expandNode(node: GraphNode): Promise<GraphNode[]>
  private estimateDistance(a: Coordinate, b: Coordinate): number
  ```

###### 3. Lazy Loading Strategy

The system will:
1. Start with empty tile cache
2. Load tiles on-demand when:
   - Search enters a new geographic area
   - Expanding nodes near tile boundaries
3. Implement LRU cache for tiles:
   - Keep recently used tiles in memory
   - Unload least recently used when memory threshold reached

```typescript
class TileCache {
  private cache: Map<string, MapTile>;
  private lruList: string[];
  private readonly maxSize: number;

  async getTile(id: string): Promise<MapTile> {
    if (!this.cache.has(id)) {
      await this.loadTile(id);
      this.maintainCacheSize();
    }
    this.updateLRU(id);
    return this.cache.get(id)!;
  }

  private maintainCacheSize(): void {
    while (this.cache.size > this.maxSize) {
      const oldest = this.lruList.pop()!;
      this.cache.delete(oldest);
    }
  }
}
```

###### 4. A* Implementation Plan

1. **Initialize Search**
   ```typescript
   async function findRoute(start: Coordinate, end: Coordinate): Promise<Path> {
     const startTile = await tileManager.loadTile(start.lat, start.lng);
     const startNode = findNearestNode(startTile, start);
     
     const openSet = new PriorityQueue<GraphNode>();
     const closedSet = new Set<string>();
     
     openSet.add(startNode, 0);
     const gScore = new Map<string, number>();
     gScore.set(startNode.id, 0);
   }
   ```

2. **Expand Nodes**
   ```typescript
   private async expandNode(current: GraphNode): Promise<GraphNode[]> {
     const neighbors: GraphNode[] = [];
     
     for (const edgeId of current.edges) {
       const edge = await this.getEdge(edgeId);
       const neighborId = edge.end === current.id ? edge.start : edge.end;
       
       // Load new tile if neighbor is in different tile
       const neighborTile = this.getTileForNode(neighborId);
       if (!neighborTile.loaded) {
         await tileManager.loadTile(neighborTile.lat, neighborTile.lng);
       }
       
       const neighbor = await this.getNode(neighborId);
       neighbors.push(neighbor);
     }
     
     return neighbors;
   }
   ```

3. **Heuristic Function**
   ```typescript
   private estimateDistance(a: Coordinate, b: Coordinate): number {
     // Haversine distance plus additional cost estimates
     const baseDistance = haversine(a, b);
     const urbanityFactor = this.estimateUrbanDensity(a, b);
     return baseDistance * urbanityFactor;
   }
   ```

#### Memory Management

To prevent memory issues with large maps:

1. **Tile Size Optimization**
   - Each tile covers 0.1° × 0.1° area
   - Approximately 11km × 11km at 40° latitude
   - Average tile size: ~500KB-2MB depending on density

2. **Cache Strategy**
   - Keep maximum of N tiles in memory (N based on available RAM)
   - Prioritize tiles along the current search frontier
   - Unload tiles far from current search area

3. **Search Space Pruning**
   - Use geographic bounds to limit search area
   - Ignore tiles clearly outside reasonable path
   - Cache frequently used paths between popular locations

#### Visual Prototype
![taskC prototype image](./frontend/src/assets/taskC_prototype.png)


### Task D: Communicating Concerns
#### Step 1
#### Step 2
#### Step 3
#### Step 4

### Design Choices

#### Errors/Bugs:
#### Tests:
#### How To…

#### Team members and contributions (include cs logins):

#### Collaborators (cslogins of anyone you worked with on this project or generative AI):

##### Previous sprint contributor 
Sprint 3:
sjung03: Task 2, User story 2, race condition reflections
yyu111: Task 1, User story 1, Task 3, your learning reflections, supplemental challange(only Mia register for grad level)
Sprint 4:
sjung03: User story 2, User story 1 related tests,
yyu111: User story 1, User story 1 related tests, supplemental challange(only Mia register for grad level)
Sprint 5:
Yanmi Yu (yyu111): Task 1, Task 3, Meta Reflection marked for Yanmi
Zihan Wang (zwang685): Task 2, Supplement, Meta Reflection marked for Zihan
Coprogram: task 3 and supplement
Sprint 6:
Yanmi Yu(yyu111): task 1, task 2.2
Zihan Wang(zwang685): task 2.3, task 3
Coprogram: task 4, supplemental challenge

##### Sprint 7:
Yanmi Yu (yyu111):
Rui Zhou(rzhou52): 


#### Total estimated time it took to complete project:
#### Link to GitHub Repo:  
#### Link to asynchronous demo: 


