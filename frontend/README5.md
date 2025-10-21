# Sprint 5: Front-End Mockup

### Task 2: User Experience and Accessibility Auditing

#### Part 1: User Inyerface Experience

**Completion Time:** Approximately 10 minutes before abandoning the task at the third section.

**Experience Summary:**
The User Inyerface game demonstrates how poor design choices can frustrate users and drive them away from an application. The login phase alone consumed 5 minutes due to intentionally hostile design patterns. The experience was so aggravating that I abandoned the game rather than continuing, which perfectly illustrates how bad UX can cause user drop-off before they even engage with core functionality.

**Three Bad Design Choices:**

1. **Email Input Field Restrictions and Placeholder Behavior**
   - The form does not accept ".edu" email addresses, arbitrarily excluding a significant user demographic (students and educators)
   - The placeholder text does not automatically clear when users begin typing, creating visual confusion and making it difficult to verify input accuracy
   - **Why it's problematic:** This violates user expectations for standard form behavior and creates unnecessary barriers to account creation

2. **Misleading Button Hierarchy and Labeling**
   - The most visually prominent button in the center is labeled "Cancel" rather than the expected "Submit" or "Continue"
   - I repeatedly pressed this button after completing the form, expecting it to advance to the next step
   - **Why it's problematic:** This is a dark pattern that exploits learned behavior. Users are trained to click the primary (highlighted) button to proceed, and this intentional misdirection wastes time and creates frustration

3. **Deceptive Modal Window Controls**
   - When the countdown timer popup appears, the top-right button—which universally signifies "close" in modern UI conventions—actually enlarges the window instead
   - It took approximately 3 minutes to discover how to actually close the modal
   - **Why it's problematic:** This violates fundamental UI conventions and creates a sense of being trapped. The × or close button is one of the most universally understood UI patterns, and subverting it severely damages user trust and creates accessibility barriers

---

#### Part 2: Lighthouse Accessibility Audit

**Accessibility Score:** 91/100

**Audit Details:**
- Captured: October 11, 2025, 3:06 PM EDT
- Environment: Emulated Desktop with Lighthouse 12.4.0
- Browser: Chromium 135.0.0.0

**Key Issues Identified:**

1. **Contrast Issues**
   - Background and foreground colors do not have sufficient contrast ratio
   - Impact: Reduces legibility for users with visual impairments or those using devices in bright lighting conditions

2. **Names and Labels**
   - Select elements do not have associated label elements
   - Impact: Screen readers cannot properly announce the purpose of dropdown menus
   - Example: Data source selectors (ACS/FBI dropdowns) lack explicit labels

---

#### Part 3: Comparison of Three Accessibility Testing Methods

##### Testing Methods Used:

**1. Manual Code Review**
- Examined all React components (`.tsx` files) for semantic HTML and ARIA attributes
- Checked form elements for proper label associations
- Verified keyboard event handlers and navigation implementation

**2. Lighthouse Automated Audit**
- Ran accessibility scan with navigation mode on desktop
- Generated automated report with technical WCAG violations

**3. LLM Audit**
- Prompted Claude Code to analyze codebase

---

##### Detailed Findings by Method:

**Manual Code Review Found:**

✅ **Passes:**
- Image elements have descriptive alt attributes (`SearchBar.tsx:40`, `NotFound.tsx:10`)
- Proper heading hierarchy (h1, h2, h3) throughout application
- HTML document includes `lang="en"` attribute
- ARIA roles correctly implemented in LocationPicker (combobox/listbox pattern)
- Keyboard navigation working for LocationPicker dropdown (Arrow keys, Enter, Escape)
- Keyboard shortcuts implemented for highlight mode switching (Ctrl/Cmd + 1/2/3)

❌ **Issues Found:**
1. **Missing Form Labels** - Five select elements lack associated `<label>` elements:
   - Data Source select (`DataQueryPanel.tsx:143`)
   - Top Level select (`DataQueryPanel.tsx:167`)
   - Bottom Level select (`DataQueryPanel.tsx:179`)
   - Granularity select (`DataQueryPanel.tsx:193`)
   - Year select (`DataQueryPanel.tsx:205`)

2. **Improper Button Implementation** - Close icon uses `<img>` with onClick instead of `<button>` (`SearchBar.tsx:51-56`)

3. **Missing Table Captions** - Data results table lacks `<caption>` element (`DataQueryResult.tsx:61`)

4. **DatePicker Label Association** - Label not programmatically associated with input (`DatePicker.tsx:14-16`)

**Lighthouse Audit Found:**
- Contrast ratio issues (automated color analysis)
- Select elements missing explicit label associations
- Did NOT detect: image-as-button issue, missing table captions, keyboard navigation quality

**LLM Audit Found:**
- General recommendations about icon buttons needing aria-labels
- Theoretical suggestions about keyboard navigation patterns
- Focus management improvement ideas
- Did NOT catch: specific implementation issues, line numbers, actual code problems

##### Key Differences:

**Manual Code Review (Most Comprehensive)**
- Provides specific file names and line numbers
- Can trace implementation logic and verify functionality
- Catches semantic HTML violations
- Time-intensive but most thorough

**Lighthouse (Best for Speed and Automation)**
- Fast, repeatable, objective measurements
- Excellent for contrast ratios and technical violations
- Cannot evaluate behavioral aspects or user experience
- Misses semantic issues that are technically valid HTML

**LLM Audit (Good for Learning, Not for Finding Bugs)**
- Provides comprehensive checklists and best practices
- Makes educated guesses based on common patterns
- Cannot verify actual implementation
- Useful for education but not concrete bug identification


### Task 3
#### Write your evaluation (100-250 words total). 
Success Criterion 2.4.7 Focus Visible - The app originally lacked visible focus indicators for interactive elements like buttons and form controls. Users navigating with keyboards couldn't see which element had focus, making navigation extremely difficult. This has been addressed with custom focus styles providing clear visual feedback when hovering over interactive elements.

Success Criterion 2.1.1 Keyboard (No Exception) - Initially, key functionality like date selection and filter checkboxes were mouse-dependent. The filter checkboxes couldn't be toggled via keyboard. Keyboard shortcuts (Ctrl+B for Best Route, Ctrl+S for Save Trip, Ctrl+F for free, Ctrl+N for food nearby, Ctrl+P for parking ) and proper tab navigation have been implemented to resolve this.

Success Criterion 3.3.2 Labels or Instructions - Form inputs, particularly the date selection fields and Variables (comma-separated), lacked clear labeling and instructions. Users couldn't understand input expectations or formats. While some improvements were made(for example we added examples for the input), these areas still need comprehensive aria-labels and instructional text.

The app performs reasonably well on color contrast (1.4.1) and avoids keyboard traps (2.1.2). However, error identification (3.3.1) and non-text content labeling (1.1.1) require attention, especially for map elements and interactive components that lack descriptive alt text or aria labels.




### Supplemental Challenge (SDIST/1340)

- #### Step B: Is there any content that is lacking from the text-only site? E.g., if the text site elides images (or embedded resources like Twitter posts), what important information might be lost?

**1. Visual Context from Photography**
- News photographs provide critical emotional and contextual information that headlines alone cannot convey
- Example: A story about protests has very different impact with vs. without images showing crowd size, police presence, or participant demographics
- Portrait photography helps readers identify key figures in political and cultural stories
- Infographics and data visualizations are completely absent, forcing users to parse complex statistics through prose alone

**2. Audio Content (NPR's Core Medium)**
- NPR is fundamentally an audio-first news organization
- The text site strips all embedded audio players from stories, eliminating the primary storytelling medium
- Tiny Desk Concert videos and music performances are unavailable
- Audio clips that provide direct quotes, ambient sound, or interview context are reduced to transcribed text
- Impact: Users miss vocal tone, emotion, pronunciation (critical for international names/places), and the journalistic value of hearing sources directly

**3. Lost Information Hierarchy:**
The full site uses visual weight (large hero images, font sizes, placement) to signal story importance. The text-only site presents all headlines equally, making it harder to identify breaking news vs. feature stories.

- #### Step C: Pick one issue and make a plan to mitigate it in your README. 
When using mapping applications on mobile data, I've found that Mapbox's continuous tile loading can consume significant bandwidth—each pan or zoom triggers new tile requests, and the default high-resolution satellite imagery is particularly data-intensive. To mitigate this in our travel planner, I would implement a "Data Saver Mode" toggle that switches the map rendering strategy: instead of loading Mapbox tiles on every interaction, the mode would use the Mapbox Static Images API to generate a single static map image based on the current search results (using the bounding box of all markers), cached client-side using the Cache API with a 24-hour expiration. User interactions would be handled through an HTML canvas overlay for marker clicks rather than re-fetching tiles. 

Claude gave me some suggestions on how to implement this plan: 
   - (1) adding a React state hook `const [dataSaverMode, setDataSaverMode] = useState(false)`, 
   - (2) conditionally rendering either the interactive `<Map>` component or a static `<img src={mapboxStaticUrl}>` with click handlers, 
   - (3) using `navigator.connection.effectiveType` to auto-enable data saver mode when `effectiveType === '2g' || effectiveType === 'slow-2g'`, and
   - (4) displaying estimated data usage for each mode in the toggle UI. 
This approach could reduce data consumption from ~2-5MB per session to ~200-500KB while maintaining core functionality.

### Reflection
1. #### Code Review 
Looking back at our work on sprints 3 and 4, there are several areas where we could have done better:
##### Yanmi
API Integration Challenges: Our approach to implementing FBI data handling revealed critical gaps in our development process. We proceeded without fully understanding the backend API structure, leading to persistent 404 errors caused by parameter mismatches between frontend requests and backend expectations. A more systematic approach would have involved examining the existing `FBIDataTest` component first to understand the working implementation patterns, then building upon that foundation rather than implementing from scratch.

Testing Strategy Shortcomings: We relied heavily on manual testing rather than implementing comprehensive unit and integration tests. This approach failed to catch edge cases such as malformed API responses, network failures, timeout scenarios, and parameter validation errors. A robust testing suite would have included mock API responses that accurately reflected real data structures, error boundary testing, and automated accessibility testing to ensure our screen reader enhancements worked consistently.

Documentation and Communication Gaps: We could have prevented many integration issues by proactively documenting API assumptions, interface contracts, and data flow expectations. Creating clear specifications for frontend-backend communication, including expected request/response formats, error codes, and fallback behaviors, would have caught parameter mismatches much earlier in the development cycle and facilitated better collaboration between team members.

##### Zihan
During Sprint 3 and 4, the FBI employee API implementation passed all unit tests but failed during the live demo because the tests used mock data that didn't reflect the actual dataset format. The issue stemmed from querying the FBI dataset incorrectly, which only became apparent when integrated with the frontend—earlier testing with the real dataset would have caught this format mismatch before the showcase.

2. #### Meta-reflection 
##### Yanmi
Working with React and TypeScript felt fundamentally different from backend development. Frontend requires constant consideration of user interaction, state management, and visual feedback. Unlike backend APIs where you control the exact input/output, frontend must handle unpredictable user behavior and asynchronous data loading. Thus, it IS very important to have the backend sending messages in a format that frontend can understand and handle, including the inputs, detailed error as mentioned in the previous sprint. 

##### Zihan
Working with front-end programming in Sprint 5 felt fundamentally different from the backend work in Sprints 3 and 4. The biggest shift was moving from data logic to user experience—instead of thinking about how to process and serve data efficiently, I had to consider how users actually interact with the interface. Issues that seemed trivial in backend work (like button placement or color contrast) became critical accessibility concerns that could make the application completely unusable for certain users.

3. #### User Experience Reflection 
##### Yanmi
For screen reader users, many of the announcements are inconsistent across different components, causing confusion when navigating the interface. The lack of standardized announcement patterns makes it difficult for users to understand the current state and available actions.

##### Zihan
The mode selection controls (dark/light mode and simple mode toggles) only appear on the initial landing page, so if a user navigates to the map view and wants to change their display settings, they have to scroll all the way back to the top of the page or return to the home screen, which disrupts their workflow and makes the settings feel disconnected from where they're actually needed.

### Design Choices

#### Errors/Bugs:
#### Tests:
#### How To…

##### Design Choices 1: 
##### Yanmi
404 error when querying FBI data due to parameter mismatches and incorrect endpoint logic in DataQueryPanel.
Solution: Simplified FBI data handling to exclusively use `fbi-staff-data` endpoint, aligned parameter handling with working FBIDataTest component, and fixed UI text visibility.
Testing: Manual verification through development server testing FBI queries with different granularities, error handling, and UI responsiveness. Created `FBIDataTest` ("frontend-mockup-yyu111-zwang685/frontend/src/features/DataQuery/FBIDataTest.tsx")component to verify backend data reception and format.

How to Run:
1. Start backend server on port 3001
2. Run `cd frontend && npm run dev`
3. Access at `http://localhost:5173/`
4. Test FBI functionality at `http://localhost:5173/fbi-test`

##### Zihan
#### Dark/Light Mode Implementation:
I implemented a theme toggle using React `useState` to manage a boolean state that conditionally applies CSS classes (`dark-theme` or `light-theme`) to the root container, with colors defined using CSS custom properties for easy maintenance.

#### Simple Mode Implementation:
Simple mode uses conditional rendering with a boolean state to replace bandwidth-heavy components like the Mapbox map with lightweight text-based and simple color background alternatives.

#### Accessibility Fixes:
I added explicit `<label>` elements with `htmlFor` attributes to all select dropdowns, replaced the image-based close button with a proper `<button>` element containing an `aria-label`, and implemented custom focus styles (3px solid #4A90E2 outline) on all interactive elements to meet WCAG 2.1 Level AA standards. 


#### Team members and contributions (include cs logins):
Yanmi Yu (yyu111): Task 1, Task 3, Meta Reflection marked for Yanmi
Zihan Wang (zwang685): Task 2, Supplement, Meta Reflection marked for Zihan
Coprogram: task 3 and supplement


#### Collaborators (cslogins of anyone you worked with on this project or generative AI):

Claude 3.7/ChatGPT4: explianing code functionality when starting, idea inspriation, Task 1-3 and supplement, generate a set of example code for keyboard, generate initial code for server integration, geocoder api, generate example testing cases, syntax check,  debug logic, comments. 

#### Total estimated time it took to complete project:
15

#### Link to GitHub Repo:  
https://github.com/cs0320-f25/frontend-mockup-yyu111-zwang685
#### Link to asynchronous demo:
https://brown.zoom.us/rec/share/nDdk2e2jJ0CIkW9mQM0R6W2E5q3m_b6A7qbkZuAPw6cQ1iQUWG_BXZqE-d5mjYXz.EeCcGWBUsUjpBj0y


