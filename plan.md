# Pin Folder Implementation Plan

## User Story
"As a user of your webapp, I can maintain a folder of pins that may or may not be in an itinerary, so that I can experiment with different trips which hold different places to visit."

## Requirements
- Users should have a universal set (folder) of all pins they've added
- The folder should contain all pins across all itineraries
- Users should be able to move pins between the folder and itineraries
- Pins in the folder may or may not be in an itinerary
- Duplicate pins should not be allowed in the folder (it should act as a set)

## Current Implementation Analysis
Currently, the application allows users to:
- Search for activities and add them directly to date-specific itineraries
- Save complete itineraries as trips to Firebase
- Load saved trips

However, there is no concept of a universal pin folder that persists across sessions or allows for experimentation with different trip configurations.

## Data Model Design

### Pin Model
```typescript
interface Pin {
  id: string;
  name: string;
  description: string;
  duration: number;
  lat: number;
  lng: number;
  addedAt: string; // ISO date string
}
```

### PinFolder Model
```typescript
interface PinFolder {
  userId: string;
  pins: Pin[];
  updatedAt: string; // ISO date string
}
```

### Updated Trip Model
No changes needed to the existing trip model, as it will continue to reference the same activity structure.

## Implementation Plan

### 1. Backend Changes

#### New Endpoints
- `GET /pins/:userId` - Get all pins in a user's folder
- `POST /pins` - Add a new pin to the folder
- `DELETE /pins/:pinId` - Remove a pin from the folder
- `PUT /pins/:pinId/addToItinerary` - Add a pin to a specific itinerary date
- `PUT /pins/:pinId/removeFromItinerary` - Remove a pin from a specific itinerary date

#### Firebase Schema Updates
- New `pins` collection to store user pin folders
- Each document in the collection represents a user's pin folder

### 2. Frontend Changes

#### New Components
- `PinFolderPanel.tsx` - Panel to display and manage the universal pin folder
- `PinCard.tsx` - Card component to display individual pins in the folder
- `PinFolderButton.tsx` - Button to toggle the pin folder panel visibility

#### UI/UX Flow
1. Add a "Pin Folder" button in the main Planner view
2. When clicked, it opens a panel showing all pins in the user's folder
3. Each pin has options to:
   - Add to current day's itinerary
   - View details
   - Remove from folder
4. When adding activities from search, they are automatically added to both:
   - The current day's itinerary
   - The universal pin folder
5. When removing an activity from an itinerary, it remains in the pin folder
6. Provide a clear visual indication of which pins are currently in the itinerary

### 3. State Management Updates

#### New State in Planner Component
```typescript
const [pinFolder, setPinFolder] = useState<Pin[]>([]);
const [isPinFolderVisible, setIsPinFolderVisible] = useState(false);
```

#### New Functions
```typescript
// Add pin to folder
const addPinToFolder = (pin: Pin) => {
  // Check if pin already exists in folder
  if (!pinFolder.some(p => p.id === pin.id)) {
    setPinFolder([...pinFolder, pin]);
    // Save to backend
  }
};

// Remove pin from folder
const removePinFromFolder = (pinId: string) => {
  setPinFolder(pinFolder.filter(p => p.id !== pinId));
  // Remove from backend
};

// Add pin from folder to itinerary
const addPinToItinerary = (pin: Pin, date: string) => {
  const datedActivity: DatedActivity = {
    ...pin,
    date,
  };
  handleSetActivities(datedActivity);
};
```

### 4. Firebase Integration

#### Pin Folder Storage
```typescript
// Save pin folder
const savePinFolder = async () => {
  if (!user) return;
  
  try {
    const idToken = await user.getIdToken();
    await axios.post(
      "http://localhost:3001/pins",
      { userId: user.uid, pins: pinFolder },
      { headers: { Authorization: `Bearer ${idToken}` } }
    );
  } catch (error) {
    console.error("Failed to save pin folder:", error);
  }
};

// Load pin folder
const loadPinFolder = async () => {
  if (!user) return;
  
  try {
    const idToken = await user.getIdToken();
    const response = await axios.get(
      `http://localhost:3001/pins/${user.uid}`,
      { headers: { Authorization: `Bearer ${idToken}` } }
    );
    
    if (response.data.success) {
      setPinFolder(response.data.pins);
    }
  } catch (error) {
    console.error("Failed to load pin folder:", error);
  }
};
```

## Implementation Phases

### Phase 1: Backend Implementation
- Create new Firebase collection for pin folders
- Implement backend API endpoints for pin folder management
- Update existing trip endpoints to work with the pin folder concept

### Phase 2: Frontend Core Components
- Create PinFolderPanel component
- Create PinCard component
- Implement state management for pin folder in Planner component

### Phase 3: Integration and User Flow
- Connect frontend components to backend API
- Implement pin movement between folder and itineraries
- Add automatic pin folder updates when adding/removing activities

### Phase 4: Testing and Refinement
- Test user flows for adding/removing pins
- Test persistence of pin folder across sessions
- Ensure proper error handling and edge cases

## Conclusion
This implementation will provide users with a flexible way to maintain a collection of pins that they can experiment with across different itineraries. The pin folder acts as a universal set containing all pins, while itineraries can contain subsets of these pins organized by date.