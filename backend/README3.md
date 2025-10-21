# Backend Server

## Endpoints

### Activities

- **POST /upload-csv**: Uploads CSV from Google Sheets or local file and caches activities.
- **GET /activityLocations**: Returns initial activity locations from sample CSV.

### Weather

- **POST /upload-weather-csv**: Fetches weather data for loaded tiles, computes Voronoi polygons, and assigns weather to activities.

### Tiles

- **POST /update-visible-tiles**: Updates visible tiles and triggers activity, graph, and weather updates.

### Redlining

- **POST /highlight-redlining**: Returns redlining features filtered by visible tiles.

### Filters

- **POST /filter**: Filters activities by criteria (boolean or operator-based).

### Routing

- **POST /find-path**: Calculates best routes through activities using multi-stop A\*.

---

## Installation

`npm install`
Also create a .env file and paste

DEMO_KEY=RRoPNnRfxqIaWFb4DIFscvVH3VPMAv6n6OzAWKFN
NOAA_API_TOKEN= byNMxnYoSnQIOZtGlseYbkalildsKwCi
PORT=3001
SPREADSHEET=https://docs.google.com/spreadsheets/d/1966LRbZilujssoH7i9mXXpTeDbQ9RDStNPl0sNibOvw/export?format=csv&gid=0

Add only after sprint 6 but you will find these inside of your firebase console
FIREBASE_PROJECT_ID= ...
FIREBASE_CLIENT_EMAIL= ...
FIREBASE_PRIVATE_KEY= ...

at last download the redlinning data and create a data folder under backend, inside palce a file named redliningData.json found here:
https://drive.google.com/file/d/1vCFbyVQl_5ABWLulOGKhuuiWA1i2cK_R/view?usp=drive_link

## Scripts

| Command                  | Description                                             |
| ------------------------ | ------------------------------------------------------- | ------------------------------- |
| `npm run dev`            | Start server in development mode using ts-node.         |
| `npm run debug`          | Start server with Node.js inspector for debugging.      | Go to chrome://inspect/#devices |
| `npm run test`           | Run all tests using Vitest.                             |
| `npm run test:watch`     | Run Vitest in watch mode.                               |
| `npm run test:external`  | Run tests that require external resources.              |
| `npm run test:file`      | Run Vitest for a single file.                           |
| ------------------------ | ------------------------------------------------------- |

## Task 1
### Task 1: Code Dive

- #### Reflect on the prompts you tried and what you got out of each of them.

Prompt1 = "Based on the folder structure and file names in this backend directory, provide a high-level architectural overview of this project. What is its primary purpose, and what are the main components or modules? Describe it as if you were explaining it to a project manager."

Prompt2 = "Analyze the code within the key files. Trace the flow of a typical API request, for example, creating a new user or fetching a list of items. Start from the HTTP endpoint in the route files, through any middleware, to the service or controller logic, and finally to the database models. List the key files and functions involved in this flow. Also, draw a markdown graph indicating the workflow."

Prompt3 = "Examine all the model files in the models/ directory. What are the main entities (tables/collections) and how do they relate to each other? Show me the key fields for each model and identify any one-to-many, many-to-many, or foreign key relationships."

Depending on the words we put in, AL also focus on the various aspects that we want it to cover, such as the flow of the API request, the data models, the database schema, the routing, and the middleware.

- #### Reflect on the prompts you tried and which parts of the code you think you will need to work with. What do you understand at this point? What do you not understand? As you work on this sprint, what remains on the “do not understand” list?

What we Understand:
1. For the current backend structure, we have a well-organized Express.js backend with multiple handlers for different functionalities (activity parsing, weather data, location handling, etc.)

2. Here is the TODO, we need to implement the following:
a. A getcsv endpoint for retrieving CSV file contents with proper error handling
b. An ACS API proxy endpoint for reverse geocoding with census data
c. Playwright tests for API testing
d. Example ACS API queries and responses for testing

What we Don't Understand:
1. ACS API Details: Which specific ACS API endpoints/variables are you targeting? What are the exact parameter requirements for the reverse lookup? Do we have API credentials/authentication set up?
2. CSV Parser Integration: Which CSV parser from the previous sprint should be used? Where should CSV files be stored/located?
3. Error Response Format: What specific error response format is required? 
4. Overall: how does backend and front end interate with each other. 


## Task 4: Testing your server
- #### Which endpoints need to be tested? What kinds of requests should your server handle, and how can parameters vary in important ways? Which error responses did you build?

For the following endpoints, we need to test: A valid request, edge cases, error handling 

1. Root Endpoint ( / )
- Test that it returns the welcome message
- Verify status code 200
2. ACS Proxy Endpoint ( /acs-proxy )
- Test valid coordinates with different granularity levels (all, us, state, county, place)
- Test invalid granularity combinations
- Test missing required parameters
3. Activity Locations Endpoint ( /activityLocations )
- Test successful retrieval of activity data
- Verify response structure (count and data fields)
- Test error handling CSV Endpoint ( /getcsv )
- Test with valid filenames
- Test with missing filename parameter
- Test with non-existent files
- Verify proper error responses Filter Endpoint ( /filter )
- Test with valid filter parameters
- Test with invalid filter formats
- Test with empty filters
- Verify filtered results match expectations Path Finding Endpoint ( /find-path )
- Test with valid start and end points
- Test with invalid points
- Test with multiple waypoints
- Verify path calculation accuracy

### Reflection

1. #### Race Conditions

- ##### Which different kinds of users might be using C@B during registration? Come up with at least 3 stakeholders who would interact with C@B in different ways.
The different stakeholders who would interact with C@B would be students, professors, course registrars, and the software developers behind C@B. Students would want to look for classes they want to register for/are interested in shopping for on C@B. Professors would want to update their course descriptions and distribute override requests on C@B. Registrars would want to make sure the lecture & section times and locations are accurately reflected on C@B. Software developers behind C@B would want to make sure bugs are handled promptly and resolved so that C@B functionalities perform well, especially during high-traffic times.
- ##### What kinds of race conditions might you be worried about when you’re building a tool for these different users during a high-traffic time?
During a high-traffic time, like during registration period or shopping period, there will be a lot of students trying to access and register for classes. It is not uncommon for students to compete for the last spot in an almost full course. A race condition we would be concerned about is when these two students try to register when there is only one seat left, but due to threads trying to access the course and try to register these two students simultaneously, the system can incorrectly allow both students to register. Then, the course would be overbooked and have incorrect student registration. Another rcae condition we would be worried about is when a student tries to register for a course that has a prerequisite they haven't taken, but has registered for right before registering for the upper level course that takes the previous course as a prerequisite. Because the system might incorrectly think that the student has already registered for the prerequisite, this can cause a race condition where the student will be allowed to enroll in the upper class, which would be a case where an incorrect academic record due to a race condition creates room for students to manipulate their courses with requirements.

- ##### Why does the final design use a single getcsv endpoint rather than two separate endpoints to load and view? Suppose they had done loadcsv and viewcsv instead: what would have happened if there were multiple clients calling the server at the same time?
Using two separate endpoints to load and view can cause race conditions. For example, if there were multiple clients calling the server at the same time, when the second client calls viewcsv, they could get the first client's csv and vice versa. This could be a serious data leak issue too and a single getcsv endpoint helps create a safer design that performs more accurately and closer to what we want.

2. #### Your Learning
- ##### What has been new to you in this sprint (at both the technical and the conceptual level)?


On the technical level, we learn how to integrate with external APIs like the Census Bureau's ACS API for reverse geocoding, implement CSV parser handlar that works sd middleware that integrates our CSV parser or  third-party services into the server application. We also did error handling patterns for API requests with proper HTTP status codes and descriptive messages for the front-ends. 

On the conceptual level, we learn how to understand race conditions in multi-user systems and their implications, design endpoints to prevent data leakage between clients, and why it is important to implement proper validation for API parameters to ensure data integrity. We also learn how to conduct testing in a mocking environment that does not actually call the API, but instead uses mock handlers to simulate API responses. This helps us test our server application more thoroughly and ensure that it behaves as expected in different scenarios.


- ##### What is something that you think you might not understand, and want to focus on investigating more in the next sprint? 

We would like to better understand the overall interaction between the functions in the server application. While we understand the individual components like the CSV parser handler and ACS API proxy endpoint, we'm not entirely clear on how these components work together to provide the complete functionality. Additionally, we're interested in learning about good architectural concepts and design patterns to keep in mind if we were to design a similar system from scratch ourselves.


## CSCI 1340 Supplemental Challenge - Security Implementation
### Overview
Addresses two security vulnerabilities:
1. Rate Limiting - Prevents DoS attacks (20 requests/minute per IP)
2. Path Traversal Prevention - Secures file access with role-based permissions

### Initial Plan
**Problem Analysis**: Web servers are vulnerable to DoS attacks through request flooding and unauthorized file access via path traversal (e.g., `../../../etc/passwd`).

**Design Decisions**:
- Rate limiting: IP-based tracking with sliding window approach for fair resource allocation
- File security: Role-based directory structure with filename sanitization to prevent traversal attacks
- Authentication: Simple Bearer token system for role identification
- Error handling: Consistent responses that don't leak system information

### Implementation
#### Threat 1: Rate Limiting (`threat1.ts`)
- IP-based tracking with in-memory Map
- 60-second sliding window, HTTP 429 for exceeded limits
#### Threat 2: Secure File Access (`threat2.ts`)
- Role-based directories (public/restricted/admin)
- Filename sanitization preventing `../` attacks
- Token-based authentication (Bearer tokens)

### Security Features
- DoS prevention through rate limiting
- Path traversal attack blocking
- Role-based access control
- Input validation and sanitization
- Consistent error responses

### Design Choices

#### Errors/Bugs:
#### Tests:

1. API Test Failures: Had failing tests for Filter and Find Path endpoints that expected 200 status but received 500. Resolved by implementing proper mock handlers in the test file with parameter validation and appropriate responses.

2. ACS Proxy Validation: Test for invalid granularity combinations was failing. Fixed by adding validation logic to the mock ACS proxy handler to check for valid granularity levels and ensure proper hierarchy.

3. Chatgpt was used to generate a lot of the initial code in the acs proxy handler. However, the code it generated wasn't perfect. We had to talk with it back and forth specifying more details until it gets closer and closer to what we want. Nevertheless, Chatgpt alone couldn't get us to the correct code. There were mistakes with how the parameters were handled like for vs in, and these we had to resolve manually by comparing it to the expected API url and seeing what's different. We had to go through a similar process for the geocoder API too.


#### How To…
1. 'npm run dev' on one terminal and 'npx playwright test' on another terminal
2. 'npm run dev' on one terminal and 'npx run test' on another terminal

#### Team members and contributions (include cs logins):
sjung03: Task 2, User story 2, race condition reflections
yyu111: Task 1, User story 1, Task 3, your learning reflections, supplemental challange(only Mia register for grad level)

#### Collaborators (cslogins of anyone you worked with on this project or generative AI):
Claude 3.7/ChatGPT4: explianing code functionality when starting, idea inspriation, Task 1, generate a set of example queries, generate initial code in acs proxy handler, geocoder api, generate example testing cases, syntax check,  debug logic, comments. 

#### Total estimated time it took to complete project:
7
#### Link to GitHub Repo:
https://github.com/cs0320-f25/api-server-yyu111-sjung03

