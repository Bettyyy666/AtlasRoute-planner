# Sprint 4: API Server

### Supplemental Challenge (1340/S_DIST)
1. National Transit Map - All Stop Locations
- Relevance: This dataset provides comprehensive geographic coordinates and details for public transit stops across the United States. For a travel planner, this data would enable users to find nearby bus stops, train stations, and other transit points based on their current location or destination.
- Geographic Component: Contains precise latitude/longitude coordinates for transit stops, making it directly compatible with our coordinate-based FBI arrest data queries.
- Integration Potential: Could be combined with our existing location-based services to provide users with safety information about transit stops and surrounding areas.

1. Transportation Public Finance Statistics (TPFS) - Department of Transportation
- Relevance: This dataset contains financial and operational data about public transportation systems, including ridership statistics and service coverage by geographic region.
- Geographic Component: Organized by metropolitan areas, states, and transit agencies, providing regional context for transportation planning.
- Integration Potential: Could help users understand the quality and availability of public transportation in different areas, complementing safety data with practical transit information.

3. Trips by Distance - Department of Transportation
- Relevance: This dataset tracks travel patterns and trip distances across different geographic regions, providing insights into common travel routes and transportation preferences.
- Geographic Component: Includes origin-destination data and regional travel patterns that could inform route planning algorithms.
- Integration Potential: Could be used to suggest popular or efficient travel routes while incorporating safety considerations from our FBI arrest data.

#### Most Important Dataset: National Transit Map - All Stop Locations

I believe the National Transit Map dataset is the most critical for our travel planner because the precise coordinate data aligns perfectly with our existing lat/lon-based FBI query system. Besides, it is a critical components for the users' need as users would want to see transit options near any location. This also enables the unique combination of public safety data with practical transportation information, helping users make informed decisions about both where to go and how to get there safely. 

#### Implemention plan:

1. Uses Haversine formula to calculate distances and filter stops within the specified radius
2. Supports filtering by transportation mode (bus, subway, commuter rail, etc.)
3. Can filter for wheelchair accessible stops
4. Results are sorted by distance from the query point
5. Provides aggregate statistics about transit coverage ?
6. Comprehensive validation and error handling for all inputs

#### To run unit test:
cd "src/Supplemental Challenge4"
npx playwright test transitQueryHandler.test.ts

### Design Choices
#### Errors/Bugs:
#### Tests:

#### Bug 1: Year Calculation Logic Error
This was a logic bug where the FBI query handler was returning the wrong year (2024 instead of 2023) even though the mock data contained data_year: 2023 . The issue stemmed from:
- Inconsistent year initialization (2023 vs intended 2024)
- Using year + 1 in the response without proper validation
- Missing validation to ensure returned data matched the requested year

#### Bug 2: Mock vs Real API Integration Issue
This was an architectural bug where the development server was making real FBI API calls with mock credentials, causing 403 Forbidden errors. The problem was:
- No separation between development and production API configurations
- Real API functions being used even during testing/development
- Missing dependency injection for mock implementations

Both bugs have been resolved right now by using proper dependency injection, year validation logic, and clear separation between mock and real API implementations.

#### Bug 3: API endpoint and Mock testing Issues
We had issues properly querying the FBI API endpoints initially along with configuring the API key properly. Also, some of the tests weren't working properly at first and seemed to have undefined behavior, but we realized that this was due to the server not being fully started before the tests ran.

#### How To…
1. 'npm run dev' on one terminal and 'npx playwright test' on another terminal
2. 'npm run dev' on one terminal and 'npx run test' on another terminal

#### Team members and contributions (include cs logins):
sjung03: User story 2, User story 1 related tests,
yyu111: User story 1, User story 1 related tests, supplemental challange(only Mia register for grad level)

#### Collaborators (cslogins of anyone you worked with on this project or generative AI):
Claude 3.7/ChatGPT4: brianstorm when starting, idea inspriation, generate initial code in fbi query handler, add error message for fbi query handler, generate example testing cases, syntax check,  debug logic, comments. 

#### Total estimated time it took to complete project:
10
#### Link to GitHub Repo:  
https://github.com/cs0320-f25/api-server-yyu111-sjung03


