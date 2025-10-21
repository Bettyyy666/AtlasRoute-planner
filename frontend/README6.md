# Sprint 6: Cloud and Communication

### Task 1: Summarize Authentication and Database

#### Prompts Used and Understanding Process

To understand this complex frontend architecture, I used several targeted prompts to analyze different aspects of the codebase:

**1st type Prompts Summary: "Analyze the authentication setup in this React application"**
Response Summary: The analysis revealed a dual authentication setup where Firebase client configuration exists in `firebaseConfig.ts` but the actual UI implementation uses Clerk components that are currently commented out. This indicated an incomplete migration or decision point between two auth providers.

**2nd type Prompts Summary: "Trace the data flow from search to map display"**
Response Summary: The investigation showed a clear pipeline: `SearchDashboard` → backend filtering → `Planner` state management → `MapView` rendering. This helped me understand how user interactions translate to visual map elements.

**3rd type Prompts Summary: "Identify the save functionality and its current state"**
Response Summary: The save feature is partially implemented with scaffolded Clerk authentication but lacks the complete data payload (full itinerary) and proper backend integration.

#### How This Relates to Code Understanding

These prompts helped me piece together the application's architecture:

**Authentication Architecture**: The codebase shows evidence of architectural indecision - Firebase is configured but Clerk components are scaffolded in the UI. This suggests the team was evaluating both options. The commented-out Clerk providers in `App.tsx` and auth hooks in `SaveButton.tsx` indicate recent development work that's not yet finalized.

**Data Flow Patterns**: By tracing the search-to-display pipeline, I understood that this is a state-heavy React application where `activitiesByDate` serves as the central data structure. The flow from `SearchDashboard` → `POST /filter` → `Planner` → `MapView` shows a clean separation between search logic and display logic.

**Incomplete Features**: The save functionality analysis revealed that while the UI scaffolding exists, the actual data persistence is incomplete. The `SaveTripButton` doesn't send the full itinerary data, indicating this feature is still in development.

#### Current Technical State

- **Authentication**: Dual setup (Firebase config + Clerk UI scaffolding) requiring architectural decision
- **Database**: Backend-mediated Firestore access with proper separation of concerns  
- **Maps**: Fully functional Mapbox integration with overlay support
- **Save Feature**: UI scaffolded but data payload incomplete

#### Implementation Priorities

Based on the code analysis, the critical path involves:
1. Finalizing authentication provider choice (Firebase vs Clerk)
2. Completing the save payload to include full `activitiesByDate` structure
3. Implementing proper error handling and user feedback
4. Adding user trip retrieval functionality

MASTER To-Do:

- Choose auth provider: Firebase Auth or Clerk, and configure. 
- Implement sign-in flow and auth state (Firebase GoogleAuthProvider + onAuthStateChanged, or Clerk ClerkProvider + useUser).
- Wire SaveTripButton to send activitiesByDate, trip metadata, and auth token to /savePins.
- Build payload in ItineraryPanel and pass props to SaveTripButton; show success/error toasts.
- Create an Axios client using VITE_API_BASE_URL and replace hard-coded URLs.
- Update Header to display user name and sign-in/out controls for chosen auth provider.
- Add “Previous Trips” page to list user trips via GET /trips.
- Preserve accessibility: keep keyboard shortcut for Save and announce results for screen readers.
- Optional: define shared trip/pin types to align with backend schema.


### Task 3: Communicating "up the ladder" (two issues)

### **Issue 1: Violation of FBI Data Usage Guidelines**

The FBI’s *Uniform Crime Reporting (UCR) Program* explicitly prohibits using arrest data to rank or compare geographic areas—yet this user story proposes doing exactly that. The FBI warns that such comparisons “provide no insight into the numerous variables that shape crime in a particular community” and “often create misleading perceptions that adversely affect communities and their residents.”  

Arrest data is collected for law enforcement planning and resource allocation, **not** for public safety comparisons. Using it this way would violate FBI data-use policies and create several serious risks:  

- **API Access Loss:** The FBI could revoke our access if they detect misuse.  
- **Legal Liability:** Users might make harmful or discriminatory decisions based on misleading visualizations.  
- **Reputational Damage:** Experts could publicly criticize our misuse of official data.  

As developers, we have an ethical and professional duty to explain these data limitations to stakeholders—not to implement features that fundamentally misrepresent what the data means, no matter how appealing they might seem.

---

### **Issue 2: Statistically Invalid “Safety” Metric**

The proposed formula—**arrests divided by population**—is not a valid measure of safety. Arrests reflect **policing activity**, not actual crime rates or personal risk. A high arrest rate might indicate proactive policing, resource availability, or enforcement focus on specific communities. Conversely, a low arrest rate might reflect underreporting, limited police presence, or community distrust of law enforcement.  

Multiple confounding factors make geographic comparisons meaningless:  

- **Reporting Inconsistency:** UCR participation is voluntary and uneven; missing data falsely appear as “zero arrests.”  
- **Population Mismatch:** Tourist destinations and college towns have transient populations not captured in census data.  
- **Jurisdictional Overlap:** City, county, and federal agencies report differently, often across inconsistent boundaries.  
- **Bias and Context:** Enforcement priorities and systemic bias can inflate or suppress arrest counts independently of crime.  

The result would be a **misleading visualization**—for example, labeling a well-policed urban area as “dangerous” while showing an under-resourced rural area as “safe.” Such distortions could perpetuate *digital redlining*, harm community reputations, and mislead users into discriminatory or unsafe choices.


### Supplemental Challenge (S_DIST/1340)
Authentication currently happens **only on the frontend** (via Firebase Auth), but the **backend never verifies** who is making requests.  
As a result, **anyone** who knows your endpoints can spoof requests to add, delete, or modify pins — pretending to be a real user.

---

## Two Separate Concerns

### 1. Authentication — *Who are you?*
The backend must verify that each incoming request comes from a **legitimate authenticated user**, not just trust data from the client.

### 2. Authorization — *What are you allowed to do?*
Even after authentication, users must be restricted to **their own data**.  
The backend should ensure that the verified user ID matches the resource being accessed.

---

## High-Level Fix (3 Steps)

1. **Verify Tokens Server-Side**  
   - Use the **Firebase Admin SDK** to verify the `Authorization: Bearer <idToken>` header.  
   - Reject requests with missing or invalid tokens (`401 Unauthorized`).

2. **Attach Verified User to Request**  
   - Middleware extracts the verified `uid` from the token and stores it in `req.user`.

3. **Enforce Authorization in Handlers**  
   - Use the verified `req.user.uid` for all database operations.  
   - If a client-supplied `userId` is included, ensure it matches the verified one (`403 Forbidden`).

### Reflection
1. #### Code Review (Your Own Work)

##### Yanmi Yu:
Looking back at my code, there are several areas I'm genuinely dissatisfied with:

**FBI Backend Implementation:** My FBI API integration is frankly messy. The error handling is inconsistent - sometimes I return generic error messages, other times I let exceptions bubble up without proper context. The data transformation logic is scattered across multiple functions without clear separation of concerns. Given more time, I would refactor this into a proper service layer with standardized error responses and better logging for debugging.

**Accessibility Implementation:** While I implemented WCAG requirements, the screen reader announcements are inconsistent and sometimes confusing. I hardcoded many aria-labels instead of creating a systematic approach to accessibility messaging. The focus management during state transitions could be much smoother. I'm not sure how to best standardize this across all components without creating overly verbose announcements.

**Testing Coverage:** While I wrote comprehensive tests for state changes, I realize I focused too heavily on happy path scenarios. My error handling tests are superficial and don't cover edge cases like network timeouts or malformed API responses.

Despite these issues, I am satisfied with the overall user experience flow and the successful integration of multiple data sources, even if the underlying implementation could be cleaner.  

#### Zihan Wang
- **Implementation Successes:**
  - Successfully implemented core Firebase trip features: save, load, and update.
  - Added graceful fallback mechanisms (in-memory sorting, null checks) to handle missing Firestore indexes and null activity data.

- **Identified Weaknesses:**
  - Used `userId` from client requests without server-side verification, creating a major security vulnerability.
  - Error handling was reactive—issues like missing indexes were only addressed after causing runtime crashes.

- **Security & Authentication:**
  - Thoroughly documented the security flaw in the Supplemental Challenge.
  - Developed a proof-of-concept fix using authentication middleware.
  - Acknowledged that token verification should have been integrated from the beginning, not retrofitted later.

- **Reflection & Takeaways:**
  - Recognized the importance of defensive programming—anticipating failures rather than reacting to them.
  - Although the POC demonstrates understanding of the correct fix, full integration of authentication middleware remains incomplete due to time constraints.
  - Overall, satisfied with the depth of analysis and documentation but disappointed that the production code still contains the vulnerability.


1. #### Code Review (Others' Work)

**Repository Reviewed:** `https://github.com/cs0320-f25/api-server-wsiemins-hsoaresb`

**Pull Request Link:** https://github.com/cs0320-f25/api-server-wsiemins-hsoaresb/pull/1#pullrequestreview-3353935749


#### Yanmi Yu's Review:

**Overall Assessment:**
The codebase is largely fit for purpose—it successfully retrieves, validates, and returns structured FBI or ACS data based on user coordinates, while maintaining clear modular boundaries between routing, data fetching, and validation. It is easy to understand, with consistent naming, documentation, and schema-based validation that make the data flow transparent.
However, for production or large-scale deployment, there are several areas where the code could be strengthened in terms of robustness and readiness for change.

1. Fit for Purpose
The endpoints fulfill their intended purpose and are responsive to valid user inputs.
Strengths: Clean separation between route registration (register*Handler), core logic (mainHandler), and data access (fetchFBIDataFromAPI, getCensusCodes). Schema validation (Zod) ensures that malformed data from the FBI API or local files is caught early.
Concern: Accessibility here primarily refers to response reliability. If the external API becomes unavailable or slow, users receive an opaque error.
Suggestion: Introduce clearer client-facing error messages and fallback mechanisms such as cached data or partial responses, so the system remains “accessible” even during outages.

2. Ready for Change
The design is modular and testable—core logic is isolated and data fetchers are injected, which makes refactoring or mocking straightforward.
Concern: Hardcoded constants (e.g., 2024, API URLs) and the lack of configuration abstraction make future API updates more expensive.
Suggestion: Move all variable elements (year, API key, base URLs) to a configuration file or environment manager, so future dataset or endpoint changes require no code edits.
Concern: The file path resolution logic assumes a static directory structure.
Suggestion: Centralize data-path configuration and use dependency injection for testing or environment-specific overrides.

3. Robustness against Bugs
The code has layered try/catch protection and schema validation, but robustness could be improved against network errors or back-end crashes.
Examples:
fetch() calls may hang indefinitely or fail transiently.
When the FBI API returns malformed JSON, the system raises a generic error rather than distinguishing between server failure and bad data.
Suggestions:
Add request timeouts and exponential-backoff retries.
Use structured logging (e.g., Winston) to record failures with context.
Validate the existence of required environment variables (e.g., FBI_API_KEY) at startup and fail fast if missing.

#### Zihan Wang's Review:

**Overall Assessment:**
The codebase has solid backend engineering practices with clear modularization and thoughtful validation layers. It effectively integrates external data sources (FBI API and Census API) while maintaining logical flow and type safety through Zod schemas. However, there are opportunities to improve readability, reduce function complexity, and enhance error resilience under production loads.

**Key Areas Reviewed:**
1. **Code Fitness for Purpose:** 
   - The code meets its functional goal of fetching and processing FBI employee and arrest data with location-based granularity.  
   - API endpoints are responsive and structured logically, though improved caching and pagination support could enhance performance for large-scale queries.  

2. **Readiness for Change:**
   - The modular design allows for easy extension (e.g., adding new data endpoints or alternate sources).  
   - However, some large functions (like `mainHandler`) could be broken into smaller, single-purpose helpers to improve maintainability and facilitate testing.  

3. **Robustness Against Bugs:**
   - Error handling is present and thoughtful, particularly around missing Census codes and invalid parameters.  
   - Additional safeguards (e.g., retry logic or graceful fallbacks for API downtime) would further strengthen reliability under network instability.  

4. **Code Clarity and Understanding:**
   - The code is generally readable, with consistent naming and detailed JSDoc comments.  
   - Some areas (especially nested try/catch and long switch cases) could benefit from simplification or clearer separation of responsibilities.  

**Specific Comments Made:**
- Suggested refactoring `mainHandler` into smaller functions (e.g., parameter validation, URL construction, and response formatting).  
- Recommended adding caching or throttling for frequent external API calls.  
- Noted that some error responses could be standardized for consistency across routes.  

3. #### Throttling

Authentication systems like Clerk implement throttling to prevent unauthorized access and system overloading by limiting login attempts and queries within timeframes.

**Security vs. Usability Balance:**
Throttling prevents brute force attacks but can frustrate legitimate users who get temporarily locked out. Banking apps benefit from this protection, though it may inconvenience users needing emergency access.

**Security Benefits:**
- Prevents brute force password attacks
- Blocks data scraping and account enumeration
- Protects server resources from overload

**Development Challenges:**
- Slows automated test suites making rapid requests
- Interrupts developer workflows during frequent logins
- Complicates integration testing and debugging

**Solutions:**
Development teams use separate throttling rules for testing environments, higher limits for service accounts, or bypass mechanisms for developers while maintaining strict production limits.

### Design Choices

#### Errors/Bugs:
#### Tests:
#### How To…

#### Yanmi Yu:
**1. State and County Boundary Visualization:**

**Errors/Bugs:**
- County boundaries (red lines) not rendering visually on map despite successful data processing
- State boundaries (blue lines) render correctly, but county boundaries remain invisible
- Mapbox layer rendering fails silently with valid GeoJSON data and proper styling

**Tests:**
- Console logs confirmed "Rendered 1 states and 1 counties" message
- Backend API returns valid state and county GeoJSON data
- Added debugging logs to verify GeoJSON structure, layer addition, and source validation
- Increased line width (1→3) and opacity (0.5→0.8) for visibility testing

**How To:**
- Investigate Mapbox layer z-index ordering (counties may be rendered behind other layers)
- Check data format compatibility with Mapbox version
- Verify layer source binding and ensure county layer is added after map load
- Test with simplified county GeoJSON data to isolate rendering issues
- Consider alternative rendering approach or Mapbox layer types for county boundaries

**2. Browser-Specific Test Failures (Firefox vs Chrome/Safari)**

**Issue:** Tests pass individually and in Chrome/Safari, but Firefox fails when running the full test suite.

**Root Cause:** Parallel browser execution creates database conflicts - browsers interfere with each other's database operations during simultaneous test runs.

**Solutions:**
1. **Single Browser:** Modified `playwright.config.ts` to run one browser only (commented out Firefox/WebKit)(Ooptions)
2. **Command Line:** Use `npx playwright test --project=webkit` for Chrome-only execution

**Technical Notes:** Firefox's slower DOM rendering + parallel execution race conditions cause `Test timeout of 30000ms exceeded` errors.

**TA Guidance:** "As long as the test passes for at least one browser, that is completely fine!"

#### Zihan Wang

**1. Firestore Composite Index Error: "The query requires an index"**

#### Errors/Bugs:  
A `FAILED_PRECONDITION` error occurred in Firestore with the message: *“The query requires an index. You can create it here…”* This happened when fetching trips using the endpoint `GET /trips/:userId?destination=...`. The backend query combined multiple `where()` filters with an `orderBy("createdAt", "desc")`, which requires a composite index in Firestore. Because no such index existed yet, Firestore threw an exception, and the backend crashed with a 500 error since the exception wasn’t handled properly.

#### Tests:  
To reproduce the issue, a request was made to `GET /trips/:userId?destination=New York` before creating the necessary Firestore index. This consistently caused the backend to crash with a `FAILED_PRECONDITION` error. After applying the fix, the same request no longer caused a crash. Instead, the system logged a warning and returned results successfully by performing an in-memory sort. Testing confirmed that the API now handles missing indexes gracefully, preserves sorting by `createdAt`, and avoids 500-level errors.

#### How To Fix :  
The solution was to wrap the query in a `try-catch` block and add a fallback mechanism. If Firestore throws an index-related error, the system now catches it, logs a warning, and reruns the query without the `orderBy()` clause. The results are then sorted in memory as a temporary measure. This ensures that the feature continues to work even while Firestore builds the required index in the background. The key lesson learned is that Firestore composite indexes can take several minutes to generate, so it’s important to handle these errors gracefully and provide fallback logic to prevent crashes and maintain uptime.


#### Team members and contributions (include cs logins):
Yanmi Yu(yyu111): task 1, task 2.2
Zihan Wang(zwang685): task 2.3, task 3
Coprogram: task 4, supplemental challenge

#### Collaborators (cslogins of anyone you worked with on this project or generative AI):

Claude 3.7/ChatGPT4: explianing code functionality when starting, idea inspriation, Task 1-3 and supplement, generate a set of example code for keyboard, generate initial code for server integration, geocoder api, generate example testing cases, syntax check,  debug logic, comments. 

#### Total estimated time it took to complete project:
20

#### Link to GitHub Repo:  
https://github.com/cs0320-f25/frontend-mockup-yyu111-zwang685



