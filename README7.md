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

### Task C: Communicating Concerns 
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


